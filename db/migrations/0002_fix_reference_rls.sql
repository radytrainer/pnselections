-- ============================================================================
-- Fix: provinces / districts / communes / villages / selection_cycles / roles
-- ended up with RLS enabled and zero policies on the live project (probably
-- toggled on via the Supabase dashboard table editor, which defaults new
-- tables to RLS-on). With RLS on and no policy, every role -- including
-- "anon" and "authenticated" -- gets zero rows back from a SELECT, which is
-- why the Cambodia map (and any province/cycle dropdown) loaded empty.
-- These are public-ish reference/lookup tables, same as the existing
-- `ngo_select` / `school_select` policies (see 0001_init_schema.sql §14), so
-- they get an open `using (true)` read policy. Writes stay admin-only.
-- ============================================================================

alter table provinces enable row level security;
alter table districts enable row level security;
alter table communes enable row level security;
alter table villages enable row level security;
alter table selection_cycles enable row level security;
alter table roles enable row level security;

drop policy if exists provinces_select on provinces;
create policy provinces_select on provinces for select using (true);

drop policy if exists districts_select on districts;
create policy districts_select on districts for select using (true);

drop policy if exists communes_select on communes;
create policy communes_select on communes for select using (true);

drop policy if exists villages_select on villages;
create policy villages_select on villages for select using (true);

drop policy if exists selection_cycles_select on selection_cycles;
create policy selection_cycles_select on selection_cycles for select using (true);

drop policy if exists roles_select on roles;
create policy roles_select on roles for select using (true);

drop policy if exists selection_cycles_write on selection_cycles;
create policy selection_cycles_write on selection_cycles for all using (
  auth_role() in ('super_admin', 'program_manager')
);
