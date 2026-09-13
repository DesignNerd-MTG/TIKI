-- Separate index RPC: preserve global search and sort before pagination.
begin;
create function public.search_reference_index(search_text text default '', selected_collection text default null,
  selected_subcollection text default null, archived boolean default false, page_offset integer default 0,
  sort_order text default 'title-asc')
returns setof public.link_items language sql stable security invoker set search_path = '' as $$
  select l.* from public.link_items l
  join public.reference_collections c on c.id = l.collection_id
  left join public.reference_collections s on s.id = l.subcollection_id
  where public.has_minimum_role('viewer')
    and (case when archived then l.status = 'archived' else l.status <> 'archived' end)
    and (selected_collection is null or l.collection_id = selected_collection)
    and (selected_subcollection is null or l.subcollection_id = selected_subcollection)
    and (coalesce(search_text,'') = '' or strpos(lower(concat_ws(' ',l.label,l.url,l.site_name,
      l.fetched_title,l.description,l.category,c.name,s.name)),lower(left(search_text,100))) > 0
      or exists (select 1 from public.content_tags ct join public.tags t on t.id = ct.tag_id
        where ct.entity_kind = 'link' and ct.entity_id = l.id
          and strpos(lower(t.name),lower(left(search_text,100))) > 0))
  order by
    case when sort_order = 'newest' then l.date_added end desc nulls last,
    case when sort_order = 'oldest' then l.date_added end asc nulls last,
    case when sort_order = 'title-desc' then lower(btrim(l.label)) end collate "C" desc,
    lower(btrim(l.label)) collate "C" asc, l.id asc
  limit 51 offset greatest(0,least(page_offset,100000));
$$;
revoke all on function public.search_reference_index(text,text,text,boolean,integer,text) from public, anon;
do $$ begin
  if exists(select 1 from pg_roles where rolname='service_role') then
    execute 'revoke all on function public.search_reference_index(text,text,text,boolean,integer,text) from service_role';
  end if;
end $$;
grant execute on function public.search_reference_index(text,text,text,boolean,integer,text) to authenticated;
commit;
