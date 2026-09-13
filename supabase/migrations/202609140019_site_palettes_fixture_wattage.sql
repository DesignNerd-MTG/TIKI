-- Site-wide custom appearance slots and optional Fixture wattage.
-- Prior per-user palette rows remain preserved but dormant and inaccessible.
begin;

create table if not exists public.site_custom_palettes (
  slot smallint primary key check (slot between 1 and 3),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  tokens jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_custom_palettes_tokens check (
    jsonb_typeof(tokens)='object'
    and tokens ?& array['canvas','surface','primary_accent','secondary_accent','primary_text','muted_text']
    and tokens - 'canvas' - 'surface' - 'primary_accent' - 'secondary_accent' - 'primary_text' - 'muted_text'='{}'::jsonb
    and tokens->>'canvas' ~ '^#[0-9a-fA-F]{6}$'
    and tokens->>'surface' ~ '^#[0-9a-fA-F]{6}$'
    and tokens->>'primary_accent' ~ '^#[0-9a-fA-F]{6}$'
    and tokens->>'secondary_accent' ~ '^#[0-9a-fA-F]{6}$'
    and tokens->>'primary_text' ~ '^#[0-9a-fA-F]{6}$'
    and tokens->>'muted_text' ~ '^#[0-9a-fA-F]{6}$'
  )
);

drop trigger if exists site_custom_palettes_set_updated_at on public.site_custom_palettes;
create trigger site_custom_palettes_set_updated_at before update on public.site_custom_palettes
for each row execute function public.set_updated_at();

alter table public.site_settings add column if not exists active_custom_slot smallint
  check (active_custom_slot between 1 and 3);

alter table public.fixtures add column if not exists wattage numeric;
alter table public.fixtures drop constraint if exists fixtures_wattage_valid;
alter table public.fixtures add constraint fixtures_wattage_valid check (wattage is null or wattage > 0);
comment on column public.fixtures.wattage is 'Optional explicit fixture power consumption in watts. Never inferred from other specifications.';

alter table public.site_custom_palettes enable row level security;
revoke all on table public.site_custom_palettes from anon,authenticated;
grant select,insert,update,delete on table public.site_custom_palettes to authenticated;
drop policy if exists site_custom_palettes_read on public.site_custom_palettes;
drop policy if exists site_custom_palettes_admin_insert on public.site_custom_palettes;
drop policy if exists site_custom_palettes_admin_update on public.site_custom_palettes;
drop policy if exists site_custom_palettes_admin_delete on public.site_custom_palettes;
create policy site_custom_palettes_read on public.site_custom_palettes for select to authenticated
  using(public.has_minimum_role('viewer'));
create policy site_custom_palettes_admin_insert on public.site_custom_palettes for insert to authenticated
  with check(public.has_minimum_role('admin'));
create policy site_custom_palettes_admin_update on public.site_custom_palettes for update to authenticated
  using(public.has_minimum_role('admin')) with check(public.has_minimum_role('admin'));
create policy site_custom_palettes_admin_delete on public.site_custom_palettes for delete to authenticated
  using(public.has_minimum_role('admin'));

-- Preserve the superseded data while making the old personal override path dormant.
drop policy if exists user_custom_palettes_own on public.user_custom_palettes;
drop policy if exists user_appearance_own on public.user_appearance;
revoke all on table public.user_custom_palettes,public.user_appearance from anon,authenticated;

create or replace function public.search_fixtures(search_text text)
returns setof public.fixtures
language sql stable security invoker set search_path=''
as $$
  select f.* from public.fixtures f
  left join public.fixture_manufacturers m on m.id=f.manufacturer_id
  where nullif(btrim(search_text),'') is not null and (
    strpos(lower(coalesce(f.name,'')),lower(btrim(search_text)))>0
    or strpos(lower(coalesce(f.manufacturer,'')),lower(btrim(search_text)))>0
    or strpos(lower(coalesce(f.fixture_type,'')),lower(btrim(search_text)))>0
    or strpos(lower(coalesce(f.preferred_mode,'')),lower(btrim(search_text)))>0
    or strpos(lower(coalesce(f.field_notes,'')),lower(btrim(search_text)))>0
    or strpos(lower(coalesce(f.power_input_connector,'')),lower(btrim(search_text)))>0
    or strpos(coalesce(f.wattage::text,''),btrim(search_text))>0
    or strpos(lower(coalesce(m.name,'')),lower(btrim(search_text)))>0
    or exists(select 1 from unnest(coalesce(m.aliases,array[]::text[])) alias where strpos(lower(alias),lower(btrim(search_text)))>0)
  ) order by f.updated_at desc;
$$;
revoke all on function public.search_fixtures(text) from public,anon,authenticated;
do $block$ begin if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on function public.search_fixtures(text) from service_role';
end if; end $block$;
grant execute on function public.search_fixtures(text) to authenticated;

commit;
