# Documents retirement

## Read-only production inventory (2026-09-13)

Confirmed TIKI production project `ygjjjzlkiaaenmkvkewo`: **1 Document**, an archived QA reference; **2 tags**, **1 revision note**, **0 filed Napkin dependencies**, and **0 inbound foreign keys** to Documents. The record meets the field-length and HTTP(S) source checks. No source rows were changed or copied in production during this work.

Documents contains only ID, title, document type, URL, description, status, creator/verifier IDs, and created/updated timestamps. No file bytes, storage object identifiers, or upload workflow exist. Publication and ownership policies match ordinary Reference Hub content. Additional links belong only to Shows/Fixtures. Polymorphic tags, revisions, and historic Napkin destination IDs are the relevant dependencies.

## Forward migration

After review, apply `202609140002_retire_documents.sql` after the branch's Social Directory policy migration. Do not rerun old production migrations or Notion import. This transaction locks source/destination tables while copying; it never drops, deletes, or updates existing Documents or Reference rows.

Each source maps by unique `import_source = document:<original UUID>`, never title or URL. New references go into `ldg-ldge-documents`. Title, URL, description, document type (legacy category), status, creator/verifier, exact created/updated timestamps, and Date Added from created_at are retained. Existing tag identities, attribution and timestamps are copied; revision summaries, sources, attribution and timestamps are copied. Only newly inserted identities receive metadata, so reruns preserve human edits and do not duplicate revision notes.

Incompatible source lengths or URL shapes are skipped with a WARNING naming the source ID, never truncated or guessed. Use the reconciliation query below to enumerate every unresolved source, including any records added since this inventory. Source Documents and original metadata remain available for recovery. The current eligible production count is **1**; actual production copies from this branch are **0 (not applied)**, with **0 known incompatible sources**.

```sql
select d.id, d.title, d.status, l.id as reference_id,
       case when l.id is null then 'UNRESOLVED' else 'MIGRATED' end as outcome
from public.documents d
left join public.link_items l on l.import_source = 'document:' || d.id::text
order by d.id;
```

The only current source is archived and remains archived; find it using Reference Hub's archived view after rollout, not ordinary published/global results.

## Retirement and dependencies

Sidebar and dashboard Documents entries and standalone search queries/results are removed. Old document-tag search hits are excluded; migrated tags are indexed through Reference Hub. Index/new routes redirect to the LDG/LDGE collection. Old detail URLs resolve the source identity to the permitted reference; unavailable/unresolved records show a non-editing explanation without exposing legacy contents. Existing Napkin destination IDs remain intact and continue through these routes.

New Napkin filing excludes Documents in both UI/server validation and the SQL RPC. Other filing destinations are unchanged. Shared content actions reject Document mutations. The migration revokes authenticated direct INSERT/UPDATE/DELETE on Documents while retaining SELECT and source data. Legacy type/config entries remain deliberately dormant for historical identity handling, not a user-facing content module.

## Recovery and verification

Do not drop the legacy table/metadata. UI rollback alone will not restore Documents writes: restoring the old grants and filing function requires a separately reviewed rollback. Migrated References may have newer human edits, so never blindly copy source data over them.

Disposable PostgreSQL tests cover four mapped statuses, one explicitly unresolved invalid source, exact timestamps/attribution, copied tags/revisions, retained Napkin IDs, repeated execution after a human edit, search, and blocked legacy mutations. Production still needs the approved migration and a source/reference reconciliation before deployment. No live data migration or browser write testing is included in this branch pass.
