-- T.I.K.I. content-management MVP authorization hardening.
-- Safe for existing data: no tables or rows are removed. This migration only adds
-- indexes/helper functions and replaces policies with stricter equivalents.

begin;

create index if not exists shows_updated_idx on public.shows (updated_at desc);
create index if not exists links_updated_idx on public.link_items (updated_at desc);
create index if not exists documents_updated_idx on public.documents (updated_at desc);
create index if not exists vendor_clients_name_idx on public.vendor_clients (lower(name));
create index if not exists vendor_clients_updated_idx on public.vendor_clients (updated_at desc);
create index if not exists tags_name_idx on public.tags (lower(name));

create or replace function public.can_read_content(target_kind public.relationship_kind, target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_minimum_role('viewer') and case target_kind
    when 'fixture' then exists (select 1 from public.fixtures x where x.id = target_id and (x.status in ('verified', 'published') or public.has_minimum_role('editor') or x.created_by = auth.uid()))
    when 'show' then exists (select 1 from public.shows x where x.id = target_id and (x.status in ('verified', 'published') or public.has_minimum_role('editor') or x.created_by = auth.uid()))
    when 'document' then exists (select 1 from public.documents x where x.id = target_id and (x.status in ('verified', 'published') or public.has_minimum_role('editor') or x.created_by = auth.uid()))
    when 'link' then exists (select 1 from public.link_items x where x.id = target_id and (x.status in ('verified', 'published') or public.has_minimum_role('editor') or x.created_by = auth.uid()))
    when 'vendor_client' then public.has_minimum_role('editor') and exists (select 1 from public.vendor_clients x where x.id = target_id)
    when 'napkin' then exists (select 1 from public.napkin_notes x where x.id = target_id and (x.created_by = auth.uid() or public.has_minimum_role('editor')))
  end;
$$;

create or replace function public.can_edit_content(target_kind public.relationship_kind, target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_minimum_role('viewer') and case target_kind
    when 'fixture' then exists (select 1 from public.fixtures x where x.id = target_id and (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and x.created_by = auth.uid() and x.status in ('draft', 'submitted'))))
    when 'show' then exists (select 1 from public.shows x where x.id = target_id and (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and x.created_by = auth.uid() and x.status in ('draft', 'submitted'))))
    when 'document' then exists (select 1 from public.documents x where x.id = target_id and (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and x.created_by = auth.uid() and x.status in ('draft', 'submitted'))))
    when 'link' then exists (select 1 from public.link_items x where x.id = target_id and (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and x.created_by = auth.uid() and x.status in ('draft', 'submitted'))))
    when 'vendor_client' then public.has_minimum_role('editor') and exists (select 1 from public.vendor_clients x where x.id = target_id)
    when 'napkin' then exists (select 1 from public.napkin_notes x where x.id = target_id and (public.has_minimum_role('editor') or (x.created_by = auth.uid() and x.status = 'raw')))
  end;
$$;

revoke all on function public.can_read_content(public.relationship_kind, uuid) from public;
revoke all on function public.can_edit_content(public.relationship_kind, uuid) from public;
grant execute on function public.can_read_content(public.relationship_kind, uuid) to authenticated;
grant execute on function public.can_edit_content(public.relationship_kind, uuid) to authenticated;

create or replace function public.set_content_tags(target_kind public.relationship_kind, target_id uuid, tag_names text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  clean_name text;
  clean_slug text;
  selected_tag_id uuid;
begin
  if not public.can_edit_content(target_kind, target_id) then
    raise exception 'Content cannot be tagged by the current user';
  end if;

  delete from public.content_tags where entity_kind = target_kind and entity_id = target_id;
  foreach clean_name in array coalesce(tag_names[1:12], array[]::text[]) loop
    clean_name := trim(regexp_replace(clean_name, '\s+', ' ', 'g'));
    clean_slug := trim(both '-' from left(regexp_replace(lower(clean_name), '[^a-z0-9]+', '-', 'g'), 50));
    if clean_name <> '' and char_length(clean_name) <= 40 and clean_slug <> '' then
      insert into public.tags (name, slug) values (clean_name, clean_slug) on conflict (slug) do nothing;
      select id into selected_tag_id from public.tags where slug = clean_slug;
      insert into public.content_tags (tag_id, entity_kind, entity_id, created_by)
      values (selected_tag_id, target_kind, target_id, auth.uid())
      on conflict do nothing;
    end if;
  end loop;
end;
$$;

revoke all on function public.set_content_tags(public.relationship_kind, uuid, text[]) from public;
grant execute on function public.set_content_tags(public.relationship_kind, uuid, text[]) to authenticated;

-- Contributors may create drafts or submissions, never self-publish. Editors retain
-- the complete workflow. created_by remains tied to the authenticated identity.
drop policy if exists "fixtures_insert" on public.fixtures;
drop policy if exists "fixtures_update" on public.fixtures;
create policy "fixtures_insert" on public.fixtures for insert to authenticated with check (
  created_by = auth.uid() and (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and status in ('draft', 'submitted')))
);
create policy "fixtures_update" on public.fixtures for update to authenticated
using (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and created_by = auth.uid() and status in ('draft', 'submitted')))
with check (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and created_by = auth.uid() and status in ('draft', 'submitted')));

