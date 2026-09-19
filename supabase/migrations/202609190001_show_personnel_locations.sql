begin;

-- Structured per-show records keep writes atomic and inherit Show RLS. Stable
-- person IDs and a GIN index support future person lookup without a CRM today.
alter table public.shows
  add column key_personnel jsonb not null default '[]'::jsonb,
  add column studio_site text,
  add column location_data jsonb,
  add column legacy_location text;

-- Keep the original verbatim, without guessing city vs venue or changing dates.
-- The lock from ALTER TABLE prevents concurrent writes while this trigger is off.
alter table public.shows disable trigger shows_set_updated_at;
update public.shows set legacy_location = location where location is not null;
alter table public.shows enable trigger shows_set_updated_at;

create function public.valid_show_personnel(entries jsonb)
returns boolean language plpgsql immutable set search_path = public as $$
declare entry jsonb; ordinal bigint; ids text[] := '{}';
begin
  if jsonb_typeof(entries) is distinct from 'array' then return false; end if;
  if jsonb_array_length(entries) > 50 then return false; end if;
  for entry, ordinal in select value, ordinality from jsonb_array_elements(entries) with ordinality loop
    if jsonb_typeof(entry) is distinct from 'object' then return false; end if;
    if not (entry ?& array['id','role','name','company','email','phone','notes','primary','position']) then return false; end if;
    if exists (select 1 from unnest(array['id','role','name','company','email','phone','notes']) as k where jsonb_typeof(entry->k) is distinct from 'string') then return false; end if;
    if (entry->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or (entry->>'id') = any(ids) then return false; end if;
    ids := array_append(ids, entry->>'id');
    if length(btrim(entry->>'role')) not between 1 and 120 or length(btrim(entry->>'name')) not between 1 and 160 then return false; end if;
    if length(entry->>'company') > 160 or length(entry->>'email') > 254 or length(entry->>'phone') > 80 or length(entry->>'notes') > 2000 then return false; end if;
    if (entry->>'email') <> '' and (entry->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return false; end if;
    if jsonb_typeof(entry->'primary') is distinct from 'boolean' or entry->'position' is distinct from to_jsonb(ordinal - 1) then return false; end if;
  end loop;
  return true;
end;
$$;

create function public.valid_show_location(city jsonb, label text)
returns boolean language plpgsql immutable set search_path = public as $$
begin
  if city is null then return true; end if;
  if jsonb_typeof(city) is distinct from 'object' then return false; end if;
  if not (city ?& array['source','id','city','region','country','country_code','display_name','latitude','longitude']) then return false; end if;
  if exists (select 1 from unnest(array['source','id','city','region','country','country_code','display_name']) as k where jsonb_typeof(city->k) is distinct from 'string') then return false; end if;
  if city->>'source' <> 'geonames' or (city->>'id') !~ '^[0-9]+$' or (city->>'country_code') !~ '^[A-Z]{2}$' then return false; end if;
  if length(city->>'city') not between 1 and 200 or length(city->>'region') > 200 or length(city->>'country') not between 1 and 200 or length(city->>'display_name') not between 1 and 500 then return false; end if;
  if label is distinct from city->>'display_name' then return false; end if;
  if jsonb_typeof(city->'latitude') is distinct from 'number' or jsonb_typeof(city->'longitude') is distinct from 'number' then return false; end if;
  return (city->>'latitude')::numeric between -90 and 90 and (city->>'longitude')::numeric between -180 and 180;
end;
$$;

alter table public.shows
  add constraint shows_personnel_valid check (public.valid_show_personnel(key_personnel)),
  add constraint shows_location_data_valid check (public.valid_show_location(location_data, location)),
  add constraint shows_studio_site_length check (studio_site is null or length(studio_site) <= 240);

create index shows_personnel_search_idx on public.shows using gin (key_personnel jsonb_path_ops);
create index shows_city_id_idx on public.shows ((location_data->>'id')) where location_data is not null;

comment on column public.shows.key_personnel is 'Structured per-show personnel. UUID identity, role, name, company, email, phone, notes, primary flag and zero-based position; saved atomically with Show.';
comment on column public.shows.location_data is 'Selected GeoNames city snapshot; null for manual or legacy free text. location is the display label.';
comment on column public.shows.legacy_location is 'Original pre-normalization location, preserved verbatim by the migration; never inferred to be a city or venue.';

commit;
