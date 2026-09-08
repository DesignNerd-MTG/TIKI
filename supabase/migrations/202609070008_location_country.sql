-- Add international country support to Locations while keeping US capture fast.

alter table public.locations
  add column if not exists country text not null default 'US'
  check (country ~ '^[A-Z]{2}$');

create index if not exists locations_country_city_idx
  on public.locations (country, lower(city), lower(name));
