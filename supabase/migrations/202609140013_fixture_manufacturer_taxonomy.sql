-- Canonical Fixture manufacturers and the Wash Bricks display-name migration.
-- Legacy manufacturer text remains on fixtures for rollback/audit and for any
-- ambiguous values that require a human choice.
begin;

create table if not exists public.fixture_manufacturers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  active boolean not null default true,
  aliases text[] not null default array[]::text[] check (array_position(aliases, null) is null),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists fixture_manufacturers_slug_idx on public.fixture_manufacturers (slug);
create unique index if not exists fixture_manufacturers_name_idx on public.fixture_manufacturers (lower(btrim(name)));
create index if not exists fixture_manufacturers_active_name_idx on public.fixture_manufacturers (active, lower(name));

drop trigger if exists fixture_manufacturers_set_updated_at on public.fixture_manufacturers;
create trigger fixture_manufacturers_set_updated_at
before update on public.fixture_manufacturers
for each row execute function public.set_updated_at();

drop trigger if exists fixture_manufacturers_prevent_duplicates on public.fixture_manufacturers;

insert into public.fixture_manufacturers (name, slug, aliases) values
  ('ACME', 'acme', array['Acme']),
  ('ADJ', 'adj', array['American DJ']),
  ('Altman', 'altman', array[]::text[]),
  ('Aputure', 'aputure', array[]::text[]),
  ('ARRI', 'arri', array['Arri']),
  ('Astera', 'astera', array[]::text[]),
  ('Ayrton', 'ayrton', array[]::text[]),
  ('BB&S', 'bb-and-s', array['BB&S Lighting']),
  ('Chauvet DJ', 'chauvet-dj', array['CHAUVET DJ']),
  ('Chauvet Professional', 'chauvet-professional', array['Chauvet Pro', 'CHAUVET Professional']),
  ('Chimera', 'chimera', array[]::text[]),
  ('Chroma-Q', 'chroma-q', array['Chroma Q']),
  ('Cineo', 'cineo', array[]::text[]),
  ('CITC', 'citc', array['CITC FX']),
  ('City Theatrical', 'city-theatrical', array[]::text[]),
  ('Claypaky', 'claypaky', array['Clay Paky']),
  ('Color Kinetics', 'color-kinetics', array['Philips Color Kinetics']),
  ('Creamsource', 'creamsource', array[]::text[]),
  ('DMG Lumière / Rosco', 'dmg-lumiere-rosco', array['DMG Lumiere', 'DMG Lumiere / Rosco', 'DMG/Rosco']),
  ('Elation', 'elation', array['Elation Professional']),
  ('ETC', 'etc', array['Electronic Theatre Controls']),
  ('Fiilex', 'fiilex', array[]::text[]),
  ('Froggy’s Fog', 'froggys-fog', array['Froggy''s Fog', 'Froggys Fog']),
  ('GLP', 'glp', array[]::text[]),
  ('High End Systems', 'high-end-systems', array['HES', 'High End', 'ETC High End Systems']),
  ('JEM', 'jem', array['Jem']),
  ('Kino Flo', 'kino-flo', array['KinoFlo', 'Kino-Flo']),
  ('LiteGear', 'litegear', array['Litegear']),
  ('Litepanels', 'litepanels', array['Lite Panels']),
  ('Look Solutions', 'look-solutions', array[]::text[]),
  ('LumenRadio', 'lumenradio', array['Lumen Radio']),
  ('Lycian', 'lycian', array[]::text[]),
  ('Martin', 'martin', array['Martin Lighting', 'Martin Professional']),
  ('MDG', 'mdg', array[]::text[]),
  ('Mega-Lite', 'mega-lite', array['Mega Lite']),
  ('Nanlite', 'nanlite', array['Nan Lite']),
  ('Nanlux', 'nanlux', array[]::text[]),
  ('PROLIGHTS', 'prolights', array['ProLights', 'Pro Lights']),
  ('Quasar Science', 'quasar-science', array['Quasar']),
  ('Reel EFX', 'reel-efx', array[]::text[]),
  ('Robe', 'robe', array['ROBE']),
  ('Rosco', 'rosco', array[]::text[]),
  ('SGM', 'sgm', array['SGM Light']),
  ('Smoke Factory', 'smoke-factory', array[]::text[]),
  ('Strand', 'strand', array['Strand Lighting']),
  ('TMB / Solaris', 'tmb-solaris', array['Solaris', 'TMB']),
  ('Ultratec', 'ultratec', array[]::text[]),
  ('Vari-Lite', 'vari-lite', array['VL', 'Vari Lite', 'VariLite'])
