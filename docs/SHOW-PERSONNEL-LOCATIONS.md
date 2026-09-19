# Show personnel and locations

Apply `supabase/migrations/202609190001_show_personnel_locations.sql` to the
target Supabase project before deploying this app version through the existing
GitHub/Netlify workflow. Use the normal migration process (or run that migration
file once in Supabase's SQL editor). No new secrets, paid APIs, or environment
variables are required. This update does not itself apply a live migration.

## Storage and legacy behavior

- `shows.key_personnel`: validated JSONB array of structured records, each with
  a stable UUID, role, name, company, email, phone, notes, primary flag and
  zero-based position. An empty array is valid. Writes are atomic with the Show,
  using its existing RLS and auth rules. A GIN index allows future structured
  lookups; no global contact directory is introduced.
- `shows.location_data`: nullable GeoNames city snapshot with source ID, city,
  region, country, country code, display name and coordinates. The save action
  resolves the selected ID against the server catalog, ignoring client labels.
- `shows.location`: remains the display string. Existing values stay verbatim;
  unchanged legacy values also remain valid when they exceed today's form limit.
  Legacy/manual text has no normalized snapshot and is visibly identified in
  the editor. Manual entry is an explicit alternative to city search.
- `shows.studio_site`: independent optional free text, labeled **Studio / Site**.
- `shows.legacy_location`: verbatim backup of the original location, visible in
  the editor and on the detail page after the current location changes. The
  migration does not infer a city or venue or change existing timestamps. Edit
  the active Location/Studio fields to normalize the Show; the backup remains.

## City source

The committed local catalog contains 31,644 current populated places from
GeoNames `cities15000`, joined to its country and administrative-region data.
It excludes explicit neighborhood sections, historical/abandoned records,
businesses, venues, addresses and other non-populated-place feature classes.
It covers larger cities and administrative capitals, not every municipality.
Unlisted municipalities can use manual entry. NYC and Vegas aliases are included.

See `src/data/README.md` for attribution, licensing, tuple format and the optional
refresh script. Searches run on the authenticated server route; the full catalog
does not ship in the browser bundle and needs no runtime provider connection.

## UI and integration

- `show-personnel-editor.tsx`: repeatable controls immediately above Additional
  show links, with preset/custom roles, add/remove, primary flags and move buttons.
- `show-location-editor.tsx`: debounced, keyboard-accessible city suggestions,
  recognized-city indicator, explicit manual mode and original-location backup.
- `show-personnel-details.tsx`: compact rows, primary contacts first, then saved
  user order. Email and telephone links remain available at mobile widths.
- Shared content editor, detail page, save action, validation, metadata and global
  search integrate the new fields. Site and original location remain searchable.
  Staffing Calendar, both additional-link sections, Status and other fields remain.

## Verification

`tests/show-details.test.mjs` covers optional empty creation, personnel validation,
custom roles, primary/order round trips, removal, canonical city lookup, aliases,
venue exclusion, manual mode and legacy handling. `show-details-database.test.mjs`
applies the migration to PostgreSQL via PGlite and checks preservation, constraints,
atomic writes, persistence and unchanged RLS behavior.

Browser verification used the real editor components in a temporary local test
page at desktop and 390px frame widths. It exercised add/remove/reorder, presets,
custom roles, primary state, keyboard city selection, manual mode, and retention
after an unauthenticated save failure. City responses in that isolated page used
fixtures from the real catalog. There was no mobile horizontal overflow. The
temporary page was removed. Authenticated production CRUD remains a post-migration
deployment smoke check; no live Show records were modified for testing.
