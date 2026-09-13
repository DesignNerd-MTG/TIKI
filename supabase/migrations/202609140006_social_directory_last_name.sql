-- Derived public-name keys only; retain the existing directory authorization.
-- No profile columns, stored names, Social CRUD policies or existing RPCs change.
begin;
create function public.social_directory_index()
returns table(id uuid, profile_id uuid, display_name text, label text, url text,
  last_name_key text, display_name_key text)
language sql stable security invoker set search_path = '' as $$
  select s.id,s.profile_id,s.display_name,s.label,s.url,
    lower(regexp_replace(n.name, '^.*[[:space:]]+', '')) collate "C" as last_name_key,
    lower(n.name) collate "C" as display_name_key
  from public.social_directory() s
  cross join lateral (select coalesce(nullif(regexp_replace(s.display_name,
    '^[[:space:]]+|[[:space:]]+$', '', 'g'),''),'T.I.K.I. member') as name) n
  order by last_name_key,display_name_key,s.profile_id,s.id;
$$;
revoke all on function public.social_directory_index() from public, anon;
do $$ begin
  if exists(select 1 from pg_roles where rolname='service_role') then
    execute 'revoke all on function public.social_directory_index() from service_role';
  end if;
end $$;
grant execute on function public.social_directory_index() to authenticated;
commit;
