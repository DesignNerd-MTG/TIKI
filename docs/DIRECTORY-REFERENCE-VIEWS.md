# Directory names, Reference views, and private-portal follow-up

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
