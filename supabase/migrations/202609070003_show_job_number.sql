-- Add the LDG job/project number to show records without changing existing data.

begin;

alter table public.shows
add column if not exists job_number text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'shows_job_number_length_check'
      and conrelid = 'public.shows'::regclass
  ) then
    alter table public.shows
    add constraint shows_job_number_length_check
    check (job_number is null or char_length(job_number) <= 80);
  end if;
end
$$;

create index if not exists shows_job_number_idx
on public.shows (lower(job_number));

comment on column public.shows.job_number is 'LDG job or project number associated with the show.';

commit;
