-- T.I.K.I. initial schema
-- Run this migration in the Supabase SQL Editor for the first environment.

create type public.app_role as enum ('viewer', 'contributor', 'editor', 'admin');
create type public.content_status as enum ('draft', 'submitted', 'verified', 'published', 'archived');
create type public.napkin_status as enum ('raw', 'needs_review', 'assigned', 'converted', 'archived');
create type public.relationship_kind as enum ('fixture', 'show', 'document', 'link', 'vendor_client', 'napkin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role public.app_role not null default 'viewer',
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fixtures (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  manufacturer text,
  fixture_type text,
  preferred_mode text,
  dmx_footprint integer check (dmx_footprint is null or dmx_footprint > 0),
  typical_use text,
  power_note text,
  control_note text,
  field_notes text,
  dmx_chart_url text,
  manual_url text,
  status public.content_status not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  verified_by uuid references auth.users(id) on delete set null,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shows (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  client_name text,
  location text,
  start_date date,
  end_date date,
  primary_link text,
  summary text,
  status public.content_status not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.link_items (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  category text not null default 'General',
  url text not null,
  description text,
  status public.content_status not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  document_type text,
  url text not null,
  description text,
  status public.content_status not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vendor_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('vendor', 'client')),
  primary_contact text,
  notes text,
  status public.content_status not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.napkin_notes (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(body) between 1 and 4000),
  source_url text,
  urgent boolean not null default false,
  status public.napkin_status not null default 'raw',
  assigned_to uuid references auth.users(id) on delete set null,
  converted_to_kind public.relationship_kind,
  converted_to_id uuid,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique check (slug = lower(slug)),
  created_at timestamptz not null default now()
);

create table public.content_tags (
  tag_id uuid not null references public.tags(id) on delete cascade,
  entity_kind public.relationship_kind not null,
  entity_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (tag_id, entity_kind, entity_id)
);

create table public.revision_notes (
  id uuid primary key default gen_random_uuid(),
  entity_kind public.relationship_kind not null,
  entity_id uuid not null,
  summary text not null,
  source text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index fixtures_name_idx on public.fixtures (lower(name));
create index fixtures_manufacturer_idx on public.fixtures (lower(manufacturer));
create index fixtures_status_updated_idx on public.fixtures (status, updated_at desc);
create index shows_title_idx on public.shows (lower(title));
create index shows_status_date_idx on public.shows (status, start_date desc);
create index link_items_label_idx on public.link_items (lower(label));
create index documents_title_idx on public.documents (lower(title));
create index napkin_status_created_idx on public.napkin_notes (status, created_at desc);
create index revision_entity_idx on public.revision_notes (entity_kind, entity_id, created_at desc);
create index content_tags_entity_idx on public.content_tags (entity_kind, entity_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger fixtures_set_updated_at before update on public.fixtures for each row execute function public.set_updated_at();
create trigger shows_set_updated_at before update on public.shows for each row execute function public.set_updated_at();
create trigger links_set_updated_at before update on public.link_items for each row execute function public.set_updated_at();
create trigger documents_set_updated_at before update on public.documents for each row execute function public.set_updated_at();
create trigger vendors_set_updated_at before update on public.vendor_clients for each row execute function public.set_updated_at();
create trigger napkin_set_updated_at before update on public.napkin_notes for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.has_minimum_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and (
        case p.role
          when 'viewer'::public.app_role then 0
          when 'contributor'::public.app_role then 1
          when 'editor'::public.app_role then 2
          when 'admin'::public.app_role then 3
        end
      ) >= (
        case required_role
          when 'viewer'::public.app_role then 0
          when 'contributor'::public.app_role then 1
          when 'editor'::public.app_role then 2
          when 'admin'::public.app_role then 3
        end
      )
  );
$$;

revoke all on function public.has_minimum_role(public.app_role) from public;
grant execute on function public.has_minimum_role(public.app_role) to authenticated;

alter table public.profiles enable row level security;
alter table public.fixtures enable row level security;
alter table public.shows enable row level security;
alter table public.link_items enable row level security;
alter table public.documents enable row level security;
alter table public.vendor_clients enable row level security;
alter table public.napkin_notes enable row level security;
alter table public.tags enable row level security;
alter table public.content_tags enable row level security;
alter table public.revision_notes enable row level security;

grant usage on schema public to authenticated;
grant usage on type public.app_role, public.content_status, public.napkin_status, public.relationship_kind to authenticated;
grant select on public.profiles to authenticated;
grant update (role, active) on public.profiles to authenticated;
grant select, insert, update, delete on public.fixtures, public.shows, public.link_items, public.documents to authenticated;
grant select, insert, update, delete on public.vendor_clients to authenticated;
grant select, insert, update, delete on public.napkin_notes to authenticated;
grant select, insert, update, delete on public.tags, public.content_tags, public.revision_notes to authenticated;

create policy "profiles_select_self"
on public.profiles for select to authenticated
using (id = auth.uid());

create policy "profiles_admin_select_all"
on public.profiles for select to authenticated
using (public.has_minimum_role('admin'));

create policy "profiles_admin_update"
on public.profiles for update to authenticated
using (public.has_minimum_role('admin'))
with check (public.has_minimum_role('admin'));

-- Published knowledge: active users read verified/published records. Editors see the
-- working set, and contributors can see their own drafts.
create policy "fixtures_read"
on public.fixtures for select to authenticated
using (
  public.has_minimum_role('viewer')
  and (
    status in ('verified', 'published')
    or public.has_minimum_role('editor')
    or created_by = auth.uid()
  )
);

create policy "fixtures_insert"
on public.fixtures for insert to authenticated
with check (public.has_minimum_role('contributor') and created_by = auth.uid());

create policy "fixtures_update"
on public.fixtures for update to authenticated
using (
  public.has_minimum_role('editor')
  or (public.has_minimum_role('contributor') and created_by = auth.uid() and status in ('draft', 'submitted'))
)
with check (
  public.has_minimum_role('editor')
  or (public.has_minimum_role('contributor') and created_by = auth.uid())
);

create policy "fixtures_delete_admin"
on public.fixtures for delete to authenticated
using (public.has_minimum_role('admin'));

create policy "shows_read"
on public.shows for select to authenticated
using (
  public.has_minimum_role('viewer')
  and (status in ('verified', 'published') or public.has_minimum_role('editor') or created_by = auth.uid())
);

create policy "shows_insert"
on public.shows for insert to authenticated
with check (public.has_minimum_role('contributor') and created_by = auth.uid());

create policy "shows_update"
on public.shows for update to authenticated
using (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and created_by = auth.uid() and status in ('draft', 'submitted')))
with check (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and created_by = auth.uid()));

create policy "shows_delete_admin"
on public.shows for delete to authenticated
using (public.has_minimum_role('admin'));

create policy "links_read"
on public.link_items for select to authenticated
using (
  public.has_minimum_role('viewer')
  and (status in ('verified', 'published') or public.has_minimum_role('editor') or created_by = auth.uid())
);

create policy "links_insert"
on public.link_items for insert to authenticated
with check (public.has_minimum_role('contributor') and created_by = auth.uid());

create policy "links_update"
on public.link_items for update to authenticated
using (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and created_by = auth.uid() and status in ('draft', 'submitted')))
with check (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and created_by = auth.uid()));

