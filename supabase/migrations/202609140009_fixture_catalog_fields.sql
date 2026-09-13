-- Add the dedicated IES resource and support fixture catalog sorting.
-- Existing fixture names, types, records, and links remain unchanged.
begin;

alter table public.fixtures
  add column if not exists ies_url text;

create index if not exists fixtures_type_name_idx
  on public.fixtures (fixture_type, name);

comment on column public.fixtures.ies_url is 'HTTP(S) link to the fixture IES photometric file or its canonical download page.';

commit;
