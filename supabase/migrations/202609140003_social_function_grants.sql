-- Explicit least-privilege ACLs; no function definitions, policies, or data change.
begin;
revoke execute on function public.social_account_target_active(uuid), public.social_account_targets() from public, anon;
-- The application uses authenticated sessions, never service-role RPCs.
-- Some disposable PostgreSQL environments do not define this Supabase role.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke execute on function public.social_account_target_active(uuid), public.social_account_targets() from service_role';
  end if;
end;
$$;
grant execute on function public.social_account_target_active(uuid), public.social_account_targets() to authenticated;
commit;
