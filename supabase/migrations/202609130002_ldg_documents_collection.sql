-- Additional Reference Hub taxonomy only; TIKI Documents remains separate.
begin;
insert into public.reference_collections (id, name, description, parent_id, depth, parent_depth)
values (
  'ldg-ldge-documents',
  'LDG / LDGE Documents',
  'Internal company documents, forms, policies, templates, handbooks, and shared operational resources.',
  null, 0, null
)
on conflict (id) do nothing;
commit;
