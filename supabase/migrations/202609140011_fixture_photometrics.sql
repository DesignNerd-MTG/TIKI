-- Give fixture records a first-class link to published photometric data.
-- Existing fixture records and additional links remain unchanged.
begin;

alter table public.fixtures
  add column if not exists photometrics_url text;

comment on column public.fixtures.photometrics_url is 'HTTP(S) link to manufacturer or verified fixture photometric data.';

commit;
