-- Add useful places and cocktail recipes, and simplify Napkin into a repository workflow.

begin;

update public.napkin_notes
set status = 'needs_review', assigned_to = null
where status = 'assigned';

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  kind text not null default 'studio' check (kind in ('studio', 'restaurant', 'venue', 'hotel', 'other')),
  address text check (address is null or char_length(address) <= 300),
  city text check (city is null or char_length(city) <= 120),
  region text check (region is null or char_length(region) <= 120),
  phone text check (phone is null or char_length(phone) <= 80),
  website_url text,
  map_url text,
  notes text check (notes is null or char_length(notes) <= 4000),
  status public.content_status not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drinks (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  description text check (description is null or char_length(description) <= 1000),
  ingredients text not null check (char_length(ingredients) between 1 and 4000),
  instructions text check (instructions is null or char_length(instructions) <= 4000),
  glassware text check (glassware is null or char_length(glassware) <= 120),
  garnish text check (garnish is null or char_length(garnish) <= 240),
  source_url text,
  status public.content_status not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists locations_name_idx on public.locations (lower(name));
create index if not exists locations_kind_city_idx on public.locations (kind, lower(city));
create index if not exists locations_updated_idx on public.locations (updated_at desc);
create index if not exists drinks_name_idx on public.drinks (lower(name));
create index if not exists drinks_updated_idx on public.drinks (updated_at desc);

drop trigger if exists locations_set_updated_at on public.locations;
create trigger locations_set_updated_at before update on public.locations for each row execute function public.set_updated_at();
drop trigger if exists drinks_set_updated_at on public.drinks;
create trigger drinks_set_updated_at before update on public.drinks for each row execute function public.set_updated_at();

alter table public.locations enable row level security;
alter table public.drinks enable row level security;
grant select, insert, update, delete on public.locations, public.drinks to authenticated;

create policy "locations_read" on public.locations for select to authenticated using (
  public.has_minimum_role('viewer') and (status in ('verified', 'published') or public.has_minimum_role('editor') or created_by = auth.uid())
);
create policy "locations_insert" on public.locations for insert to authenticated with check (
  created_by = auth.uid() and (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and status in ('draft', 'submitted')))
);
create policy "locations_update" on public.locations for update to authenticated
using (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and created_by = auth.uid() and status in ('draft', 'submitted')))
with check (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and created_by = auth.uid() and status in ('draft', 'submitted')));
create policy "locations_delete_admin" on public.locations for delete to authenticated using (public.has_minimum_role('admin'));

create policy "drinks_read" on public.drinks for select to authenticated using (
  public.has_minimum_role('viewer') and (status in ('verified', 'published') or public.has_minimum_role('editor') or created_by = auth.uid())
);
create policy "drinks_insert" on public.drinks for insert to authenticated with check (
  created_by = auth.uid() and (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and status in ('draft', 'submitted')))
);
create policy "drinks_update" on public.drinks for update to authenticated
using (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and created_by = auth.uid() and status in ('draft', 'submitted')))
with check (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and created_by = auth.uid() and status in ('draft', 'submitted')));
create policy "drinks_delete_admin" on public.drinks for delete to authenticated using (public.has_minimum_role('admin'));

drop policy if exists "napkin_read" on public.napkin_notes;
create policy "napkin_read" on public.napkin_notes for select to authenticated using (
  public.has_minimum_role('viewer') and (status <> 'archived' or public.has_minimum_role('editor'))
);

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
    when 'location' then exists (select 1 from public.locations x where x.id = target_id and (x.status in ('verified', 'published') or public.has_minimum_role('editor') or x.created_by = auth.uid()))
    when 'drink' then exists (select 1 from public.drinks x where x.id = target_id and (x.status in ('verified', 'published') or public.has_minimum_role('editor') or x.created_by = auth.uid()))
    when 'vendor_client' then public.has_minimum_role('editor') and exists (select 1 from public.vendor_clients x where x.id = target_id)
    when 'napkin' then exists (select 1 from public.napkin_notes x where x.id = target_id and (x.status <> 'archived' or public.has_minimum_role('editor')))
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
    when 'location' then exists (select 1 from public.locations x where x.id = target_id and (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and x.created_by = auth.uid() and x.status in ('draft', 'submitted'))))
    when 'drink' then exists (select 1 from public.drinks x where x.id = target_id and (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and x.created_by = auth.uid() and x.status in ('draft', 'submitted'))))
    when 'vendor_client' then public.has_minimum_role('editor') and exists (select 1 from public.vendor_clients x where x.id = target_id)
    when 'napkin' then exists (select 1 from public.napkin_notes x where x.id = target_id and (public.has_minimum_role('editor') or (x.created_by = auth.uid() and x.status = 'raw')))
  end;
$$;

revoke all on function public.can_read_content(public.relationship_kind, uuid) from public;
revoke all on function public.can_edit_content(public.relationship_kind, uuid) from public;
grant execute on function public.can_read_content(public.relationship_kind, uuid) to authenticated;
grant execute on function public.can_edit_content(public.relationship_kind, uuid) to authenticated;

commit;
