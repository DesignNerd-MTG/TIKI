-- One global, admin-controlled appearance preset for T.I.K.I.
-- Additive and safe: existing content rows are not modified.

begin;

create table if not exists public.site_settings (
  id text primary key check (id = 'global'),
  theme text not null default 'volcanic-sand' check (theme in ('volcanic-sand', 'lagoon', 'sunset-coral', 'palm', 'night')),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id, theme)
values ('global', 'volcanic-sand')
on conflict (id) do nothing;

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

alter table public.site_settings enable row level security;

revoke all on table public.site_settings from anon, authenticated;
grant select, update on table public.site_settings to authenticated;

drop policy if exists "site_settings_read" on public.site_settings;
drop policy if exists "site_settings_admin_update" on public.site_settings;
create policy "site_settings_read" on public.site_settings
for select to authenticated
using (public.has_minimum_role('viewer'));
create policy "site_settings_admin_update" on public.site_settings
for update to authenticated
using (public.has_minimum_role('admin'))
with check (public.has_minimum_role('admin') and id = 'global');

comment on table public.site_settings is 'Single global row for admin-controlled T.I.K.I. presentation settings.';

commit;
