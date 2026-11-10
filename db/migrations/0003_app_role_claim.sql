-- ============================================================================
-- Fix: Supabase's Data API reserves a JWT claim literally named `role` to
-- mean "switch to this Postgres database role" (PostgREST issues
-- `SET ROLE <claim value>` for every request). Our app-level role strings
-- (`super_admin`, `ngo_partner`, ...) were being sent under that exact claim
-- name, so every authenticated request failed with
-- `role "<value>" does not exist` once Third-Party Auth correctly verified
-- the Firebase token. The fix is to carry the app role under a differently
-- named claim, `app_role`, that PostgREST has no reserved meaning for —
-- see lib/firebase/admin.ts#setUserClaims, which now sets `app_role`
-- instead of `role`.
-- ============================================================================

create or replace function auth_role() returns text
language sql stable as $$
  select coalesce(auth.jwt() ->> 'app_role', 'anonymous');
$$;
