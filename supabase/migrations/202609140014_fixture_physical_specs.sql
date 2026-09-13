-- Nullable additions only: no historical records, timestamps, taxonomy, or RLS changes.
begin;
alter table public.fixtures
  add column weight_lb numeric,
  add column ip_rating text,
  add constraint fixtures_weight_lb_valid check (weight_lb > 0 and weight_lb <= 10000),
  add constraint fixtures_ip_rating_valid check (ip_rating in
    ('IP20','IP21','IP22','IP23','IP40','IP44','IP54','IP55','IP65','IP66','IP67'));
comment on column public.fixtures.weight_lb is 'Optional field-use weight in pounds. Positive decimal, maximum 10000 lb. GDTF kg / 0.45359237; reviewed before save.';
comment on column public.fixtures.ip_rating is 'Optional controlled ingress protection code; NULL means not specified. Not a numeric ranking.';
commit;
