begin;
alter table public.shows
 add column producer text check (length(producer) <= 160),
 add column network_brand text check (length(network_brand) <= 160),
 add column google_photos_url text check (length(google_photos_url) <= 2048 and google_photos_url ~ '^https://(photos\.google\.com|photos\.app\.goo\.gl)([/?#]|$)'),
 add column primary_location_id uuid references public.locations(id) on delete restrict;
alter table public.locations
 add column postal_code text check (length(postal_code) <= 40),
 add column metro_area text check (length(metro_area) <= 160);
create index shows_primary_location_idx on public.shows(primary_location_id);
create index shows_production_dates_idx on public.shows(start_date desc, id);

create table public.show_stops (
 show_id uuid not null references public.shows(id) on delete cascade,
 position integer not null check (position between 0 and 99),
 location_id uuid not null references public.locations(id) on delete restrict,
 start_date date,
 end_date date,
 primary key(show_id, position),
 check (end_date is null or start_date is null or end_date >= start_date)
);
create index show_stops_location_idx on public.show_stops(location_id);
alter table public.show_stops enable row level security;
grant select, insert, update, delete on public.show_stops to authenticated;
create policy show_stops_read on public.show_stops for select to authenticated using (public.can_read_content('show',show_id));
create policy show_stops_insert on public.show_stops for insert to authenticated with check (public.can_edit_content('show',show_id) and public.can_read_content('location',location_id));
create policy show_stops_update on public.show_stops for update to authenticated using (public.can_edit_content('show',show_id)) with check (public.can_edit_content('show',show_id) and public.can_read_content('location',location_id));
create policy show_stops_delete on public.show_stops for delete to authenticated using (public.can_edit_content('show',show_id));

create function public.check_show_primary_location() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if new.primary_location_id is not null and (tg_op = 'INSERT' or new.primary_location_id is distinct from old.primary_location_id) then
  if not exists(select 1 from public.locations where id=new.primary_location_id) then raise exception 'Choose an accessible Primary Location'; end if;
 end if;
 return new;
end; $$;
create trigger shows_check_primary_location before insert or update on public.shows for each row execute function public.check_show_primary_location();

-- Invoker rights preserve Show and Location RLS; a failed stop rolls back the Show.
create function public.save_show_production(target_id uuid, fields jsonb, stops jsonb)
returns table(id uuid) language plpgsql security invoker set search_path = '' as $$
declare draft public.shows; saved_id uuid; entry jsonb; ordinal bigint;
begin
 if jsonb_typeof(stops) is distinct from 'array' or jsonb_array_length(stops) > 100 then raise exception 'Invalid stops'; end if;
 if target_id is null then
  draft := jsonb_populate_record(null::public.shows, fields);
  insert into public.shows (title,job_number,client_name,location,studio_site,location_data,start_date,end_date,summary,dropbox_url,egnyte_url,staffing_notes,staffing_calendar_url,key_personnel,status,verified_by,producer,network_brand,google_photos_url,primary_location_id,created_by)
  values (draft.title,draft.job_number,draft.client_name,draft.location,draft.studio_site,draft.location_data,draft.start_date,draft.end_date,draft.summary,draft.dropbox_url,draft.egnyte_url,draft.staffing_notes,draft.staffing_calendar_url,coalesce(draft.key_personnel,'[]'::jsonb),coalesce(draft.status,'draft'::public.content_status),draft.verified_by,draft.producer,draft.network_brand,draft.google_photos_url,draft.primary_location_id,auth.uid()) returning shows.id into saved_id;
 else
  select * into draft from public.shows where shows.id=target_id for update;
  if not found or not public.can_edit_content('show',target_id) then raise exception 'Show is not editable'; end if;
  draft := jsonb_populate_record(draft, fields);
  -- Remove old stops while the prior status is still editable (draft -> submitted).
  delete from public.show_stops where show_id=target_id;
  update public.shows set title=draft.title,job_number=draft.job_number,client_name=draft.client_name,location=draft.location,studio_site=draft.studio_site,location_data=draft.location_data,start_date=draft.start_date,end_date=draft.end_date,summary=draft.summary,dropbox_url=draft.dropbox_url,egnyte_url=draft.egnyte_url,staffing_notes=draft.staffing_notes,staffing_calendar_url=draft.staffing_calendar_url,key_personnel=draft.key_personnel,status=draft.status,verified_by=draft.verified_by,producer=draft.producer,network_brand=draft.network_brand,google_photos_url=draft.google_photos_url,primary_location_id=draft.primary_location_id where shows.id=target_id returning shows.id into saved_id;
  if saved_id is null then raise exception 'Show is not editable'; end if;
 end if;
 for entry,ordinal in select value,ordinality from jsonb_array_elements(stops) with ordinality loop
  insert into public.show_stops(show_id,position,location_id,start_date,end_date)
  values(saved_id,ordinal-1,(entry->>'location_id')::uuid,nullif(entry->>'start_date','')::date,nullif(entry->>'end_date','')::date);
 end loop;
 return query select saved_id;
end; $$;
revoke all on function public.save_show_production(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_show_production(uuid,jsonb,jsonb) to authenticated;

-- A read projection of the same Shows, never a separate archive or copied records.
create view public.show_production_history with (security_invoker=true) as
select s.*, l.name as primary_location_name, l.city as primary_city, l.region as primary_region,
 concat_ws(' ',s.title,s.job_number,s.client_name,s.producer,s.network_brand,s.summary,s.staffing_notes,s.location,s.studio_site,s.legacy_location,s.key_personnel::text,l.name,l.city,l.region,l.metro_area,
 (select string_agg(concat_ws(' ',sl.name,sl.city,sl.region,sl.metro_area),' ') from public.show_stops st join public.locations sl on sl.id=st.location_id where st.show_id=s.id),
 (select string_agg(t.name,' ') from public.content_tags ct join public.tags t on t.id=ct.tag_id where ct.entity_kind='show' and ct.entity_id=s.id)) as search_text
from public.shows s left join public.locations l on l.id=s.primary_location_id;
grant select on public.show_production_history to authenticated;
comment on column public.shows.summary is 'Existing Show notes / summary, also used for production memories and context.';
comment on column public.shows.primary_location_id is 'Canonical primary Location. Legacy city/site values remain preserved without inferred matches.';
commit;
