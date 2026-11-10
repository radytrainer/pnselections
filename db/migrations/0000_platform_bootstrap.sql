-- ============================================================================
-- Platform bootstrap for self-hosted PostgreSQL (replaces what Supabase
-- provided implicitly).
--
-- The RLS policies in every later migration read the caller's identity via
-- auth.jwt() / auth.role(). On Supabase those came from PostgREST. Here the
-- Node.js API (api/src/db.ts) verifies the Firebase ID token itself and, for
-- every request, runs its queries inside a transaction that does:
--
--   set local role authenticated;
--   select set_config('request.jwt.claims', '<verified claims json>', true);
--
-- so the exact same policies keep working unchanged. `authenticated` is a
-- NOLOGIN, non-superuser, non-owner role, so RLS always applies to it.
-- The API's own login role (created by api/src/scripts/migrate.ts) holds no
-- table privileges of its own: a query that forgets to switch to
-- `authenticated` fails closed instead of bypassing RLS.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
end $$;

create schema if not exists auth;
grant usage on schema auth to authenticated;
grant usage on schema public to authenticated;

-- Verified token claims for the current transaction ({} when unset).
create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

-- Supabase-compatible: the standard `role` claim ('authenticated' for every
-- API request). Used by guard_users_self_update() (0023).
create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', 'anon');
$$;

-- Firebase UID of the caller.
create or replace function auth.uid() returns text
language sql stable as $$
  select auth.jwt() ->> 'sub';
$$;

grant execute on all functions in schema auth to authenticated;

-- Tables/functions created by later migrations (run as the owner role) are
-- automatically usable by `authenticated`; RLS still decides which rows.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;
