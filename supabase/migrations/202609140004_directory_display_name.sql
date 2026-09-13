-- Explicit member-supplied public name; never read private Travel fields.
begin;
create function public.set_directory_display_name(display_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_minimum_role('viewer') then
    raise exception 'Active membership required' using errcode = '42501';
  end if;
  if display_name is null or char_length(btrim(display_name)) not between 1 and 100
     or display_name ~ '[[:cntrl:]]' then
    raise exception 'Enter a display name of 1 to 100 characters';
  end if;
  update public.profiles set full_name = btrim(display_name) where id = auth.uid();
end;
$$;
revoke all on function public.set_directory_display_name(text) from public, anon;
do $$ begin
  if exists(select 1 from pg_roles where rolname='service_role') then
    execute 'revoke all on function public.set_directory_display_name(text) from service_role';
  end if;
end $$;
grant execute on function public.set_directory_display_name(text) to authenticated;
commit;