drop policy if exists "shows_insert" on public.shows;
drop policy if exists "shows_update" on public.shows;
create policy "shows_insert" on public.shows for insert to authenticated with check (
  created_by = auth.uid() and (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and status in ('draft', 'submitted')))
);
create policy "shows_update" on public.shows for update to authenticated
using (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and created_by = auth.uid() and status in ('draft', 'submitted')))
with check (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and created_by = auth.uid() and status in ('draft', 'submitted')));

drop policy if exists "links_insert" on public.link_items;
drop policy if exists "links_update" on public.link_items;
create policy "links_insert" on public.link_items for insert to authenticated with check (
  created_by = auth.uid() and (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and status in ('draft', 'submitted')))
);
create policy "links_update" on public.link_items for update to authenticated
using (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and created_by = auth.uid() and status in ('draft', 'submitted')))
with check (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and created_by = auth.uid() and status in ('draft', 'submitted')));

drop policy if exists "documents_insert" on public.documents;
drop policy if exists "documents_update" on public.documents;
create policy "documents_insert" on public.documents for insert to authenticated with check (
  created_by = auth.uid() and (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and status in ('draft', 'submitted')))
);
create policy "documents_update" on public.documents for update to authenticated
using (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and created_by = auth.uid() and status in ('draft', 'submitted')))
with check (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and created_by = auth.uid() and status in ('draft', 'submitted')));

drop policy if exists "vendor_clients_editor_insert" on public.vendor_clients;
create policy "vendor_clients_editor_insert" on public.vendor_clients for insert to authenticated
with check (public.has_minimum_role('editor') and created_by = auth.uid());

drop policy if exists "napkin_insert" on public.napkin_notes;
drop policy if exists "napkin_update" on public.napkin_notes;
create policy "napkin_insert" on public.napkin_notes for insert to authenticated
with check (public.has_minimum_role('viewer') and created_by = auth.uid() and status = 'raw');
create policy "napkin_update" on public.napkin_notes for update to authenticated
using (public.has_minimum_role('editor') or (created_by = auth.uid() and status = 'raw'))
with check (public.has_minimum_role('editor') or (created_by = auth.uid() and status in ('raw', 'archived')));

drop policy if exists "tags_editor_write" on public.tags;
drop policy if exists "tags_read" on public.tags;
drop policy if exists "tags_insert" on public.tags;
drop policy if exists "tags_editor_update" on public.tags;
drop policy if exists "tags_editor_delete" on public.tags;
create policy "tags_read" on public.tags for select to authenticated using (public.has_minimum_role('viewer'));
create policy "tags_insert" on public.tags for insert to authenticated with check (public.has_minimum_role('viewer'));
create policy "tags_editor_update" on public.tags for update to authenticated using (public.has_minimum_role('editor')) with check (public.has_minimum_role('editor'));
create policy "tags_editor_delete" on public.tags for delete to authenticated using (public.has_minimum_role('editor'));

drop policy if exists "content_tags_read" on public.content_tags;
drop policy if exists "content_tags_contributor_insert" on public.content_tags;
drop policy if exists "content_tags_editor_update" on public.content_tags;
drop policy if exists "content_tags_editor_delete" on public.content_tags;
drop policy if exists "content_tags_insert" on public.content_tags;
drop policy if exists "content_tags_delete" on public.content_tags;
create policy "content_tags_read" on public.content_tags for select to authenticated using (public.can_read_content(entity_kind, entity_id));
create policy "content_tags_insert" on public.content_tags for insert to authenticated with check (created_by = auth.uid() and public.can_edit_content(entity_kind, entity_id));
create policy "content_tags_delete" on public.content_tags for delete to authenticated using (public.has_minimum_role('admin') or public.can_edit_content(entity_kind, entity_id));

drop policy if exists "revisions_read" on public.revision_notes;
drop policy if exists "revisions_insert" on public.revision_notes;
create policy "revisions_read" on public.revision_notes for select to authenticated using (public.can_read_content(entity_kind, entity_id));
create policy "revisions_insert" on public.revision_notes for insert to authenticated with check (created_by = auth.uid() and public.can_edit_content(entity_kind, entity_id));

comment on function public.can_read_content(public.relationship_kind, uuid) is 'Polymorphic visibility check used by tags and revision-note RLS.';
comment on function public.can_edit_content(public.relationship_kind, uuid) is 'Polymorphic edit check used by content-management RLS.';
comment on function public.set_content_tags(public.relationship_kind, uuid, text[]) is 'Atomically replaces tags on one editable T.I.K.I. record.';

commit;
