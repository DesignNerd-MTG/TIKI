# Fixture GDTF review, Weight and IP Rating

## Scope and rollout

Built on manufacturer-taxonomy commit `d8a8d60`, on `codex/fixture-gdtf-specs`.
The refinement pass authorizes controlled rollout only after a clean read-only
audit and production preflight. Feature pushes use `[skip netlify]`; the final
approved main merge must not carry that marker.

New forward migrations: `202609140014_fixture_physical_specs.sql` and
`202609140015_fiilex_gdtf_alias.sql` (idempotently appends Filex to Fiilex aliases).
Apply only after reviewed prerequisites, including manufacturer migration 013,
are confirmed in the intended environment. The SQL is transactional, adds two
nullable columns and CHECK constraints, and performs no UPDATE/DELETE/backfill.
It changes no grants, RLS policies, function definitions or historical timestamps.
It is a once-only versioned migration, not a rerunnable SQL helper. Existing
fixtures remain valid with NULL physical specs. Keep these nullable columns if
rolling back application code; do not drop collected specs to roll back the UI.

## Storage and editing

- `fixtures.weight_lb`: nullable PostgreSQL numeric. Pounds, positive and at most
  10,000 lb; decimal input supported. Zero, negative, non-finite and nonnumeric
  values are rejected in both application and database. The ceiling is an MVP
  sanity bound, not rigging guidance. No automatic weights are assigned to old rows.
- `fixtures.ip_rating`: nullable text, controlled to IP20/21/22/23/40/44/54/55/65/66/67.
  Not specified is NULL. Codes are never numerically ranked. Unlisted ratings
  require a reviewed future taxonomy extension rather than arbitrary free text.
- The existing create/edit action saves both fields with existing authorization,
  status and revision handling. No separate import-write API is introduced.
- Detail pages group preferred mode, footprint, pounds and IP in compact Quick specs.
  Existing manual creation, links, resources, tags, search, types and Typical Use stay intact.

## Import workflow

Add Fixture → Import GDTF → upload → Review Imported Data → explicitly choose a
mode (or manual/unspecified) → edit the ordinary Fixture form → Create.

Parsing does not save a Fixture or create a manufacturer. Active Contributor or
higher is required by the server action before reading file bytes. Final creation
uses the existing shared action and RLS. All prefills remain editable. Switching
creation paths warns before discarding unsaved form input.

Exact active canonical-name/alias matches select that manufacturer for review.
Unknown names, duplicate matches, empty/overlong manufacturer text and plain
Chauvet remain unresolved. The existing selector permits matching an existing
brand; only Editor/Admin can explicitly add one. Final create rejects unresolved
manufacturer IDs. GDTF Description is source metadata shown only during review;
it never prefills or persists as Field Notes. Internal Field Notes remain blank
until manually entered. Selecting a new file immediately clears review, selected
mode and resolution; a generation guard ignores stale in-flight responses.

## Supported subset and deliberate limits

GDTF 1.0, 1.1 and 1.2: FixtureType LongName (falling back to Name), Manufacturer,
Description, DMXMode names and PhysicalDescriptions/Properties/Weight Value.
Unknown versions retain names/description for review but do not provide trusted
physical values or footprints. Missing optional fields do not reject useful data.

GDTF weight is kg, converted using kg / **0.45359237**, kept to 12 significant
digits for editing/storage, displayed to one decimal place in review/detail. No geometry load/mass or
unrelated power value is treated as fixture weight. The supported standard has no
reliable IP mapping: IP remains blank with an explicit warning; user selects it
from authoritative specifications.

For simple single-break modes, footprint is the highest occupied relative address,
including sparse gaps and coarse/fine/ultra/uber bytes. Virtual Offset=None channels
consume no addresses. Logical channels/functions are not counted. Offsets must be
1–512, with 1–4 bytes and no overlaps. Unsupported/malformed definitions leave
footprint blank with a warning, preserving mode name for review. Multiple DMX
breaks, Overwrite breaks and **any geometry-reference use in the file** are
conservatively deferred for manual verification; this is not a complete GDTF engine.
No mode is selected automatically. Truncated names/descriptions remain valid Unicode.

