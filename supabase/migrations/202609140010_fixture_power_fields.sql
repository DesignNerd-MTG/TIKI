-- Add structured fixture power metadata without replacing freeform power notes.
-- Nullable passthrough avoids guessing No for existing fixtures.
begin;

alter table public.fixtures
  add column if not exists power_input_connector text,
  add column if not exists power_passthrough boolean;

comment on column public.fixtures.power_input_connector is 'Standardized primary power input connection; variant details belong in power_note.';
comment on column public.fixtures.power_passthrough is 'Whether the fixture provides a power output for daisy chaining; null means not yet specified.';

commit;
