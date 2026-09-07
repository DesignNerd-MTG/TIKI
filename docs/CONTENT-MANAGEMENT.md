# Content-management MVP

This milestone uses the existing Supabase Free-plan tables and browser-safe publishable key. It adds no file storage, background jobs, service-role credentials, paid services, or synchronization infrastructure.

## Workflows

Fixtures, Shows, Link Hub, Documents, and Vendors / Clients share the same workflow:

1. Create a draft with field-level validation and optional tags.
2. Open a local detail page instead of jumping directly to the external source.
3. Edit fields and add a revision note.
4. Contributors may move their own records between `draft` and `submitted`.
5. Editors may use `draft`, `submitted`, `verified`, `published`, and `archived`.
6. Archive is the normal removal path. Only an Admin sees permanent delete, and only after archive.

T.I.K.I. Napkin uses `raw`, `needs_review`, `assigned`, `converted`, and `archived`. Any active Viewer may capture a raw note. The author may edit or archive that raw note; Editors manage the full triage workflow. A converted note records both a destination type and record UUID.

Documents remain an index of authoritative HTTP(S) URLs. No uploads or Supabase Storage buckets are part of this milestone.

## Permission matrix

| Capability | Viewer | Contributor | Editor | Admin |
| --- | --- | --- | --- | --- |
| Read verified/published knowledge | Yes | Yes | Yes | Yes |
| Capture/edit own raw Napkin | Yes | Yes | Yes | Yes |
| Create canonical drafts | No | Yes | Yes | Yes |
| Edit own draft/submitted content | No | Yes | Yes | Yes |
| Review or publish content | No | No | Yes | Yes |
| Access Vendors / Clients | No | No | Yes | Yes |
| Manage people and roles | No | No | No | Yes |
| Permanently delete archived content | No | No | No | Yes |

Both server actions and Supabase RLS enforce these boundaries. Hiding a button is never the only authorization check.

## Database migration

Apply migrations in timestamp order. Existing installations need these additive files:

```text
supabase/migrations/202609070001_content_management_mvp.sql
supabase/migrations/202609070002_site_appearance.sql
```

The migrations do not modify or delete content rows. They add indexes, polymorphic authorization helpers, an atomic tag-sync function, stricter content policies, and a single global appearance row with authenticated read and Admin-only update access. In particular, Contributor inserts and updates are restricted to `draft` or `submitted`.

Appearance uses five curated, contrast-conscious presets instead of an unrestricted color picker. The portal layout reads the global setting on the server so navigation and content render in the selected theme without a client-side flash.

## Preview testing

Use records prefixed with `MVP TEST —` during branch-preview verification. Exercise create, detail, edit, tag, status, search, archive, and delete flows, then remove the records while signed in as an Admin. Do not use an existing production record for destructive tests.
