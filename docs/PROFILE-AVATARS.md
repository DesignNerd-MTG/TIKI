# My Profile: private shared identity

The sidebar identity links to `/profile`. It and the existing compact Directory
name editor share `DirectoryName`, `saveDirectoryName`, and the owner-only
`set_directory_display_name` RPC. The only canonical name is `profiles.full_name`.
Travel names and private fields are never copied into it.

Avatars use the existing `profiles.avatar_url` column, storing the canonical
private object path `<profile UUID>/avatar.webp`, not a public URL. The sidebar
and compact 640px Social Directory use 36px images with initials fallback.
Legacy external avatar URLs are not fetched or imported; members can upload an
image explicitly. Avatar changes do not affect name/account sorting or paging.

## Forward migration (not applied by this implementation)

`202609140007_profile_avatars.sql` requires Supabase's existing Storage schema.
Apply only after approved review and target confirmation. The earlier pending
`202609140006_social_directory_last_name.sql` remains a separate rollout item.

The migration:

- Creates the **private** `tiki-avatars` bucket (2 MB maximum, WebP objects only).
  An existing incompatible bucket causes a transaction rollback, not a silent
  configuration change.
- Adds owner-only Storage insert/update/delete and active-member read policies.
  Admins have no cross-user avatar writes. Read access requires an active target
  and a matching canonical path; there is no general profile SELECT expansion.
- Adds three empty-search-path SECURITY DEFINER functions:
  `profile_avatar_path(uuid)` exposes only the active member's canonical path;
  `avatar_is_shared(text)` is a policy predicate;
  `set_profile_avatar(boolean)` updates only `auth.uid()` and requires an existing
  object before publishing. Authenticated callers/owner retain EXECUTE;
  PUBLIC, anon and service_role do not receive it.
- Keeps auth email synchronization but prevents auth metadata updates from
  overwriting member-managed names/images or resurrecting removed avatars.
- Changes no existing profile rows, Travel policies, social permissions, content,
  or previously applied migration files.

Before applying, inspect existing Storage policies: unrelated broadly permissive
policies must not inadvertently cover this new bucket. The repository has no
existing Storage policies. Disposable tests model PostgreSQL Storage catalogs,
not the hosted Storage HTTP service; hosted upload/read/delete verification is
still required after an explicitly approved migration.

## Image and request safety

The server accepts still JPEG/PNG/WebP up to 2 MB and 16 million decoded pixels.
Sharp validates the actual format, auto-orients, center-crops to 256px square,
strips metadata and emits WebP. SVG, MIME mismatches, corrupt files, animations
and oversized images are rejected. Server Actions retain Next's origin checks;
the request body cap is 3 MB to allow the bounded file plus multipart overhead.

Images are served only through the active-member-gated `/profile/avatar/[id]`
route using the request's authenticated Supabase client. No service key, signed
URL, public bucket URL or arbitrary external fetch is used. Stored bytes are
decoded again before rendering to defend against direct Storage API uploads.
Responses are private/no-store and nosniff. The service worker does not cache
them. Removed, unavailable, malformed or legacy images fall back to initials.

One stable owner-scoped object is replaced in place, bounding orphan risk without
deleting arbitrary paths. Storage and profile RPC calls are not an atomic
transaction: on a partial failure the UI reports it and offers retry. At most
one bounded object can remain; another user's object is never a cleanup target.
Concurrent owner changes are last-write-wins; no multi-file upload history is kept.

The existing Admin page edits role/activation only. There is no clean Admin
name/avatar editor to extend, so this pass deliberately provides owner editing
only. Existing Admin social-account controls are unchanged.

## Verification / rollback

Automated coverage includes real image decoding, format/size rejection,
upload/replace/remove orchestration and failures, actual avatar fallback
rendering, authenticated route denial, and disposable PostgreSQL storage RLS,
function ACLs, owner isolation and unchanged public/Travel policies.

No production migration, data change, merge or deployment is part of this pass.
Visual review and hosted Storage smoke tests remain rollout gates. To roll back
the application, retain profile fields and private objects; do not drop the bucket
or delete files to force rollback. Grant/policy removal requires a separately
reviewed forward migration. The legacy auth sync definition is in the initial
migration, but restoring its overwrite behavior is not recommended.

### Local verification for this change

- 149 tests passed, including the full disposable PostgreSQL/RLS suite.
- Lint, typecheck and optimized production build passed.
- Running the production build locally without cookies returned `/login` (307)
  for `/profile` and 401/private-no-store for the avatar endpoint.
- Actual components/styles rendered with invented sample members were reviewed
  at desktop and 390px mobile widths. Images remain small, the directory remains
  640px maximum/left-aligned, and mobile has no horizontal overflow. This was a
  layout-only fixture, not a hosted Storage upload test or Mike's visual approval.
- Hosted Storage verification and Mike's visual review remain pending; no
  production or Netlify operation was performed.
