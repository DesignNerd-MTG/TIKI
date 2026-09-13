-- Reference Hub: additive evolution of link_items; existing URLs/roles/resources survive.
begin;
create table public.reference_collections (
  id text primary key,
  name text not null,
  description text not null,
  parent_id text,
  depth integer not null,
  parent_depth integer,
  unique (id, depth),
  unique (id, parent_id),
  check ((depth = 0 and parent_id is null and parent_depth is null) or
         (depth = 1 and parent_id is not null and parent_depth = 0)),
  foreign key (parent_id, parent_depth) references public.reference_collections(id, depth)
);
insert into public.reference_collections (id,name,description,parent_id,depth,parent_depth) values
('control-systems', 'Control Systems', 'Consoles, nodes, manufacturer software, firmware, networking tools, and ecosystem-specific resources.', null, 0, null),
('consoles', 'Consoles', 'Console hardware, platform resources, support pages, and system-specific references.', 'control-systems', 1, 0),
('nodes-networking', 'Nodes & Networking', 'Gateways, nodes, network processors, protocols, and infrastructure resources.', 'control-systems', 1, 0),
('manufacturer-downloads', 'Manufacturer Software / Downloads', 'Official software, offline editors, configurators, firmware tools, and download pages.', 'control-systems', 1, 0),
('fixtures-firmware', 'Fixtures & Firmware', 'Fixture families, firmware resources, manufacturer tools, and general fixture-reference material.', null, 0, null),
('drafting', 'Drafting', 'Vectorworks, CAD, plugins, templates, symbols, and drafting workflow resources.', null, 0, null),
('technical-reference', 'Technical Reference', 'Charts, symbols, standards, reference sheets, and technical information that does not belong to a specific system.', null, 0, null),
('software-utilities', 'Software / Web Utilities', 'Standalone apps and web tools for troubleshooting, testing, conversion, capture, and field utility.', null, 0, null),
('useful-products', 'Useful Products', 'Physical tools, adapters, hardware, and oddball products worth remembering.', null, 0, null),
('press-room', 'Press Room', 'Articles, interviews, features, and coverage about LDG, the team, or our work.', null, 0, null),
('inspiration', 'Inspiration', 'Visual references, clever ideas, interesting work, and things worth saving for creative reference.', null, 0, null),
('bucket-fun', 'Bucket o’ Fun', 'Weird, funny, frivolous, or otherwise delightful things that deserve to survive.', null, 0, null),
('unsorted', 'Unsorted', 'Stuff worth saving before anyone decides where it belongs.', null, 0, null);
alter table public.reference_collections enable row level security;
grant select on public.reference_collections to authenticated;
create policy reference_collections_read on public.reference_collections for select to authenticated
using (public.has_minimum_role('viewer'));
-- Taxonomy changes are migration-owned, preventing hierarchy races through client writes.

alter table public.link_items
  add column collection_id text not null default 'unsorted',
  add column collection_depth integer not null default 0 check (collection_depth = 0),
  add column subcollection_id text,
  add column date_added timestamptz,
  add column site_name text,
  add column fetched_title text,
  add column favicon_url text,
  add column preview_image_url text,
  add column last_checked_at timestamptz,
  add column link_health text not null default 'could_not_verify'
    check (link_health in ('healthy','redirected','could_not_verify','unavailable')),
  add column final_url text,
  add column import_source text unique,
  add constraint reference_top_collection foreign key (collection_id, collection_depth)
    references public.reference_collections(id, depth),
  add constraint reference_subcollection foreign key (subcollection_id, collection_id)
    references public.reference_collections(id, parent_id);
-- Do not rewrite created_at or the legacy category. Preserve native history.
update public.link_items set date_added = created_at where date_added is null;
alter table public.link_items alter column date_added set default now(), alter column date_added set not null;
update public.link_items set collection_id = case category
  when 'Fixtures & Firmware' then 'fixtures-firmware'
  when 'Consoles/Nodes/Software' then 'control-systems'
  when 'Reference' then 'technical-reference' when 'Drafting' then 'drafting'
  when 'Misc' then 'bucket-fun' when 'Articles' then 'press-room'
  when 'Inspiration' then 'inspiration' when 'Utility' then 'software-utilities'
  when 'Useful Products' then 'useful-products' else 'unsorted' end;
create index reference_collection_date_idx on public.link_items(collection_id, date_added desc);
create index reference_subcollection_idx on public.link_items(subcollection_id);
comment on column public.link_items.date_added is 'Original source date for imports; created_at for native references.';
comment on column public.link_items.import_source is 'Stable Notion page identity; unique, never derived from a guessed URL.';

-- Search stays SECURITY INVOKER so existing link/tag RLS applies.
create function public.search_references(search_text text default '', selected_collection text default null,
  selected_subcollection text default null, archived boolean default false, page_offset integer default 0)
