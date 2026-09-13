-- Preserve Documents as References; retain all legacy rows for recovery.
begin;
lock table public.documents in share row exclusive mode;
lock table public.link_items in share row exclusive mode;
-- Only newly inserted identities get copied metadata; reruns never overwrite human edits.
create temporary table document_reference_batch(source_id uuid, reference_id uuid) on commit drop;
do $$
declare d public.documents%rowtype; new_id uuid;
begin
 for d in select * from public.documents order by id loop
  if length(btrim(d.title)) not between 1 and 160 or length(d.url)>2048
    or d.url !~ '^https?://[^/?#@[:space:]]+([/?#][^[:space:]]*)?$'
    or coalesce(length(d.description),0)>2000 or coalesce(length(d.document_type),0)>100 then
   raise warning 'Unresolved Document %: incompatible fields; original retained', d.id;
   continue;
  end if;
  new_id := null;
  insert into public.link_items(label,url,description,category,collection_id,date_added,
    created_at,updated_at,created_by,verified_by,status,import_source)
  values(d.title,d.url,d.description,coalesce(nullif(d.document_type,''),'Legacy Document'),
    'ldg-ldge-documents',d.created_at,d.created_at,d.updated_at,d.created_by,d.verified_by,
    d.status,'document:' || d.id::text)
  on conflict(import_source) do nothing returning id into new_id;
  if new_id is not null then
   insert into document_reference_batch values(d.id,new_id);
  end if;
 end loop;
end;
$$;
insert into public.content_tags(tag_id,entity_kind,entity_id,created_by,created_at)
select t.tag_id,'link',b.reference_id,t.created_by,t.created_at
from public.content_tags t join document_reference_batch b on t.entity_id=b.source_id
where t.entity_kind='document' on conflict do nothing;
insert into public.revision_notes(entity_kind,entity_id,summary,source,created_by,created_at)
select 'link',b.reference_id,r.summary,r.source,r.created_by,r.created_at
from public.revision_notes r join document_reference_batch b on r.entity_id=b.source_id
where r.entity_kind='document';
-- Legacy Napkin destination IDs remain unchanged: /documents/[id] resolves the source identity.
-- SQL editor inventory after rollout: every source must have a link or be reported unresolved.
-- Retire direct client writes without deleting records or disabling recovery SELECT.
revoke insert,update,delete on public.documents from authenticated;
create or replace function public.file_napkin(
  note_id uuid,
  target_kind public.relationship_kind,
  record_title text,
  review_note text default null
)
returns table(entity_kind public.relationship_kind, entity_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  note_record public.napkin_notes%rowtype;
  new_id uuid;
  clean_title text := btrim(record_title);
  approval_summary text;
  is_dropbox_link boolean;
  is_egnyte_link boolean;
begin
  if not public.has_minimum_role('editor') then
    raise exception 'Only Editors and Admins can approve and file Napkins.';
  end if;

  if target_kind not in ('fixture', 'show', 'link', 'location', 'drink') then
    raise exception 'Choose a supported filing destination.';
  end if;

  if clean_title = '' or char_length(clean_title) > 160 then
    raise exception 'The filed record needs a title between 1 and 160 characters.';
  end if;

  if review_note is not null and char_length(review_note) > 500 then
    raise exception 'The approval note must be 500 characters or fewer.';
  end if;

  select * into note_record
  from public.napkin_notes
  where id = note_id
  for update;

  if not found then
    raise exception 'That Napkin could not be found.';
  end if;

  if note_record.status = 'converted' then
    raise exception 'This Napkin is already filed.';
  end if;

  if note_record.status = 'archived' then
    raise exception 'Restore this Napkin before filing it.';
  end if;

  if target_kind = 'link' and nullif(btrim(note_record.source_url), '') is null then
    raise exception 'Add a Source URL before filing a Napkin as a Link.';
  end if;

  is_dropbox_link := coalesce(note_record.source_url ~* '^https?://([a-z0-9-]+\.)*dropbox\.com([/:?#]|$)', false);
  is_egnyte_link := coalesce(note_record.source_url ~* '^https?://([a-z0-9-]+\.)*egnyte\.com([/:?#]|$)', false);

  case target_kind
    when 'fixture' then
      insert into public.fixtures (name, field_notes, manual_url, status, created_by, verified_by, last_verified_at)
      values (clean_title, note_record.body, note_record.source_url, 'published', auth.uid(), auth.uid(), now())
      returning id into new_id;
    when 'show' then
      insert into public.shows (title, summary, primary_link, dropbox_url, egnyte_url, status, created_by, verified_by)
      values (
        clean_title,
        note_record.body,
        note_record.source_url,
        case when is_dropbox_link then note_record.source_url end,
        case when is_egnyte_link then note_record.source_url end,
        'published',
        auth.uid(),
        auth.uid()
      )
      returning id into new_id;
    when 'link' then
      insert into public.link_items (label, category, url, description, status, created_by, verified_by)
      values (clean_title, 'Filed from Napkin', note_record.source_url, note_record.body, 'published', auth.uid(), auth.uid())
      returning id into new_id;
    when 'location' then
      insert into public.locations (name, kind, website_url, notes, status, created_by, verified_by)
      values (clean_title, 'other', note_record.source_url, note_record.body, 'published', auth.uid(), auth.uid())
      returning id into new_id;
    when 'drink' then
      insert into public.drinks (name, description, ingredients, source_url, status, created_by, verified_by)
      values (clean_title, 'Filed from a T.I.K.I. Napkin.', note_record.body, note_record.source_url, 'published', auth.uid(), auth.uid())
      returning id into new_id;
  end case;

  if target_kind = 'show'
    and nullif(btrim(note_record.source_url), '') is not null
    and not is_dropbox_link
    and not is_egnyte_link then
    insert into public.additional_links (entity_kind, entity_id, section, label, url, sort_order, created_by)
    values ('show', new_id, 'show_files', 'Legacy Show Link', note_record.source_url, 0, auth.uid());
  end if;

  insert into public.content_tags (tag_id, entity_kind, entity_id, created_by)
  select ct.tag_id, target_kind, new_id, auth.uid()
  from public.content_tags ct
  where ct.entity_kind = 'napkin' and ct.entity_id = note_id
  on conflict do nothing;

  update public.napkin_notes
  set status = 'converted', converted_to_kind = target_kind, converted_to_id = new_id
  where id = note_id;

  approval_summary := coalesce(nullif(btrim(review_note), ''), 'Approved and filed as ' || initcap(replace(target_kind::text, '_', ' ')) || '.');
  insert into public.revision_notes (entity_kind, entity_id, summary, source, created_by)
  values
    ('napkin', note_id, approval_summary, 'Approve & File', auth.uid()),
    (target_kind, new_id, 'Created from a reviewed T.I.K.I. Napkin.', 'Approve & File', auth.uid());

  return query select target_kind, new_id;
end;
$$;

revoke all on function public.file_napkin(uuid, public.relationship_kind, text, text) from public;
grant execute on function public.file_napkin(uuid, public.relationship_kind, text, text) to authenticated;
commit;
