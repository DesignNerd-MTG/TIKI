# Directory names, Reference views, and private-portal follow-up

## My Profile addendum

Sidebar identity now opens the compact owner-only My Profile page. The same
shared-name component/action is reused; private avatar storage, small directory
avatars, validation, permissions and rollout notes are documented in
[PROFILE-AVATARS.md](PROFILE-AVATARS.md). Include migration 007, auth-sync
preservation, image delivery and storage ACLs in the final read-only audit.
No merge, deployment or production migration is authorized by this addition.

## Width and last-name sorting addendum (supersedes full-name ordering below)

The Social member list alone now has width:100%, max-width:640px and left alignment. Existing 600px stacking and 44px touch targets remain; Reference Hub widths are unchanged.

Profiles have full_name only, no last_name/family_name. Member order uses its final whitespace-delimited token (single names use themselves), case-insensitive, then full name case-insensitive, then profile UUID. Displayed names and account sorting are unchanged; missing names retain the emergency fallback.

New forward migration `202609140006_social_directory_last_name.sql` adds `social_directory_index()`, a SECURITY INVOKER wrapper over the existing active-member-only directory. It returns the same public fields plus two derived lowercase sort keys, no private fields. Execution is authenticated/owner only, with anon/PUBLIC/service_role revoked. Existing RPCs, grants, policies, stored data and profile schema are untouched. This migration has NOT been applied to production.

PostgREST orders by last_name_key, display_name_key, profile_id and account id before each range request. The complete paged result is grouped preserving database member order; account sorting is unchanged. This avoids sorting only a truncated page. Disposable PostgreSQL tests verify two-row pages across last-name/full-name/UUID ties, viewer/Admin consistency and anonymous/pending denial. The new migration and visual review are required before deploying this branch.

## Social density addendum

Member groups use compact bordered list rows (12px/16px padding), with the name as heading and platform/account/control columns. Controls retain 44px touch targets and wrap below accounts on narrow screens. Editing expands only the existing per-account form; Add another account remains collapsed. The shared-name form is now a native collapsed disclosure. No normalization, ownership predicate, SQL policy, or stored data change.

Although social_directory() has no SQL LIMIT, PostgREST can cap RPC responses. Both directory accounts and Admin targets now load stable pages ordered by profile UUID/account UUID before existing name/platform sorting. Short pages continue until an empty page, accommodating lower API caps. A page error returns no partial directory. Tests cover 1,205 accounts under a simulated 73-row API cap, complete grouping, failure handling, compact responsive structure and unchanged ownership controls. No new migration is required for this addendum.

Rollout remains paused by Netlify account credits. Density changes are on the retained feature branch and should be visually reviewed before the next production release.

## Reference sorting addendum

`202609140005_reference_index_sort.sql` adds a separate SECURITY INVOKER index RPC, explicitly authenticated-only, leaving global search's existing RPC unchanged. Filtering and search predicates are preserved; ordering happens before the 51-row pagination window. Title sorts use trimmed lowercase titles then UUID; date sorts use only date_added, then title/UUID. NULL dates sort last. Unknown sort values fall back to Title A–Z.

The compact GET form beside Card/List offers Title A–Z (default), Title Z–A, Newest added and Oldest added. Apply updates the URL, preserves query/collection/subcollection/archive and resets pagination; pagination/search/navigation retain sort. Browser Back/Forward and reload use URL state. Card/List does not reorder records.

Mike authorized applying both new migrations (004 and 005) after verification/read-only audit. Neither migration mutates existing content. Sorting tests span 55 records to prove ordering precedes pagination and exercise historical dates, ties, archived/collection/subcollection/search filters and anonymous/pending denial.

## Name root cause and explicit repair

`social_directory()` already returns `profiles.full_name` as `display_name`; the UI passed it through. Email/password signup does not collect a name, so its new-user trigger often has no metadata name to populate. Private Travel name/details are separate and are not a valid public fallback. Do not infer names from email or copy Travel data.

Mike approved an explicit Directory display name editor. Active members set their own existing `profiles.full_name` through `202609140004_directory_display_name.sql`. The function accepts no target ID, validates the name, checks active membership, and updates only `auth.uid()`. No profile RLS, table grants, role/activation fields, Social CRUD policies, or existing migration changes. The new SECURITY DEFINER function has an empty search_path and explicit authenticated-only execution (owner retained; anon/PUBLIC/service_role revoked).

This forward migration needs approval/application before rollout. It performs no backfill or automatic content update. Members with genuinely missing names must explicitly enter one; the emergency fallback remains until they do. All active viewers obtain the same names from the shared directory RPC.

Member groups sort case-insensitively by public name, then profile UUID. Accounts sort Instagram, TikTok, Personal Website, then displayed handle/domain case-insensitively, then row UUID. Existing normalization and owner/Admin control predicates are unchanged.

## Reference results

Both views receive the identical server-filtered, permission-filtered results and tags. Search, collection/subcollection, archive state, pagination and RPCs are unchanged. Card is the server/first-use default. `useSyncExternalStore` supplies a stable Card hydration snapshot and then reads `tiki.reference-view` from localStorage. Browser storage/custom events synchronize changes; disabled storage falls back to component state without throwing.

Compact styling is scoped to index results only: 80px previews, 12px padding, smaller text/gaps, two-line notes. List omits preview images and notes and retains title, site identity, taxonomy, tags, health, date and external Open. Its two-column layout collapses to one column below 600px without a fixed-width table. Detail rendering defaults remain unchanged.

## Private access verification

The shared portal layout requires authenticated active membership; image proxy independently checks both before any fetch. Admin and restricted content retain their stricter role checks. Department tables retain RLS and RPC authorization; no service-role client is introduced. Login/signup/reset/callback remain accessible and new profiles default to inactive viewer even if signup metadata claims admin/active.

The former public sample `/preview` contained static samples, not live data. It is now active-member gated to meet the explicit no-guest-mode requirement. No other authentication behavior changes.

Disposable PostgreSQL tests reproduce Supabase default function grants and check anonymous denial, pending access, active users, owner/Admin CRUD, target fields, self-name updates, forged signup metadata, and private Travel owner-only access. Production-build HTTP checks without cookies returned 307 /login for Dashboard, Fixtures, Shows, Reference index/detail, Social, Travel, Locations, Drinks, Napkins, Vendors, Admin, Documents, Search and Preview; image proxy returned 401.

No production data or schema was changed in this pass. Browser review of authenticated layout responsiveness and applying the new name function remain pre-rollout steps; tests cover render/state logic and actual PostgreSQL authorization. Existing production Social grants were verified hardened in the preceding rollout; the new branch does not alter them.
