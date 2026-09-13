# Social function grant hardening

Apply only `202609140003_social_function_grants.sql` after the Social Directory admin migration, with production approval. This migration has not been applied by the implementation pass.

## Required execution roles

- `public.social_account_target_active(uuid)`: directly called by the authenticated save/remove action and evaluated by Social Directory INSERT/UPDATE/DELETE RLS policies.
- `public.social_account_targets()`: directly called by the authenticated Admin page for active-member selection; returns only profile ID and display name.
- `authenticated` therefore needs EXECUTE on both. Application Admin is a profile role, not a separate PostgreSQL role.
- The function owner retains execution and ownership. Neither function is replaced: both remain SECURITY DEFINER with an empty search_path and qualified object references.
- No application service-role RPC caller exists. Remove its unnecessary default EXECUTE too (conditionally, for disposable databases without that Supabase role). No internal trigger or other internal execution role depends on these functions.

Production inspection before hardening found owner, anon, authenticated, and service_role EXECUTE; PUBLIC was already revoked. The new migration explicitly revokes PUBLIC and anon, removes service_role execution, and explicitly grants authenticated execution. It does not alter global default privileges.

## Verification and rollout

Disposable PostgreSQL tests reproduce Supabase function default grants, prove anonymous calls fail with SQLSTATE 42501 even with an Admin subject, and verify owner/Admin CRUD and cross-user denial through real RLS. Reapplication preserves all public data, policies (including profile/Travel), table definitions, function definitions, owners, and security settings. Target output remains restricted to profile_id/display_name.

The migration is transactional and repeatable; only the two function ACLs change. No content is written and no schema objects are added or replaced. Previously applied migrations remain unedited. After approved production application, verify has_function_privilege for anon/service_role is false and authenticated is true for both signatures, with no PUBLIC ACL entry. Then perform the separately authorized application merge/deployment and smoke test.