on conflict (slug) do update
set name = excluded.name,
    aliases = excluded.aliases,
    active = true;

create or replace function public.fixture_manufacturer_key(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '', 'g');
$$;

create or replace function public.prevent_fixture_manufacturer_duplicate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  candidate_key text := public.fixture_manufacturer_key(new.name);
  candidate_alias text;
  matching_names text;
begin
  if candidate_key = '' then
    raise exception 'Manufacturer name must contain letters or numbers';
  end if;

  select string_agg(m.name, ', ' order by m.name)
  into matching_names
  from public.fixture_manufacturers m
  where m.id is distinct from new.id
    and (
      public.fixture_manufacturer_key(m.name) = candidate_key
      or exists (
        select 1 from unnest(m.aliases) existing_alias
        where public.fixture_manufacturer_key(existing_alias) = candidate_key
      )
      or (
        least(char_length(public.fixture_manufacturer_key(m.name)), char_length(candidate_key)) >= 4
        and (
          public.fixture_manufacturer_key(m.name) like candidate_key || '%'
          or candidate_key like public.fixture_manufacturer_key(m.name) || '%'
        )
      )
    );

  if matching_names is not null then
    raise exception 'Similar manufacturers already exist: %', matching_names;
  end if;

  foreach candidate_alias in array new.aliases loop
    if public.fixture_manufacturer_key(candidate_alias) = '' then
      raise exception 'Manufacturer aliases must contain letters or numbers';
    end if;
    select string_agg(m.name, ', ' order by m.name)
    into matching_names
    from public.fixture_manufacturers m
    where m.id is distinct from new.id
      and (
        public.fixture_manufacturer_key(m.name) = public.fixture_manufacturer_key(candidate_alias)
        or exists (
          select 1 from unnest(m.aliases) existing_alias
          where public.fixture_manufacturer_key(existing_alias) = public.fixture_manufacturer_key(candidate_alias)
        )
      );
    if matching_names is not null then
      raise exception 'Manufacturer alias conflicts with: %', matching_names;
    end if;
  end loop;

  new.name := btrim(regexp_replace(new.name, '\s+', ' ', 'g'));
  return new;
end;
$$;

create trigger fixture_manufacturers_prevent_duplicates
before insert or update of name, aliases on public.fixture_manufacturers
for each row execute function public.prevent_fixture_manufacturer_duplicate();

revoke all on function public.fixture_manufacturer_key(text) from public, anon, authenticated;
grant execute on function public.fixture_manufacturer_key(text) to authenticated;
revoke all on function public.prevent_fixture_manufacturer_duplicate() from public, anon, authenticated;

alter table public.fixture_manufacturers enable row level security;
drop policy if exists "fixture_manufacturers_read" on public.fixture_manufacturers;
drop policy if exists "fixture_manufacturers_editor_insert" on public.fixture_manufacturers;
create policy "fixture_manufacturers_read" on public.fixture_manufacturers
for select to authenticated
using (public.has_minimum_role('viewer') and (active or public.has_minimum_role('editor')));
create policy "fixture_manufacturers_editor_insert" on public.fixture_manufacturers
for insert to authenticated
with check (public.has_minimum_role('editor') and created_by = auth.uid());

