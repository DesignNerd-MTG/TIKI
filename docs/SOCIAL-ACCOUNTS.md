# Social accounts follow-up

Branch: `codex/social-accounts-ux`. No production data is changed by implementation or tests.

## Storage and rollout

Keep `profile_social_links`: independent UUID rows, existing `profile_id`, `label`, and `url`. New saves use Instagram, TikTok, or Personal Website as label and a server-normalized URL. No platform uniqueness restriction, crew table, metadata fetch, or data backfill is introduced.

Apply only the new `202609140001_social_account_admin.sql` after approval and before deploying this branch. It extends social write policies for active admins targeting active members and adds narrow active-target/selector functions. Existing read policy and profile-table grants/policies are unchanged. No previously applied migration is edited. Do not rerun Reference Hub migrations or the importer.

All active roles, including Viewers, can manage their own accounts. Only Admins can manage another active user's accounts. Edits resolve the existing row owner server-side and cannot transfer ownership. The target selector returns only internal ID and display name; no email or Travel data. Normal users see other members read-only.

The migration changes authorization intentionally. Rolling back the UI alone does not revert the broader admin policy: a policy rollback, if required, must be reviewed separately. No record deletion is needed for rollback.

## Input and legacy behavior

Instagram/TikTok accept handles, leading @, and matching profile URLs. Handles are lowercase; URL tracking queries/fragments are discarded. Post/reel/video/share paths and foreign hosts are rejected. Websites default to HTTPS when no scheme is supplied; HTTP(S) paths are retained, credentials/control characters/malformed Unicode rejected. No network fetching occurs.

Legacy Instagram/TikTok profile URLs are recognized confidently. Explicit Website/Personal Website/Portfolio labels are recognized as websites. Ambiguous rows remain clickable with their original label/URL and a Legacy link marker; editing requires a deliberate platform choice and save. There is no silent stored-data conversion.

Social Directory is immediately below Reference Hub in persistent navigation. Both Social Directory and Notion import shortcuts are removed from the Hub header; Add Reference and all search/collections remain. The importer route retains admin authorization.

## Version

The sidebar reads `package.json` directly and displays **T.I.K.I. v0.1.0**. Git history has no established release-version convention; 0.1.0 is the existing starter version, intentionally left unchanged in this pass. It is not yet a unique deployment identifier. Adopt a release-version policy separately rather than inventing a version here.

## Verification

Run lint, typecheck, all tests, and build. The complete test suite runs the migration chain in disposable PGlite PostgreSQL, including legacy preservation, repeated platforms, owner/admin permissions, pending-user rejection and minimal selector fields. UI harness tests exercise the actual form's platform switching, independent repeated creation, and edit identity. No live production CRUD is used.
