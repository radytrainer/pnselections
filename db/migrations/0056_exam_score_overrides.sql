-- Manual paper scores (Results → edit). Scores are normally calculated from
-- the scanned answers and the current key; an override replaces that total
-- for one candidate and paper (e.g. a sheet that couldn't be scanned, or a
-- marking correction), always with a reason. Removing it restores the
-- calculated score.
create table if not exists exam_score_overrides (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references exam_candidates(id) on delete cascade,
  paper_id uuid not null references exam_papers(id) on delete cascade,
  score numeric(7,2) not null check (score >= 0),
  reason text not null check (length(trim(reason)) > 0),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, paper_id)
);
create index if not exists idx_exam_score_overrides_paper on exam_score_overrides(paper_id);

create trigger trg_exam_score_overrides_updated before update on exam_score_overrides
  for each row execute function set_updated_at();

alter table exam_score_overrides enable row level security;
create policy exam_score_overrides_select on exam_score_overrides for select
  using (auth_role() in ('super_admin','program_manager','selection_team'));
create policy exam_score_overrides_write on exam_score_overrides for insert
  with check (auth_role() in ('super_admin','program_manager','selection_team'));
create policy exam_score_overrides_update on exam_score_overrides for update
  using (auth_role() in ('super_admin','program_manager','selection_team'));
create policy exam_score_overrides_delete on exam_score_overrides for delete
  using (auth_role() in ('super_admin','program_manager','selection_team'));

drop trigger if exists trg_audit_exam_score_overrides on exam_score_overrides;
create trigger trg_audit_exam_score_overrides after insert or update or delete on exam_score_overrides
  for each row execute function write_audit_log();
