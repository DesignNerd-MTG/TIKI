-- Retire the redundant "verified" state. Published is now the single approved,
-- reader-visible state; the enum value remains for PostgreSQL compatibility.

begin;

update public.fixtures set status = 'published' where status = 'verified';
update public.shows set status = 'published' where status = 'verified';
update public.link_items set status = 'published' where status = 'verified';
update public.documents set status = 'published' where status = 'verified';
update public.vendor_clients set status = 'published' where status = 'verified';
update public.locations set status = 'published' where status = 'verified';
update public.drinks set status = 'published' where status = 'verified';

alter table public.fixtures drop constraint if exists fixtures_no_verified_status;
alter table public.fixtures add constraint fixtures_no_verified_status check (status <> 'verified');
alter table public.shows drop constraint if exists shows_no_verified_status;
alter table public.shows add constraint shows_no_verified_status check (status <> 'verified');
alter table public.link_items drop constraint if exists link_items_no_verified_status;
alter table public.link_items add constraint link_items_no_verified_status check (status <> 'verified');
alter table public.documents drop constraint if exists documents_no_verified_status;
alter table public.documents add constraint documents_no_verified_status check (status <> 'verified');
alter table public.vendor_clients drop constraint if exists vendor_clients_no_verified_status;
alter table public.vendor_clients add constraint vendor_clients_no_verified_status check (status <> 'verified');
alter table public.locations drop constraint if exists locations_no_verified_status;
alter table public.locations add constraint locations_no_verified_status check (status <> 'verified');
alter table public.drinks drop constraint if exists drinks_no_verified_status;
alter table public.drinks add constraint drinks_no_verified_status check (status <> 'verified');

drop policy if exists "fixtures_read" on public.fixtures;
create policy "fixtures_read" on public.fixtures for select to authenticated using (
  public.has_minimum_role('viewer') and (status = 'published' or public.has_minimum_role('editor') or created_by = auth.uid())
);

drop policy if exists "shows_read" on public.shows;
create policy "shows_read" on public.shows for select to authenticated using (
  public.has_minimum_role('viewer') and (status = 'published' or public.has_minimum_role('editor') or created_by = auth.uid())
);

drop policy if exists "links_read" on public.link_items;
create policy "links_read" on public.link_items for select to authenticated using (
  public.has_minimum_role('viewer') and (status = 'published' or public.has_minimum_role('editor') or created_by = auth.uid())
);

drop policy if exists "documents_read" on public.documents;
create policy "documents_read" on public.documents for select to authenticated using (
  public.has_minimum_role('viewer') and (status = 'published' or public.has_minimum_role('editor') or created_by = auth.uid())
);

drop policy if exists "locations_read" on public.locations;
create policy "locations_read" on public.locations for select to authenticated using (
  public.has_minimum_role('viewer') and (status = 'published' or public.has_minimum_role('editor') or created_by = auth.uid())
);

drop policy if exists "drinks_read" on public.drinks;
create policy "drinks_read" on public.drinks for select to authenticated using (
  public.has_minimum_role('viewer') and (status = 'published' or public.has_minimum_role('editor') or created_by = auth.uid())
);

create or replace function public.can_read_content(target_kind public.relationship_kind, target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_minimum_role('viewer') and case target_kind
    when 'fixture' then exists (select 1 from public.fixtures x where x.id = target_id and (x.status = 'published' or public.has_minimum_role('editor') or x.created_by = auth.uid()))
    when 'show' then exists (select 1 from public.shows x where x.id = target_id and (x.status = 'published' or public.has_minimum_role('editor') or x.created_by = auth.uid()))
    when 'document' then exists (select 1 from public.documents x where x.id = target_id and (x.status = 'published' or public.has_minimum_role('editor') or x.created_by = auth.uid()))
    when 'link' then exists (select 1 from public.link_items x where x.id = target_id and (x.status = 'published' or public.has_minimum_role('editor') or x.created_by = auth.uid()))
    when 'location' then exists (select 1 from public.locations x where x.id = target_id and (x.status = 'published' or public.has_minimum_role('editor') or x.created_by = auth.uid()))
    when 'drink' then exists (select 1 from public.drinks x where x.id = target_id and (x.status = 'published' or public.has_minimum_role('editor') or x.created_by = auth.uid()))
    when 'vendor_client' then public.has_minimum_role('editor') and exists (select 1 from public.vendor_clients x where x.id = target_id)
    when 'napkin' then exists (select 1 from public.napkin_notes x where x.id = target_id and (x.status <> 'archived' or public.has_minimum_role('editor')))
  end;
$$;

revoke all on function public.can_read_content(public.relationship_kind, uuid) from public;
grant execute on function public.can_read_content(public.relationship_kind, uuid) to authenticated;

commit;
