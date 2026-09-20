# Shows and production history

`/shows/archive` browses the existing Shows. It does not create Archive records or require historical productions to use the `archived` publication status. Existing Show and Location RLS policies are unchanged.

## Data

Migration `202609200001_show_production_archive.sql` adds optional Show fields `producer`, `network_brand`, `google_photos_url`, and `primary_location_id`. Google Photos remains the photo archive; only HTTPS Google Photos links are accepted. No image storage or per-Show role is added.

`show_stops` holds ordered Location references with optional start/end dates. Return visits to a Location are supported. Primary Location and stops reference canonical Locations, which retain address, city, region, country and map URL and gain optional postal code and metro area. Location deletion is restricted while referenced. Show deletion removes its stops under the existing deletion permissions.

The invoker-rights `save_show_production` function saves Show fields and stops in one transaction. Stop RLS follows the parent Show's read/edit permissions; new references require readable Locations. An invoker-rights view, `show_production_history`, resolves current Location information and searchable content without bypassing source-table RLS.

The existing summary is labeled **Show Notes / Summary** and reused for memories/context. Key Personnel, staffing notes, source links, tags, revision notes and status controls remain. Tags provide categories. Legacy city/site fields and GeoNames snapshots remain intact; ambiguous text is never automatically matched to a Location.

## Interface

Show forms group production history, working files/staffing and existing city/site information in disclosures. Primary Location stays visible; stops have ordering and date controls. Detail pages link to canonical Locations and Google Photos.

The archive shows production dates, client, producer, brand, primary location/city, people, photo links and expandable notes. It supports search, overlapping-year filtering, publication-status filtering, chronological/alphabetical/client sorting and 50-row pagination. Undated Shows remain available without a year filter. Global search uses the same RLS-aware history projection.

## Deployment and validation

Production's migration ledger contained only `202609190001` even though the earlier schema was already present. Apply only the new migration and record its version in the same transaction; do not replay older migrations using `--include-all`. Existing Show and Location data, including timestamps, were compared by ordered full-row hashes before/after application and matched.

Database tests cover preservation, atomic rollback, canonical location updates, stop order, reference deletion protection, contributor/viewer/anonymous permissions and hidden Location search privacy. Validation tests cover Google Photos host restrictions and stop dates. Run the full lint, typecheck, test and production-build scripts before publishing through GitHub → Netlify.

## Deferred

Calendar/timeline, geocoding and interactive maps, public sharing and PNG/PDF exports. The Show dates, stable Location references, ordered stop dates and canonical location metadata are the foundation. Future public pages need an explicit publication/privacy policy; the current archive stays private. Legacy location matching remains an explicit editorial action.
