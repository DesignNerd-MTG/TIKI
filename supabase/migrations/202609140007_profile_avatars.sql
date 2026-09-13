begin;

-- Private, bounded, owner-managed images. Existing profile columns are reused.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tiki-avatars','tiki-avatars',false,2097152,array['image/webp'])
on conflict(id) do nothing;
do $$ begin
  if exists(select 1 from storage.buckets where id='tiki-avatars'
    and (public is distinct from false or file_size_limit is distinct from 2097152::bigint
      or allowed_mime_types is distinct from array['image/webp'])) then
    raise exception 'Existing tiki-avatars bucket has incompatible settings';
  end if;
end $$;

-- Auth metadata seeds a new profile, but must not undo subsequent member edits
-- or resurrect a removed image when the auth email/metadata later changes.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,email,full_name,avatar_url)
  values(new.id,coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url')
  on conflict(id) do update set email=excluded.email;
  return new;
end $$;

create function public.profile_avatar_path(target_id uuid) returns text
language sql stable security definer set search_path='' as $$
  select p.avatar_url from public.profiles p
  where public.has_minimum_role('viewer') and p.active and p.id=target_id
    and p.avatar_url=p.id::text||'/avatar.webp'
$$;

create function public.set_profile_avatar(enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.has_minimum_role('viewer') then
    raise exception 'Active membership required' using errcode='42501';
  end if;
  if enabled is null then raise exception 'Avatar state required'; end if;
  if enabled and not exists(select 1 from storage.objects
    where bucket_id='tiki-avatars' and name=auth.uid()::text||'/avatar.webp') then
    raise exception 'Upload an avatar first';
  end if;
  update public.profiles set avatar_url=case when enabled then auth.uid()::text||'/avatar.webp' else null end
    where id=auth.uid();
end $$;

revoke all on function public.profile_avatar_path(uuid),public.set_profile_avatar(boolean) from public,anon;
do $$ begin
  if exists(select 1 from pg_roles where rolname='service_role') then
    revoke all on function public.profile_avatar_path(uuid),public.set_profile_avatar(boolean) from service_role;
  end if;
end $$;
grant execute on function public.profile_avatar_path(uuid),public.set_profile_avatar(boolean) to authenticated;

-- A member without social accounts must also be readable by active members.
-- Validate the path before conversion; never cast arbitrary object names to UUID.
create function public.avatar_is_shared(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select public.has_minimum_role('viewer') and exists(select 1 from public.profiles p
    where p.active and p.avatar_url=object_name and object_name=p.id::text||'/avatar.webp')
$$;
revoke all on function public.avatar_is_shared(text) from public,anon;
do $$ begin
  if exists(select 1 from pg_roles where rolname='service_role') then
    revoke all on function public.avatar_is_shared(text) from service_role;
  end if;
end $$;
grant execute on function public.avatar_is_shared(text) to authenticated;
create policy "Avatar active member read" on storage.objects for select to authenticated
using(bucket_id='tiki-avatars' and public.has_minimum_role('viewer')
  and (name=auth.uid()::text||'/avatar.webp' or public.avatar_is_shared(name)));
create policy "Avatar owner insert" on storage.objects for insert to authenticated
with check(bucket_id='tiki-avatars' and public.has_minimum_role('viewer') and name=auth.uid()::text||'/avatar.webp');
create policy "Avatar owner update" on storage.objects for update to authenticated
using(bucket_id='tiki-avatars' and public.has_minimum_role('viewer') and name=auth.uid()::text||'/avatar.webp')
with check(bucket_id='tiki-avatars' and public.has_minimum_role('viewer') and name=auth.uid()::text||'/avatar.webp');
create policy "Avatar owner delete" on storage.objects for delete to authenticated
using(bucket_id='tiki-avatars' and public.has_minimum_role('viewer') and name=auth.uid()::text||'/avatar.webp');

commit;
