-- Retire the redundant Fixtures & Firmware Reference Hub collection.
-- Preserve any existing bookmarks by returning them to the Unsorted inbox.
begin;

alter table public.link_items disable trigger links_set_updated_at;
update public.link_items
set collection_id = 'unsorted', subcollection_id = null
where collection_id = 'fixtures-firmware';
alter table public.link_items enable trigger links_set_updated_at;

delete from public.reference_collections
where id = 'fixtures-firmware';

commit;