create policy "links_delete_admin"
on public.link_items for delete to authenticated
using (public.has_minimum_role('admin'));

create policy "documents_read"
on public.documents for select to authenticated
using (
  public.has_minimum_role('viewer')
  and (status in ('verified', 'published') or public.has_minimum_role('editor') or created_by = auth.uid())
);

create policy "documents_insert"
on public.documents for insert to authenticated
with check (public.has_minimum_role('contributor') and created_by = auth.uid());

create policy "documents_update"
on public.documents for update to authenticated
using (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and created_by = auth.uid() and status in ('draft', 'submitted')))
with check (public.has_minimum_role('editor') or (public.has_minimum_role('contributor') and created_by = auth.uid()));

create policy "documents_delete_admin"
on public.documents for delete to authenticated
using (public.has_minimum_role('admin'));

-- Restricted data is enforced here, not merely hidden from navigation.
create policy "vendor_clients_editor_read"
on public.vendor_clients for select to authenticated
using (public.has_minimum_role('editor'));

create policy "vendor_clients_editor_insert"
on public.vendor_clients for insert to authenticated
with check (public.has_minimum_role('editor') and created_by = auth.uid());

create policy "vendor_clients_editor_update"
on public.vendor_clients for update to authenticated
using (public.has_minimum_role('editor'))
with check (public.has_minimum_role('editor'));

create policy "vendor_clients_admin_delete"
on public.vendor_clients for delete to authenticated
using (public.has_minimum_role('admin'));

-- Any activated user can capture. Raw notes remain visible only to their author
-- and to editors/admins until they are converted into published knowledge.
create policy "napkin_read"
on public.napkin_notes for select to authenticated
using (
  public.has_minimum_role('viewer')
  and (created_by = auth.uid() or public.has_minimum_role('editor'))
);

create policy "napkin_insert"
on public.napkin_notes for insert to authenticated
with check (public.has_minimum_role('viewer') and created_by = auth.uid());

create policy "napkin_update"
on public.napkin_notes for update to authenticated
using (public.has_minimum_role('editor') or (created_by = auth.uid() and status = 'raw'))
with check (public.has_minimum_role('editor') or created_by = auth.uid());

create policy "napkin_delete_admin"
on public.napkin_notes for delete to authenticated
using (public.has_minimum_role('admin'));

create policy "tags_read"
on public.tags for select to authenticated
using (public.has_minimum_role('viewer'));

create policy "tags_editor_write"
on public.tags for all to authenticated
using (public.has_minimum_role('editor'))
with check (public.has_minimum_role('editor'));

create policy "content_tags_read"
on public.content_tags for select to authenticated
using (public.has_minimum_role('viewer'));

create policy "content_tags_contributor_insert"
on public.content_tags for insert to authenticated
with check (public.has_minimum_role('contributor') and created_by = auth.uid());

create policy "content_tags_editor_update"
on public.content_tags for update to authenticated
using (public.has_minimum_role('editor'))
with check (public.has_minimum_role('editor'));

create policy "content_tags_editor_delete"
on public.content_tags for delete to authenticated
using (public.has_minimum_role('editor'));

create policy "revisions_read"
on public.revision_notes for select to authenticated
using (public.has_minimum_role('editor') or created_by = auth.uid());

create policy "revisions_insert"
on public.revision_notes for insert to authenticated
with check (public.has_minimum_role('contributor') and created_by = auth.uid());

create policy "revisions_admin_delete"
on public.revision_notes for delete to authenticated
using (public.has_minimum_role('admin'));

comment on table public.profiles is 'T.I.K.I. authorization profile; Supabase Auth remains the identity source.';
comment on table public.napkin_notes is 'Informal intake for useful information that is not ready to become published knowledge.';
comment on table public.vendor_clients is 'Restricted operational context. RLS requires editor or admin access.';
