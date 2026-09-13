begin;

-- Pinned is presentation state, deliberately independent of workflow and urgency.
alter table public.napkin_notes add column if not exists pinned boolean not null default false;
create index if not exists napkin_pinned_updated_idx
  on public.napkin_notes (pinned, updated_at desc) where pinned;

-- Return only the intentionally shared identity needed for Napkin attribution.
create or replace function public.napkin_poster_identities(target_ids uuid[])
returns table(profile_id uuid, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, coalesce(nullif(btrim(p.full_name), ''), 'T.I.K.I. member')
  from public.profiles p
  where public.has_minimum_role('viewer') and p.active and p.id = any(coalesce(target_ids, '{}'::uuid[]))
  order by p.id;
$$;
revoke all on function public.napkin_poster_identities(uuid[]) from public, anon;
do $$ begin
  if exists(select 1 from pg_roles where rolname='service_role') then
    revoke all on function public.napkin_poster_identities(uuid[]) from service_role;
  end if;
end $$;
grant execute on function public.napkin_poster_identities(uuid[]) to authenticated;

alter table public.vendor_clients add column if not exists city text;
alter table public.vendor_clients drop constraint if exists vendor_clients_kind_check;
alter table public.vendor_clients add constraint vendor_clients_kind_check
  check (kind in ('vendor', 'manufacturer', 'client'));
alter table public.vendor_clients drop constraint if exists vendor_clients_city_length;
alter table public.vendor_clients add constraint vendor_clients_city_length
  check (city is null or char_length(city) <= 120) not valid;
alter table public.vendor_clients validate constraint vendor_clients_city_length;

create table if not exists public.vendor_contacts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendor_clients(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  title text check (title is null or char_length(title) <= 160),
  email text check (email is null or (char_length(email) <= 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  cell text check (cell is null or char_length(cell) <= 100),
  is_primary boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vendor_contacts_vendor_order_idx on public.vendor_contacts(vendor_id, sort_order, id);
create unique index if not exists vendor_contacts_one_primary_idx on public.vendor_contacts(vendor_id) where is_primary;
drop trigger if exists vendor_contacts_set_updated_at on public.vendor_contacts;
create trigger vendor_contacts_set_updated_at before update on public.vendor_contacts
for each row execute function public.set_updated_at();

alter table public.vendor_contacts enable row level security;
grant select, insert, update, delete on public.vendor_contacts to authenticated;
drop policy if exists vendor_contacts_editor_read on public.vendor_contacts;
create policy vendor_contacts_editor_read on public.vendor_contacts for select to authenticated
  using (public.has_minimum_role('editor'));
drop policy if exists vendor_contacts_editor_insert on public.vendor_contacts;
create policy vendor_contacts_editor_insert on public.vendor_contacts for insert to authenticated
  with check (public.has_minimum_role('editor'));
drop policy if exists vendor_contacts_editor_update on public.vendor_contacts;
create policy vendor_contacts_editor_update on public.vendor_contacts for update to authenticated
  using (public.has_minimum_role('editor')) with check (public.has_minimum_role('editor'));
drop policy if exists vendor_contacts_admin_delete on public.vendor_contacts;
create policy vendor_contacts_admin_delete on public.vendor_contacts for delete to authenticated
  using (public.has_minimum_role('admin'));

-- The legacy field is explicitly a contact name. Preserve it and migrate it once.
insert into public.vendor_contacts(vendor_id, name, is_primary, sort_order, created_at, updated_at)
select v.id, btrim(v.primary_contact), true, 0, v.created_at, v.updated_at
from public.vendor_clients v
where nullif(btrim(v.primary_contact), '') is not null
  and not exists(select 1 from public.vendor_contacts c where c.vendor_id = v.id);

create or replace function public.save_vendor_directory_entry(
  target_id uuid, organization_name text, organization_city text,
  relationship text, organization_notes text, publication_status text,
  contacts jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  saved_id uuid := coalesce(target_id, gen_random_uuid());
  contact_item jsonb;
  contact_id uuid;
  retained uuid[] := '{}'::uuid[];
  clean_name text;
  clean_title text;
  clean_email text;
  clean_cell text;
  primary_count integer;
begin
  if not public.has_minimum_role('editor') then
    raise exception 'Editor access required' using errcode='42501';
  end if;
  organization_name := nullif(btrim(organization_name), '');
  organization_city := nullif(btrim(organization_city), '');
  organization_notes := nullif(btrim(organization_notes), '');
  if organization_name is null or char_length(organization_name) > 160 then raise exception 'Organization name is required and must be 160 characters or fewer'; end if;
  if organization_city is not null and char_length(organization_city) > 120 then raise exception 'City must be 120 characters or fewer'; end if;
  if relationship not in ('vendor','manufacturer','client') then raise exception 'Choose a listed relationship'; end if;
  if publication_status not in ('draft','submitted','published','archived') then raise exception 'Choose a valid status'; end if;
  if organization_notes is not null and char_length(organization_notes) > 4000 then raise exception 'Notes must be 4000 characters or fewer'; end if;
  contacts := coalesce(contacts, '[]'::jsonb);
  if jsonb_typeof(contacts) <> 'array' or jsonb_array_length(contacts) > 100 then raise exception 'Expected at most 100 contacts'; end if;
  select count(*) into primary_count from jsonb_array_elements(contacts) as c(element) where coalesce((c.element->>'is_primary')::boolean,false);
  if primary_count > 1 then raise exception 'Only one Primary Contact is allowed'; end if;

  if target_id is null then
    insert into public.vendor_clients(id,name,city,kind,notes,status,created_by)
    values(saved_id,organization_name,organization_city,relationship,organization_notes,publication_status::public.content_status,auth.uid());
  else
    if not exists(select 1 from public.vendor_clients where id=target_id) then raise exception 'Organization not found'; end if;
    update public.vendor_clients set name=organization_name,city=organization_city,kind=relationship,
      notes=organization_notes,status=publication_status::public.content_status where id=target_id;
  end if;

  -- Demote first so promotion never collides with the partial unique index.
  update public.vendor_contacts set is_primary=false where vendor_id=saved_id and is_primary;
  for contact_item in select value from jsonb_array_elements(contacts) loop
    clean_name := nullif(btrim(contact_item->>'name'), '');
    clean_title := nullif(btrim(contact_item->>'title'), '');
    clean_email := nullif(btrim(contact_item->>'email'), '');
    clean_cell := nullif(btrim(contact_item->>'cell'), '');
    if clean_name is null or char_length(clean_name) > 160 then raise exception 'Every saved contact needs a name of 160 characters or fewer'; end if;
    if clean_title is not null and char_length(clean_title) > 160 then raise exception 'Contact title must be 160 characters or fewer'; end if;
    if clean_email is not null and (char_length(clean_email) > 254 or clean_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Enter a valid contact email'; end if;
    if clean_cell is not null and char_length(clean_cell) > 100 then raise exception 'Contact cell must be 100 characters or fewer'; end if;
    if nullif(contact_item->>'id','') is null then contact_id := gen_random_uuid();
    elsif contact_item->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      contact_id := (contact_item->>'id')::uuid;
      if exists(select 1 from public.vendor_contacts where id=contact_id and vendor_id<>saved_id) then raise exception 'Contact does not belong to this organization'; end if;
    else raise exception 'Invalid contact identifier'; end if;
    retained := array_append(retained, contact_id);
    insert into public.vendor_contacts(id,vendor_id,name,title,email,cell,is_primary,sort_order)
    values(contact_id,saved_id,clean_name,clean_title,clean_email,clean_cell,coalesce((contact_item->>'is_primary')::boolean,false),coalesce((contact_item->>'sort_order')::integer,0))
    on conflict(id) do update set name=excluded.name,title=excluded.title,email=excluded.email,cell=excluded.cell,
      is_primary=excluded.is_primary,sort_order=excluded.sort_order where public.vendor_contacts.vendor_id=saved_id;
  end loop;
  delete from public.vendor_contacts where vendor_id=saved_id and not(id=any(retained));
  return saved_id;
end;
$$;
revoke all on function public.save_vendor_directory_entry(uuid,text,text,text,text,text,jsonb) from public, anon;
do $$ begin
  if exists(select 1 from pg_roles where rolname='service_role') then
    revoke all on function public.save_vendor_directory_entry(uuid,text,text,text,text,text,jsonb) from service_role;
  end if;
end $$;
grant execute on function public.save_vendor_directory_entry(uuid,text,text,text,text,text,jsonb) to authenticated;

create or replace function public.vendor_directory(
  search_text text default '', sort_order text default 'name-asc', result_offset integer default 0, result_limit integer default 50,
  archived boolean default false
) returns table(id uuid,name text,city text,kind text,notes text,status public.content_status,
  created_by uuid,created_at timestamptz,updated_at timestamptz,contacts jsonb,total_count bigint)
language sql stable security invoker set search_path = '' as $$
  with matched as (
    select v.*
    from public.vendor_clients v
    where public.has_minimum_role('editor') and (v.status='archived')=archived
      and (nullif(btrim(search_text),'') is null
        or v.name ilike '%'||btrim(search_text)||'%' or coalesce(v.city,'') ilike '%'||btrim(search_text)||'%'
        or exists(select 1 from public.vendor_contacts c where c.vendor_id=v.id and
          (c.name ilike '%'||btrim(search_text)||'%' or coalesce(c.title,'') ilike '%'||btrim(search_text)||'%'
            or coalesce(c.email,'') ilike '%'||btrim(search_text)||'%')))
  ), counted as (select m.*,count(*) over() total_count from matched m)
  select v.id,v.name,v.city,v.kind,v.notes,v.status,v.created_by,v.created_at,v.updated_at,
    coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'title',c.title,'email',c.email,'cell',c.cell,
      'is_primary',c.is_primary,'sort_order',c.sort_order) order by c.is_primary desc,c.sort_order,c.id)
      from public.vendor_contacts c where c.vendor_id=v.id),'[]'::jsonb),v.total_count
  from counted v
  order by
    case when sort_order='name-asc' then lower(v.name) collate "C" end asc,
    case when sort_order='name-desc' then lower(v.name) collate "C" end desc,
    case when sort_order in ('city-asc','city-desc') then nullif(btrim(v.city),'') is null end asc,
    case when sort_order='city-asc' then lower(v.city) collate "C" end asc,
    case when sort_order='city-desc' then lower(v.city) collate "C" end desc,
    case when sort_order in ('city-asc','city-desc') then lower(v.name) collate "C" end asc,
    v.id
  offset greatest(result_offset,0) limit least(greatest(result_limit,1),100);
$$;
revoke all on function public.vendor_directory(text,text,integer,integer,boolean) from public, anon;
do $$ begin
  if exists(select 1 from pg_roles where rolname='service_role') then
    revoke all on function public.vendor_directory(text,text,integer,integer,boolean) from service_role;
  end if;
end $$;
grant execute on function public.vendor_directory(text,text,integer,integer,boolean) to authenticated;

comment on table public.vendor_contacts is 'Restricted repeatable contacts for the Vendors / Manufacturers business directory.';
commit;
