-- Corrective follow-up: private, authenticated sketches attached to Napkins.

begin;

alter table public.napkin_notes
  add column if not exists sketch_path text;

alter table public.napkin_notes drop constraint if exists napkin_notes_body_check;
alter table public.napkin_notes drop constraint if exists napkin_notes_sketch_path_check;
alter table public.napkin_notes add constraint napkin_notes_body_check
  check (char_length(body) between 0 and 4000 and (char_length(btrim(body)) > 0 or sketch_path is not null));
alter table public.napkin_notes add constraint napkin_notes_sketch_path_check
  check (sketch_path is null or sketch_path = created_by::text || '/' || id::text || '.png');
create unique index if not exists napkin_notes_sketch_path_key
  on public.napkin_notes(sketch_path) where sketch_path is not null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('napkin-sketches','napkin-sketches',false,5242880,array['image/png'])
on conflict(id) do nothing;

do $block$ begin
  if exists(
    select 1 from storage.buckets where id='napkin-sketches'
      and (public is distinct from false
        or file_size_limit is distinct from 5242880::bigint
        or allowed_mime_types is distinct from array['image/png'])
  ) then raise exception 'Existing napkin-sketches bucket has incompatible settings';
  end if;
end $block$;

create or replace function public.napkin_sketch_can_read(object_name text)
returns boolean
language sql stable security definer set search_path=''
as $$
  select public.has_minimum_role('viewer') and exists(
    select 1 from public.napkin_notes n
    where n.sketch_path=object_name
      and object_name=n.created_by::text||'/'||n.id::text||'.png'
      and (n.status <> 'archived' or public.has_minimum_role('editor'))
  )
$$;

create or replace function public.napkin_sketch_can_edit(object_name text)
returns boolean
language sql stable security definer set search_path=''
as $$
  select public.has_minimum_role('viewer') and exists(
    select 1 from public.napkin_notes n
    where n.sketch_path=object_name
      and object_name=n.created_by::text||'/'||n.id::text||'.png'
      and (public.has_minimum_role('editor') or (n.created_by=auth.uid() and n.status='raw'))
  )
$$;

revoke all on function public.napkin_sketch_can_read(text),public.napkin_sketch_can_edit(text) from public,anon;
do $block$ begin if exists(select 1 from pg_roles where rolname='service_role') then
  execute 'revoke all on function public.napkin_sketch_can_read(text),public.napkin_sketch_can_edit(text) from service_role';
end if; end $block$;
grant execute on function public.napkin_sketch_can_read(text),public.napkin_sketch_can_edit(text) to authenticated;

drop policy if exists "Napkin sketch member read" on storage.objects;
create policy "Napkin sketch member read" on storage.objects for select to authenticated
using(bucket_id='napkin-sketches' and public.napkin_sketch_can_read(name));

drop policy if exists "Napkin sketch owner insert" on storage.objects;
create policy "Napkin sketch owner insert" on storage.objects for insert to authenticated
with check(
  bucket_id='napkin-sketches' and public.has_minimum_role('viewer')
  and split_part(name,'/',1)=auth.uid()::text
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$'
);

drop policy if exists "Napkin sketch editor update" on storage.objects;
create policy "Napkin sketch editor update" on storage.objects for update to authenticated
using(bucket_id='napkin-sketches' and public.napkin_sketch_can_edit(name))
with check(bucket_id='napkin-sketches' and public.napkin_sketch_can_edit(name));

drop policy if exists "Napkin sketch owner cleanup" on storage.objects;
create policy "Napkin sketch owner cleanup" on storage.objects for delete to authenticated
using(
  bucket_id='napkin-sketches' and (
    public.napkin_sketch_can_edit(name)
    or (
      public.has_minimum_role('viewer') and split_part(name,'/',1)=auth.uid()::text
      and not exists(select 1 from public.napkin_notes n where n.sketch_path=name)
    )
  )
);

commit;
