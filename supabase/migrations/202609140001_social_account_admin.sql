-- Social-only authorization extension. No stored rows or profile permissions change.
begin;
create function public.social_account_target_active(target_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select public.has_minimum_role('viewer')
   and (target_id = auth.uid() or public.has_minimum_role('admin'))
   and exists(select 1 from public.profiles where id = target_id and active);
$$;
revoke all on function public.social_account_target_active(uuid) from public;
grant execute on function public.social_account_target_active(uuid) to authenticated;

alter policy social_insert on public.profile_social_links
 with check(public.social_account_target_active(profile_id));
alter policy social_update on public.profile_social_links
 using(public.social_account_target_active(profile_id))
 with check(public.social_account_target_active(profile_id));
alter policy social_delete on public.profile_social_links
 using(public.social_account_target_active(profile_id));

-- Narrow admin selector; never return email or private profile/Travel columns.
create function public.social_account_targets()
returns table(profile_id uuid, display_name text)
language sql stable security definer set search_path = '' as $$
 select id, coalesce(nullif(full_name,''),'T.I.K.I. member')
 from public.profiles where active and public.has_minimum_role('admin')
 order by full_name,id;
$$;
revoke all on function public.social_account_targets() from public;
grant execute on function public.social_account_targets() to authenticated;
commit;
