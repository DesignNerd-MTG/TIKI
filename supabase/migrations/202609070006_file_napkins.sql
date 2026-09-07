-- File a reviewed Napkin into a canonical, published knowledge record atomically.

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
begin
  if not public.has_minimum_role('editor') then
    raise exception 'Only Editors and Admins can approve and file Napkins.';
  end if;

  if target_kind not in ('fixture', 'show', 'link', 'document', 'location', 'drink') then
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

  if target_kind in ('link', 'document') and nullif(btrim(note_record.source_url), '') is null then
    raise exception 'Add a Source URL before filing a Napkin as a Link or Document.';
  end if;

  case target_kind
    when 'fixture' then
      insert into public.fixtures (name, field_notes, manual_url, status, created_by, verified_by, last_verified_at)
      values (clean_title, note_record.body, note_record.source_url, 'published', auth.uid(), auth.uid(), now())
      returning id into new_id;
    when 'show' then
      insert into public.shows (title, summary, primary_link, status, created_by, verified_by)
      values (clean_title, note_record.body, note_record.source_url, 'published', auth.uid(), auth.uid())
      returning id into new_id;
    when 'link' then
      insert into public.link_items (label, category, url, description, status, created_by, verified_by)
      values (clean_title, 'Filed from Napkin', note_record.source_url, note_record.body, 'published', auth.uid(), auth.uid())
      returning id into new_id;
    when 'document' then
      insert into public.documents (title, document_type, url, description, status, created_by, verified_by)
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
