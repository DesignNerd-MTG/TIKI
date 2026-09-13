# Reference Hub — issue #1

Implementation branch: `feature/reference-hub`. The existing `link_items` table, `/links` URLs, shared editor, tags, revisions, publication workflow, and archive/delete controls remain the foundation. No production migration or import is performed by building this branch.

## Database rollout

Apply `supabase/migrations/202609130001_reference_hub.sql` after the existing migration chain, first to a disposable/staging database. The automated tests execute the complete chain against local PostgreSQL (PGlite) without any cloud credentials.

The migration is transactional and additive:

- Seeds ten top-level collections and the three Control Systems subcollections specified in issue #1. Composite foreign keys and depth constraints reject deeper nesting and mismatched parent/child references. Taxonomy is migration-owned, not end-user editable.
- Adds `collection_id`, optional `subcollection_id`, `date_added`, fetched metadata, health/check time, final URL, and a unique `import_source` to `link_items`.
- Backfills Date Added from `created_at`; maps known legacy categories without removing the original category or record URL. Unknown legacy categories land in Unsorted and remain searchable through the retained category. The next reference edit derives category from the chosen collection.
- Adds RLS-respecting reference search/count functions. Existing content RLS remains in force.
- Adds profile-owned social links and a narrowly scoped directory function returning only public display name, profile ID, label, and URL. It does not broaden profile-table access or expose email/private Travel details.
- Adds an admin-only, transactional import function. Unique source identity prevents duplicates, including concurrent submissions. Tags and import revision notes are committed with the reference, or the entire batch rolls back.

No paid Supabase features, service-role keys, storage buckets, new environment variables, scheduled jobs, or permanent Notion integration are required. Deploy the application only after its database migration is applied; otherwise the hub reports a database setup notice. This SQL is a migration, not a repeatedly runnable seed script. If the application must be rolled back, leave the additive database columns/tables in place rather than deleting content.

The reviewed forward migration preserves exact historical `updated_at` values by disabling only `links_set_updated_at` during the locked, transactional backfill and re-enabling it before commit. Future edits still fire the normal trigger. Child collections explicitly require a non-null `parent_depth` of zero, including when inserted outside the interface. This is the clean forward path for a database that has not yet received the migration; it does not repair previously overwritten timestamps.

## Using the hub

- Open `/links` for collections, counts, an Unsorted inbox, reference-only search, and recent reference cards. Collection/subcollection filters use query parameters so existing `/links/[id]` links stay valid. Lists paginate in batches of 50.
- Paste a URL into **Add Reference** and save. Title defaults to the hostname, collection to Unsorted, and Date Added to now. Metadata success is never required to save. Explicit title/notes/tags remain editable.
- Reference cards show available preview/favicon/site metadata, title, collection, tags, Date Added, health, and Last Checked. The detail page retains the shared editor, revisions, archive/delete controls, and shows the final checked destination.
- Editors/admins manage content; contributors create and edit their own draft/submitted references; viewers read published references. **Recheck Link** follows the same edit permission and uses an optimistic update so a check cannot overwrite a reference edited while the request was running. A failed revision write is reported separately from a successful check.
- Date Added is a timezone-bearing ISO timestamp, separate from record creation/update timestamps. Leaving it blank on an existing record preserves the stored date. The importer always requires the historical source date.
- `/links/social` lets each active user manage repeated Label + URL pairs attached to their own profile. These are public to active T.I.K.I. members, not public to the internet, and are not reference bookmarks. Other users, including admins, cannot impersonate a profile owner through these controls/policies.

Global search uses the same RLS-aware reference search function and includes title, original URL, site name, fetched title, notes, collections/subcollections, legacy category, and tags. Existing Travel search remains limited to the existing profile-name behavior; no preference/detail fields were added. Record-owned Show/Fixture links, auth, Napkin workflows, PWA behavior, and unrelated modules are unchanged.

## Link checking and remote images

Checks run server-side on explicit create/save/recheck and one-time import, never on a schedule. Each check permits HTTP(S) only, standard HTTP(S) ports, at most three redirects, a seven-second total deadline including DNS, and a 512 KiB response limit. It rejects credentials in URLs, local/metadata hostnames, private/reserved IPv4 and IPv6, mapped addresses, and mixed public/private DNS answers. Every redirect is resolved and validated again. The actual socket uses a pinned validated IP while retaining the original TLS hostname; there is no second DNS lookup/rebinding window, proxy environment handling, or forwarding of cookies/credentials.

Normal HTML title/favicon and Open Graph/Twitter metadata are parsed as bounded inert strings, never executed. Images are loaded through an authenticated route using the same network guards, a 1 MiB limit, raster/icon MIME allowlist, `nosniff`, private caching, and no SVG/HTML execution. Image checks happen only when requested by the visible interface, not through a crawler.

Fetched strings are made well-formed Unicode, stripped of NUL, and truncated by code point rather than splitting surrogate pairs. This protects PostgreSQL text/JSON persistence for titles, site names, asset metadata, and final URLs without changing network validation. Failed enrichment still produces a saveable unverified result.