Embedded thumbnail/images, SVGs, models, macros and arbitrary archive resources
are **not extracted, displayed, executed, fetched or saved**. Fixtures currently
have no canonical image field. Avoiding an additional image persistence workflow
keeps this import strictly review/prefill-only. Thumbnail presence is reported.

Specification references inspected:

- [FixtureType fields](https://www.gdtf.eu/gdtf/file-spec/fixture-type-node/)
- [DMX modes and channel offsets](https://www.gdtf.eu/gdtf/file-spec/dmx-mode-collect/)
- [Geometry reference remapping](https://www.gdtf.eu/gdtf/file-spec/geometry-collect/)
- [Physical weight properties](https://www.gdtf.eu/gdtf/file-spec/physical-descriptions/)

## Untrusted file boundary

`yauzl` streams only root description.xml from an in-memory archive, after checking
the entire entry directory. Bounds: 4 MB upload, 1 MB XML, 1,024 entries, 32 MB
declared total expansion, 200:1 maximum per-entry expansion ratio, 3-second archive
inspection deadline. Duplicate case-insensitive paths, traversal/absolute/drive
paths, backslashes, control characters, symlinks, encryption and unsupported
compression are rejected. Streamed XML byte counts and CRC32 must agree with the
archive. Streams close on error/timeout. Nothing is written to disk or Storage.
`.gdtf.zip` permits exactly one outer wrapper containing exactly one `.gdtf`
payload (at most 4 MB expanded). The same validated streaming/CRC boundary reads
that payload and its XML. Entry/expanded totals are shared across both archives.
Additional nested ZIPs, ambiguous payloads and missing payloads are rejected;
there is no recursive archive traversal.

`saxes` parses strict UTF-8 XML without a network/entity resolver. DOCTYPE and
processing instructions are rejected. XML is bounded to 20,000 nodes, depth 64,
64 attributes per node and 128 review modes. Malformed XML/Unicode errors are
reported safely, without returning raw parser errors or logging file contents.
No parsing code makes outbound requests. The 5 MB Server Action transport ceiling
allows a 4 MB file plus multipart overhead; the application still rejects every
GDTF file above exactly 4,194,304 bytes with a T.I.K.I.-controlled error. Avatar
actions keep their existing independent 2 MB file limit.

Production read-only inspection confirmed `.env.local` points to project
`ygjjjzlkiaaenmkvkewo`. Before this rollout, `fixture_manufacturers`,
`fixtures.manufacturer_id`, `weight_lb`, and `ip_rating` are absent. The
manufacturer-list warning is therefore the missing migration 013, not a fallback
selector defect. 013 seeds canonical Fiilex and renames Wash Bricks to Battens &
Tubes; 014 adds nullable physical specs; 015 adds the data-driven Filex alias.
Production has no `supabase_migrations.schema_migrations` table, so preflight
must reconcile actual schema/function definitions and prior applied evidence,
not invent migration-history rows or run all migrations blindly.

## Verification and review

Synthetic ZIP/XML tests cover successful parsing, mode selection, aliases/ambiguity,
sparse and multibyte footprints, virtual/complex channels, optional metadata,
Unicode truncation, malformed ZIP/XML, CRC and size mismatches, bombs, traversal,
symlinks, encryption, entity attempts and limits. Component/action tests execute
the actual upload action and creation component with isolated dependencies.

Disposable PGlite tests apply the forward migration over legacy fixtures and
compare all prior fields, microsecond timestamps, resources, revisions and RLS
policies. They exercise Viewer/Contributor/Editor/Admin permissions and anonymous/
pending denial, plus direct SQL numeric/IP constraints and existing search.

Before rollout: review the manual and GDTF forms visually, confirm this bounded
subset against a representative user-supplied GDTF, approve/apply migration 014 to
the intended environment, and then authorize preview deployment. No hosted
creation or Storage tests are needed to claim parser-only tests; production data
was not used or changed by this pass.
