-- One-shot follow-up: deliberately scoped sharing, URL-less references, and personal palettes.

begin;

alter table public.profiles
  add column if not exists production_travel_access boolean not null default false;
grant update (production_travel_access) on public.profiles to authenticated;

alter table public.travel_profiles
  add column if not exists share_flighty boolean not null default false,
  add column if not exists share_booking boolean not null default false;

alter table public.link_items alter column url drop not null;

create table if not exists public.user_custom_palettes (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  tokens jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, slot),
  constraint user_custom_palettes_tokens check (
    jsonb_typeof(tokens) = 'object'
    and tokens ?& array['canvas','surface','primary_accent','secondary_accent','primary_text','muted_text']
    and tokens - 'canvas' - 'surface' - 'primary_accent' - 'secondary_accent' - 'primary_text' - 'muted_text' = '{}'::jsonb
    and tokens->>'canvas' ~ '^#[0-9A-Fa-f]{6}$'
    and tokens->>'surface' ~ '^#[0-9A-Fa-f]{6}$'
    and tokens->>'primary_accent' ~ '^#[0-9A-Fa-f]{6}$'
    and tokens->>'secondary_accent' ~ '^#[0-9A-Fa-f]{6}$'
    and tokens->>'primary_text' ~ '^#[0-9A-Fa-f]{6}$'
    and tokens->>'muted_text' ~ '^#[0-9A-Fa-f]{6}$'
  )
);

create table if not exists public.user_appearance (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  active_custom_slot smallint check (active_custom_slot between 1 and 3),
  updated_at timestamptz not null default now()
);

drop trigger if exists user_custom_palettes_set_updated_at on public.user_custom_palettes;
create trigger user_custom_palettes_set_updated_at before update on public.user_custom_palettes
for each row execute function public.set_updated_at();
drop trigger if exists user_appearance_set_updated_at on public.user_appearance;
create trigger user_appearance_set_updated_at before update on public.user_appearance
for each row execute function public.set_updated_at();

alter table public.user_custom_palettes enable row level security;
alter table public.user_appearance enable row level security;
grant select, insert, update, delete on public.user_custom_palettes to authenticated;
grant select, insert, update on public.user_appearance to authenticated;

drop policy if exists user_custom_palettes_own on public.user_custom_palettes;
create policy user_custom_palettes_own on public.user_custom_palettes for all to authenticated
using (profile_id = auth.uid() and public.has_minimum_role('viewer'))
with check (profile_id = auth.uid() and public.has_minimum_role('viewer'));
drop policy if exists user_appearance_own on public.user_appearance;
create policy user_appearance_own on public.user_appearance for all to authenticated
using (profile_id = auth.uid() and public.has_minimum_role('viewer'))
with check (profile_id = auth.uid() and public.has_minimum_role('viewer'));