Health states:

| State | Meaning |
| --- | --- |
| Healthy | A successful 2xx response without a redirect |
| Redirected | A successful 2xx response after a validated redirect |
| Couldn’t Verify | Auth/bot restrictions, network/DNS/timeout/size failures, blocked destinations, or other inconclusive responses |
| Unavailable | Explicit HTTP 404 or 410 |

Original URLs are retained even after redirects. An inconclusive fetch does not mean a bookmark is broken. Private/authenticated resources can be indexed, but T.I.K.I. does not fetch private network destinations or reuse a user's external login.

## One-time Notion import

An admin opens `/links/import`, pastes a structured JSON manifest, and chooses **Validate manifest** before **Import next batch as drafts**. The manifest limit is 100 rows / 250 KB. Each import click skips known source IDs, safely checks at most ten new references (five concurrently), and atomically saves that batch. Submit the same manifest again until the report says zero complete rows remain. Repeated imports never overwrite subsequent human edits, metadata, status, dates, or tags.

The manifest stays in ordinary component state across validation, successful batches, and errors; it does not need to be pasted again between actions. Navigating away/reloading discards it. No browser storage is used.

See `docs/reference-hub-manifest.example.json` for synthetic input; do not import it into production. Each real bookmark supplies:

- `notion_page_id`: original page UUID, not a title/URL hash or generated replacement.
- `title`, `url` (or `bookmark_url` copied from the actual native block), optional `description` and `tags`.
- `created_on`: original Created On timestamp with timezone, preserved as Date Added.
- `collection`: exact legacy collection name or a seeded collection ID. Control Systems references may stay at top level. A `subcollection_id` requires `subcollection_verified: true` and must belong to the chosen parent.

Completely empty rows are ignored. Missing URLs/dates/IDs, invalid fields, duplicate manifest IDs, and unknown collection assignments produce explicit report entries. Incomplete rows are not inserted. Empty URL properties are never replaced with a guessed manufacturer's homepage. Invalid rows do not prevent importing complete rows; a database failure rolls back the entire submitted batch.

Source IDs are stored as `notion:<32 lowercase hex characters>` and recorded in revision history. Imported records start as drafts for editorial review. This path performs no changes in Notion and no ongoing synchronization.

## Source audit and remaining migration work

The connected Notion source was read on 2026-09-13: **Lighting Resources and References → Bookmarks**, data source `e10217d8-5a51-4f57-a898-3bddd2118308`. All 20 bookmark rows, 10 collections, and 29 tags were retrieved without pagination remaining. The audit confirms 19 meaningful references, 12 usable URL properties, and one blank row.

A ready-to-validate local snapshot is at `.local/reference-hub/notion-manifest.json`. It preserves original page IDs, Created On timestamps, collection relations, and tag names. It is deliberately ignored by Git because three references contain shared Dropbox document URLs. No shared URLs or account credentials are embedded in the tracked example or tests. A clean clone requires copying this private snapshot securely or recreating it from the source; the repository alone does not contain the private library.

Seven pages have empty URL properties and native bookmark blocks returned as `unknown` by the Notion connector. Their destinations remain unresolved:

| Reference | Original Notion page ID | Native bookmark blocks |
| --- | --- | ---: |
| EOS Custom Magic Sheet Symbols | `b4c6fd7dcc974819abed6fef2c47e1f9` | 1 |
| ETC EOS Software | `cb56e130113747b3bdf3a8c621d33521` | 2 |
| GrandMA Consoles/Hardware | `0e6eda32610a44909a4020e8a91b508b` | 3 |
| GrandMA Software | `6cee6ee6456449dfa4770d5407f2e3b9` | 3 |
| Arc Lamps ETC | `55cac67a03c3433faf9a5bbc329aa22d` | 1 |
| ETC Fixtures Firmware | `02f66492f8aa4dcd9ab59deee0e4293c` | 1 |
| Pathport/Pathscape Software | `30166ed292b943f2a99a0e5ecb09f24e` | 1 |

Mike must copy/export the actual bookmark destinations for these pages and supply the intended primary destination where a page contains multiple blocks. Fill `bookmark_url` in the private manifest, retain the page ID/date, validate, and rerun. No subcollection assignments have been guessed. Duplicate Notion tag rows with the same name are consolidated by the existing normalized tag system.

Remaining operational steps: review/apply the additive migration in the intended database, import the 12 currently complete references (two batches), resolve/import the seven above, and review/publish drafts. These live database/content changes and authenticated browser verification have **not** been performed by this implementation pass. No merge to `main` or production deployment is included.

## Verification

Run `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd test`, and `npm.cmd run build`. Focused tests cover real PostgreSQL migration/backfill/constraints/RLS/search/import transactions, source idempotency, URL-only capture, metadata success/failure, SSRF/DNS pinning/redirect/size/deadline limits, manual Recheck authorization/concurrency/audit failures, and exclusion of private Travel details. Tests use synthetic records in disposable local PostgreSQL and do not touch production.
