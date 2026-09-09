-- Add an optional traveler name without invalidating existing private profiles.

alter table public.travel_profiles
  add column if not exists name text
  check (name is null or char_length(name) <= 160);