create or replace function public.shared_flighty_profiles()
returns table(profile_id uuid, display_name text, flighty_url text, avatar_version timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.id, coalesce(nullif(p.full_name,''),'T.I.K.I. member'), t.flighty_url, p.updated_at
  from public.travel_profiles t join public.profiles p on p.id=t.user_id
  where exists(select 1 from public.profiles viewer where viewer.id=auth.uid() and viewer.active)
    and p.active and t.share_flighty and nullif(btrim(t.flighty_url),'') is not null
  order by lower(coalesce(nullif(p.full_name,''),'T.I.K.I. member')) collate "C", p.id;
$$;

create or replace function public.shared_booking_profiles()
returns table(profile_id uuid, display_name text, traveler_name text, details text, avatar_version timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.id, coalesce(nullif(p.full_name,''),'T.I.K.I. member'), t.name, t.details, p.updated_at
  from public.travel_profiles t join public.profiles p on p.id=t.user_id
  where exists(
    select 1 from public.profiles viewer where viewer.id=auth.uid() and viewer.active
      and (viewer.production_travel_access or viewer.role='admin')
  ) and p.active and t.share_booking
  order by lower(coalesce(nullif(p.full_name,''),'T.I.K.I. member')) collate "C", p.id;
$$;

revoke all on function public.shared_flighty_profiles(), public.shared_booking_profiles() from public, anon;
do $block$ begin if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on function public.shared_flighty_profiles(), public.shared_booking_profiles() from service_role';
end if; end $block$;
grant execute on function public.shared_flighty_profiles(), public.shared_booking_profiles() to authenticated;

drop function if exists public.file_napkin(uuid, public.relationship_kind, text, text);
create or replace function public.file_napkin(
  note_id uuid,
  target_kind public.relationship_kind,
  record_title text,
  review_note text default null,
  reference_collection_id text default null,
  reference_subcollection_id text default null
)
returns table(entity_kind public.relationship_kind, entity_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  note_record public.napkin_notes%rowtype;
  new_id uuid; clean_title text := btrim(record_title); approval_summary text;
  is_dropbox_link boolean; is_egnyte_link boolean; reference_category text;
begin
  if not public.has_minimum_role('editor') then raise exception 'Only Editors and Admins can approve and file Napkins.'; end if;
  if target_kind not in ('fixture','show','link','location','drink') then raise exception 'Choose a supported filing destination.'; end if;
  if clean_title = '' or char_length(clean_title) > 160 then raise exception 'The filed record needs a title between 1 and 160 characters.'; end if;
  if review_note is not null and char_length(review_note) > 500 then raise exception 'The approval note must be 500 characters or fewer.'; end if;
  select * into note_record from public.napkin_notes where id=note_id for update;
  if not found then raise exception 'That Napkin could not be found.'; end if;
  if note_record.status='converted' then raise exception 'This Napkin is already filed.'; end if;
  if note_record.status='archived' then raise exception 'Restore this Napkin before filing it.'; end if;

  if target_kind='link' then
    select case when child.id is null then parent.name else parent.name || ' / ' || child.name end
      into reference_category
    from public.reference_collections parent
    left join public.reference_collections child on child.id=reference_subcollection_id and child.parent_id=parent.id
    where parent.id=coalesce(reference_collection_id,'unsorted') and parent.parent_id is null
      and (reference_subcollection_id is null or child.id is not null);
    if reference_category is null then raise exception 'Choose a valid Reference Hub destination.'; end if;
  end if;

  is_dropbox_link := coalesce(note_record.source_url ~* '^https?://([a-z0-9-]+\.)*dropbox\.com([/:?#]|$)',false);
  is_egnyte_link := coalesce(note_record.source_url ~* '^https?://([a-z0-9-]+\.)*egnyte\.com([/:?#]|$)',false);
  case target_kind
    when 'fixture' then insert into public.fixtures(name,field_notes,manual_url,status,created_by,verified_by,last_verified_at) values(clean_title,note_record.body,note_record.source_url,'published',auth.uid(),auth.uid(),now()) returning id into new_id;
    when 'show' then insert into public.shows(title,summary,primary_link,dropbox_url,egnyte_url,status,created_by,verified_by) values(clean_title,note_record.body,note_record.source_url,case when is_dropbox_link then note_record.source_url end,case when is_egnyte_link then note_record.source_url end,'published',auth.uid(),auth.uid()) returning id into new_id;
    when 'link' then insert into public.link_items(label,category,url,description,collection_id,subcollection_id,date_added,status,created_by,verified_by) values(clean_title,reference_category,nullif(btrim(note_record.source_url),''),note_record.body,coalesce(reference_collection_id,'unsorted'),reference_subcollection_id,now(),'published',auth.uid(),auth.uid()) returning id into new_id;
    when 'location' then insert into public.locations(name,kind,website_url,notes,status,created_by,verified_by) values(clean_title,'other',note_record.source_url,note_record.body,'published',auth.uid(),auth.uid()) returning id into new_id;
    when 'drink' then insert into public.drinks(name,description,ingredients,source_url,status,created_by,verified_by) values(clean_title,'Filed from a T.I.K.I. Napkin.',note_record.body,note_record.source_url,'published',auth.uid(),auth.uid()) returning id into new_id;
  end case;
  if target_kind='show' and nullif(btrim(note_record.source_url),'') is not null and not is_dropbox_link and not is_egnyte_link then
    insert into public.additional_links(entity_kind,entity_id,section,label,url,position,created_by) values('show',new_id,'show_files','Legacy Show Link',note_record.source_url,0,auth.uid());
  end if;
  insert into public.content_tags(tag_id,entity_kind,entity_id,created_by) select ct.tag_id,target_kind,new_id,auth.uid() from public.content_tags ct where ct.entity_kind='napkin' and ct.entity_id=note_id on conflict do nothing;
  update public.napkin_notes set status='converted',converted_to_kind=target_kind,converted_to_id=new_id where id=note_id;
  approval_summary := coalesce(nullif(btrim(review_note),''),'Approved and filed as '||initcap(replace(target_kind::text,'_',' '))||'.');
  insert into public.revision_notes(entity_kind,entity_id,summary,source,created_by) values('napkin',note_id,approval_summary,'Approve & File',auth.uid()),(target_kind,new_id,'Created from a reviewed T.I.K.I. Napkin.','Approve & File',auth.uid());
  return query select target_kind,new_id;
end;
$$;

revoke all on function public.file_napkin(uuid,public.relationship_kind,text,text,text,text) from public, anon;
do $block$ begin if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on function public.file_napkin(uuid,public.relationship_kind,text,text,text,text) from service_role';
end if; end $block$;
grant execute on function public.file_napkin(uuid,public.relationship_kind,text,text,text,text) to authenticated;

commit;