revoke all on table public.fixture_manufacturers from anon, authenticated;
grant select, insert on table public.fixture_manufacturers to authenticated;

alter table public.fixtures add column if not exists manufacturer_id uuid;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.fixtures'::regclass
      and conname = 'fixtures_manufacturer_id_fkey'
  ) then
    alter table public.fixtures
      add constraint fixtures_manufacturer_id_fkey
      foreign key (manufacturer_id) references public.fixture_manufacturers(id) on delete restrict;
  end if;
end;
$$;
create index if not exists fixtures_manufacturer_id_idx on public.fixtures (manufacturer_id);

-- Only exact canonical or alias matches are normalized. Plain "Chauvet" is not
-- an alias and therefore remains untouched with a null manufacturer_id.
alter table public.fixtures disable trigger fixtures_set_updated_at;
with candidate_matches as (
  select f.id as fixture_id, m.id as manufacturer_id
  from public.fixtures f
  join public.fixture_manufacturers m
    on public.fixture_manufacturer_key(f.manufacturer) = public.fixture_manufacturer_key(m.name)
    or exists (
      select 1 from unnest(m.aliases) alias
      where public.fixture_manufacturer_key(f.manufacturer) = public.fixture_manufacturer_key(alias)
    )
  where nullif(public.fixture_manufacturer_key(f.manufacturer), '') is not null
), deterministic_matches as (
  select fixture_id, (array_agg(distinct manufacturer_id))[1] as manufacturer_id
  from candidate_matches
  group by fixture_id
  having count(distinct manufacturer_id) = 1
)
update public.fixtures f
set manufacturer_id = d.manufacturer_id,
    manufacturer = m.name
from deterministic_matches d
join public.fixture_manufacturers m on m.id = d.manufacturer_id
where f.id = d.fixture_id
  and (f.manufacturer_id is distinct from d.manufacturer_id or f.manufacturer is distinct from m.name);

update public.fixtures
set fixture_type = 'Battens & Tubes'
where lower(btrim(fixture_type)) = 'wash bricks';
alter table public.fixtures enable trigger fixtures_set_updated_at;

create or replace function public.search_fixtures(search_text text)
returns setof public.fixtures
language sql
stable
security invoker
set search_path = ''
as $$
  select f.*
  from public.fixtures f
  left join public.fixture_manufacturers m on m.id = f.manufacturer_id
  where nullif(btrim(search_text), '') is not null
    and (
      strpos(lower(coalesce(f.name, '')), lower(btrim(search_text))) > 0
      or strpos(lower(coalesce(f.manufacturer, '')), lower(btrim(search_text))) > 0
      or strpos(lower(coalesce(f.fixture_type, '')), lower(btrim(search_text))) > 0
      or strpos(lower(coalesce(f.preferred_mode, '')), lower(btrim(search_text))) > 0
      or strpos(lower(coalesce(f.field_notes, '')), lower(btrim(search_text))) > 0
      or strpos(lower(coalesce(m.name, '')), lower(btrim(search_text))) > 0
      or exists (
        select 1 from unnest(coalesce(m.aliases, array[]::text[])) alias
        where strpos(lower(alias), lower(btrim(search_text))) > 0
      )
    )
  order by f.updated_at desc;
$$;

revoke all on function public.search_fixtures(text) from public, anon, authenticated;
grant execute on function public.search_fixtures(text) to authenticated;

comment on table public.fixture_manufacturers is 'Canonical, searchable Fixture manufacturer vocabulary. Editors and Admins may add records.';
comment on column public.fixtures.manufacturer is 'Legacy/denormalized manufacturer text retained for rollback, audit, and unresolved values.';
comment on column public.fixtures.manufacturer_id is 'Canonical manufacturer reference. Null means legacy text still requires manual resolution.';
comment on function public.search_fixtures(text) is 'RLS-aware Fixture search across canonical manufacturer names, aliases, and existing Fixture fields.';

commit;
