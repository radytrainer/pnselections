-- Written exams, "later" features:
--  1. Either/or pass rules: a rule with or_previous = true is an alternative
--     to the rule before it. Consecutive linked rules form one group; a
--     candidate passes a group when any rule in it passes, and must pass
--     every group (in order).
--  2. Answer-key versions (ZipGrade "Key Version", e.g. shuffled paper B).
--     The paper's exam_questions stay the main key (points, topics,
--     cancellations, subjects). A version stores, for each question position
--     on *its* sheet, the accepted letter(s) and which main question it is.
--     Sheets whose key_version matches a version use it; all others use the
--     main key.

alter table exam_rules add column if not exists or_previous boolean not null default false;

create table if not exists exam_key_versions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references exam_papers(id) on delete cascade,
  version text not null check (version ~ '^[A-Za-z0-9]{1,10}$'),
  -- answers[i] = accepted letter(s) for question i+1 on this version's sheet ("B" or "A,B").
  answers text[] not null,
  -- question_map[i] = main question number for position i+1 (same length as answers).
  question_map int[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (paper_id, version),
  check (cardinality(answers) = cardinality(question_map) and cardinality(answers) between 1 and 500)
);

create trigger trg_exam_key_versions_updated before update on exam_key_versions
  for each row execute function set_updated_at();

alter table exam_key_versions enable row level security;
create policy exam_key_versions_select on exam_key_versions for select
  using (auth_role() in ('super_admin','program_manager','selection_team'));
create policy exam_key_versions_write on exam_key_versions for insert
  with check (auth_role() in ('super_admin','program_manager','selection_team'));
create policy exam_key_versions_update on exam_key_versions for update
  using (auth_role() in ('super_admin','program_manager','selection_team'));
create policy exam_key_versions_delete on exam_key_versions for delete
  using (auth_role() in ('super_admin','program_manager','selection_team'));

drop trigger if exists trg_audit_exam_key_versions on exam_key_versions;
create trigger trg_audit_exam_key_versions after insert or update or delete on exam_key_versions
  for each row execute function write_audit_log();
