-- Configuration → Annual Report: the written parts of the yearly selection
-- report (narratives, challenges, recommendations, budget, timeline, photos,
-- hand-counted figures). The numbers themselves are calculated live from the
-- cycle's data when the report is opened; only what can't be derived is
-- stored here. One row per selection cycle.
create table annual_reports (
  cycle_id uuid primary key references selection_cycles(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint annual_reports_content_size check (pg_column_size(content) < 400000)
);
create trigger trg_annual_reports_updated before update on annual_reports
  for each row execute function set_updated_at();

alter table annual_reports enable row level security;
create policy annual_reports_select on annual_reports for select using (
  auth_role() in ('super_admin','program_manager','selection_team'));
create policy annual_reports_insert on annual_reports for insert with check (
  auth_role() in ('super_admin','program_manager','selection_team'));
create policy annual_reports_update on annual_reports for update using (
  auth_role() in ('super_admin','program_manager','selection_team'));
grant select, insert, update on annual_reports to authenticated;
create trigger trg_audit_annual_reports after insert or update or delete on annual_reports
  for each row execute function write_audit_log();