returns setof public.link_items language sql stable security invoker set search_path = '' as $$
  select l.* from public.link_items l
  join public.reference_collections c on c.id = l.collection_id
  left join public.reference_collections s on s.id = l.subcollection_id
  where (case when archived then l.status = 'archived' else l.status <> 'archived' end)
    and (selected_collection is null or l.collection_id = selected_collection)
    and (selected_subcollection is null or l.subcollection_id = selected_subcollection)
    and (coalesce(search_text,'') = '' or strpos(lower(concat_ws(' ',l.label,l.url,l.site_name,
      l.fetched_title,l.description,l.category,c.name,s.name)),lower(left(search_text,100))) > 0
      or exists (select 1 from public.content_tags ct join public.tags t on t.id = ct.tag_id
        where ct.entity_kind = 'link' and ct.entity_id = l.id
          and strpos(lower(t.name),lower(left(search_text,100))) > 0))
  order by l.date_added desc, l.id limit 51 offset greatest(0,least(page_offset,100000));
$$;
create function public.reference_collection_counts()
returns table(collection_id text, subcollection_id text, reference_count bigint)
language sql stable security invoker set search_path = '' as $$
 select l.collection_id,l.subcollection_id,count(*) from public.link_items l
 where l.status <> 'archived' group by l.collection_id,l.subcollection_id;
$$;
revoke all on function public.search_references(text,text,text,boolean,integer) from public;
revoke all on function public.reference_collection_counts() from public;
grant execute on function public.search_references(text,text,text,boolean,integer) to authenticated;
grant execute on function public.reference_collection_counts() to authenticated;

-- Separate profile-owned social links; never mixed with bookmark search or private travel data.
create table public.profile_social_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 80),
  url text not null check (char_length(url) <= 2048 and url ~ '^https?://[^[:space:]]+$'),
  created_at timestamptz not null default now()
);
create index profile_social_links_owner_idx on public.profile_social_links(profile_id);
alter table public.profile_social_links enable row level security;
grant select,insert,update,delete on public.profile_social_links to authenticated;
create policy social_read on public.profile_social_links for select to authenticated using(public.has_minimum_role('viewer'));
create policy social_insert on public.profile_social_links for insert to authenticated with check(public.has_minimum_role('viewer') and profile_id=auth.uid());
create policy social_update on public.profile_social_links for update to authenticated using(public.has_minimum_role('viewer') and profile_id=auth.uid()) with check(public.has_minimum_role('viewer') and profile_id=auth.uid());
create policy social_delete on public.profile_social_links for delete to authenticated using(public.has_minimum_role('viewer') and profile_id=auth.uid());
-- Return only intentionally public identity, never email, role, activation or travel details.
create function public.social_directory()
returns table(id uuid, profile_id uuid, display_name text, label text, url text)
language sql stable security definer set search_path = '' as $$
 select s.id,s.profile_id,coalesce(nullif(p.full_name,''),'T.I.K.I. member'),s.label,s.url
 from public.profile_social_links s join public.profiles p on p.id=s.profile_id
 where p.active and public.has_minimum_role('viewer') order by p.full_name,s.created_at;
$$;
revoke all on function public.social_directory() from public;
grant execute on function public.social_directory() to authenticated;

-- Admin-only atomic import: conflict means skip, never overwrite an edited TIKI reference.
create function public.import_notion_references(records jsonb)
returns table(source_id text, outcome text)
language plpgsql security invoker set search_path = '' as $$
declare r jsonb; new_id uuid;
begin
 if not public.has_minimum_role('admin') then raise exception 'Administrator access required'; end if;
 if jsonb_typeof(records) <> 'array' or jsonb_array_length(records) > 100 then raise exception 'Expected at most 100 records'; end if;
 for r in select value from jsonb_array_elements(records) loop
  if coalesce(r->>'import_source','') !~ '^notion:[0-9a-f]{32}$' or
     coalesce(r->>'url','') !~ '^https?://[^[:space:]]+$' or char_length(r->>'url') > 2048 or
     coalesce(trim(r->>'label'),'') = '' or char_length(r->>'label') > 160 or
     r->>'date_added' is null then raise exception 'Invalid import record'; end if;
  new_id := null;
  insert into public.link_items(label,url,description,category,collection_id,subcollection_id,
    date_added,import_source,created_by,status,site_name,fetched_title,favicon_url,preview_image_url,
    last_checked_at,link_health,final_url)
  values(r->>'label',r->>'url',r->>'description',r->>'category',r->>'collection_id',
    nullif(r->>'subcollection_id',''),(r->>'date_added')::timestamptz,r->>'import_source',auth.uid(),'draft',
    r->>'site_name',r->>'fetched_title',r->>'favicon_url',r->>'preview_image_url',
    (r->>'last_checked_at')::timestamptz,coalesce(r->>'link_health','could_not_verify'),r->>'final_url')
  on conflict (import_source) do nothing returning id into new_id;
  if new_id is not null then
   perform public.set_content_tags('link',new_id,array(select jsonb_array_elements_text(coalesce(r->'tags','[]'::jsonb))));
   insert into public.revision_notes(entity_kind,entity_id,summary,created_by)
     values('link',new_id,'Imported from ' || (r->>'import_source'),auth.uid());
  end if;
  source_id := r->>'import_source';
  outcome := case when new_id is null then 'already_imported' else 'imported' end;
  return next;
 end loop;
end;
$$;
revoke all on function public.import_notion_references(jsonb) from public;
grant execute on function public.import_notion_references(jsonb) to authenticated;
commit;
