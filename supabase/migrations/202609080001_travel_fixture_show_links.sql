-- Focused travel, fixture-link, and show-staffing additions.
-- Existing columns and values remain intact; legacy show links are copied safely.

begin;

alter table public.fixtures
  add column if not exists fixture_page_url text,
  add column if not exists showfile_url text;

alter table public.shows
  add column if not exists dropbox_url text,
  add column if not exists egnyte_url text,
  add column if not exists staffing_notes text check (staffing_notes is null or char_length(staffing_notes) <= 8000),
  add column if not exists staffing_calendar_url text;

create table if not exists public.additional_links (
  id uuid primary key default gen_random_uuid(),
  entity_kind public.relationship_kind not null check (entity_kind in ('fixture', 'show')),
  entity_id uuid not null,
  section text not null check (section in ('fixture', 'show_files', 'show_staffing')),
  label text not null check (char_length(label) between 1 and 120),
  url text not null check (char_length(url) between 1 and 2048),
  position integer not null default 0 check (position >= 0 and position < 30),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_kind, entity_id, section, position)
);

create index if not exists additional_links_entity_idx
  on public.additional_links (entity_kind, entity_id, section, position);

drop trigger if exists additional_links_set_updated_at on public.additional_links;
create trigger additional_links_set_updated_at before update on public.additional_links
for each row execute function public.set_updated_at();

-- Only classify hostnames that unambiguously identify the provider.
update public.shows
set dropbox_url = primary_link
where nullif(trim(primary_link), '') is not null
  and dropbox_url is null
  and primary_link ~* '^https?://([a-z0-9-]+\.)*dropbox\.com([/:?#]|$)';

update public.shows
set egnyte_url = primary_link
where nullif(trim(primary_link), '') is not null
  and egnyte_url is null
  and primary_link ~* '^https?://([a-z0-9-]+\.)*egnyte\.com([/:?#]|$)';

insert into public.additional_links (entity_kind, entity_id, section, label, url, position, created_by)
select 'show', id, 'show_files', 'Legacy Show Link', primary_link, 0, created_by
from public.shows
where nullif(trim(primary_link), '') is not null
  and primary_link !~* '^https?://([a-z0-9-]+\.)*dropbox\.com([/:?#]|$)'
  and primary_link !~* '^https?://([a-z0-9-]+\.)*egnyte\.com([/:?#]|$)'
on conflict (entity_kind, entity_id, section, position) do nothing;

alter table public.additional_links enable row level security;
grant select, insert, update, delete on public.additional_links to authenticated;

drop policy if exists "additional_links_read" on public.additional_links;
drop policy if exists "additional_links_insert" on public.additional_links;
drop policy if exists "additional_links_update" on public.additional_links;
drop policy if exists "additional_links_delete" on public.additional_links;
create policy "additional_links_read" on public.additional_links for select to authenticated
using (public.can_read_content(entity_kind, entity_id));
create policy "additional_links_insert" on public.additional_links for insert to authenticated
with check (created_by = auth.uid() and public.can_edit_content(entity_kind, entity_id));
create policy "additional_links_update" on public.additional_links for update to authenticated
using (public.can_edit_content(entity_kind, entity_id))
with check (public.can_edit_content(entity_kind, entity_id));
create policy "additional_links_delete" on public.additional_links for delete to authenticated
using (public.has_minimum_role('admin') or public.can_edit_content(entity_kind, entity_id));

create or replace function public.set_additional_links(
  target_kind public.relationship_kind,
  target_id uuid,
  link_sections text[],
  link_labels text[],
  link_urls text[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item_count integer := coalesce(cardinality(link_labels), 0);
  item_index integer;
  clean_section text;
  clean_label text;
  clean_url text;
begin
  if target_kind not in ('fixture', 'show') or not public.can_edit_content(target_kind, target_id) then
    raise exception 'Additional links cannot be edited by the current user';
  end if;
  if item_count > 30 or item_count <> coalesce(cardinality(link_sections), 0) or item_count <> coalesce(cardinality(link_urls), 0) then
    raise exception 'Additional link data is incomplete';
  end if;

  delete from public.additional_links where entity_kind = target_kind and entity_id = target_id;
  for item_index in 1..item_count loop
    clean_section := trim(link_sections[item_index]);
    clean_label := trim(link_labels[item_index]);
    clean_url := trim(link_urls[item_index]);
    if (target_kind = 'fixture' and clean_section <> 'fixture')
      or (target_kind = 'show' and clean_section not in ('show_files', 'show_staffing'))
      or clean_label = '' or char_length(clean_label) > 120
      or char_length(clean_url) > 2048 or clean_url !~* '^https?://[^[:space:]]+$' then
      raise exception 'One or more additional links is invalid';
    end if;
    insert into public.additional_links (entity_kind, entity_id, section, label, url, position, created_by)
    values (target_kind, target_id, clean_section, clean_label, clean_url, item_index - 1, auth.uid());
  end loop;
end;
$$;

revoke all on function public.set_additional_links(public.relationship_kind, uuid, text[], text[], text[]) from public;
grant execute on function public.set_additional_links(public.relationship_kind, uuid, text[], text[], text[]) to authenticated;

create table if not exists public.travel_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  details text check (details is null or char_length(details) <= 12000),
  flighty_url text check (flighty_url is null or char_length(flighty_url) <= 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists travel_profiles_set_updated_at on public.travel_profiles;
create trigger travel_profiles_set_updated_at before update on public.travel_profiles
for each row execute function public.set_updated_at();

alter table public.travel_profiles enable row level security;
grant select, insert, update on public.travel_profiles to authenticated;

drop policy if exists "travel_profiles_own_read" on public.travel_profiles;
drop policy if exists "travel_profiles_own_insert" on public.travel_profiles;
drop policy if exists "travel_profiles_own_update" on public.travel_profiles;
create policy "travel_profiles_own_read" on public.travel_profiles for select to authenticated
using (user_id = auth.uid() and public.has_minimum_role('viewer'));
create policy "travel_profiles_own_insert" on public.travel_profiles for insert to authenticated
with check (user_id = auth.uid() and public.has_minimum_role('viewer'));
create policy "travel_profiles_own_update" on public.travel_profiles for update to authenticated
using (user_id = auth.uid() and public.has_minimum_role('viewer'))
with check (user_id = auth.uid() and public.has_minimum_role('viewer'));

comment on table public.travel_profiles is 'Private per-user travel reference. Details are intentionally excluded from global search.';
comment on column public.fixtures.typical_use is 'Legacy data retained but intentionally omitted from the current T.I.K.I. UI.';
comment on column public.shows.primary_link is 'Legacy data retained; populated values were copied to provider or additional-link fields.';

commit;
