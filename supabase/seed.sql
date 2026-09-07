-- Optional development examples. Run after creating and activating your first user.
-- Replace YOUR_USER_ID with the id from public.profiles before uncommenting.

/*
insert into public.fixtures (
  name, manufacturer, fixture_type, preferred_mode, dmx_footprint,
  typical_use, field_notes, status, created_by, verified_by, last_verified_at
) values (
  'Example Fixture', 'Example Manufacturer', 'LED wash', 'Extended', 32,
  'Broadcast scenic wash', 'Replace this sample with field-verified LDG information.',
  'published', 'YOUR_USER_ID', 'YOUR_USER_ID', now()
);

insert into public.link_items (label, category, url, description, status, created_by)
values (
  'Example daily portal', 'Operations', 'https://example.com',
  'Replace with the authoritative department link.', 'published', 'YOUR_USER_ID'
);
*/
