-- Written exams (Phase 1): papers set up per cycle, answer keys, subjects as
-- question ranges, candidates identified by the exam number they bubble on
-- ZipGrade sheets, the scanned sheets themselves (raw answers), import
-- history, and ordered pass rules.
--
-- Scores are NOT stored: they're calculated from the raw answers and the
-- current key, so correcting or cancelling a question rescores everyone and
-- pass-mark changes apply instantly (features/written-exam/scoring.ts).
--
-- The older per-student exam_results table (4 fixed subjects out of 100) is
-- left untouched; it's migrated in a later phase.

create table exam_papers (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references selection_cycles(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  sort_order int not null default 0,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, name)
);
create index idx_exam_papers_cycle on exam_papers(cycle_id);

create table exam_questions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references exam_papers(id) on delete cascade,
  number int not null check (number >= 1),
  -- One or more accepted letters, e.g. 'B' or 'A,B' (both accepted).
  answer text not null check (answer ~ '^[A-J](,[A-J])*$'),
  points numeric(6,2) not null default 1 check (points >= 0),
  options int not null default 4 check (options between 2 and 10),
  topic text,
  -- Cancelled questions count for nobody: removed from scores and maximums.
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (paper_id, number)
);

create table exam_subjects (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references exam_papers(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  from_question int not null check (from_question >= 1),
  to_question int not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (to_question >= from_question)
);
create index idx_exam_subjects_paper on exam_subjects(paper_id);

-- Exam candidates exist independently of students: most people who sit the
-- written exam never become student records. A candidate can be linked to a
-- student later.
create table exam_candidates (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references selection_cycles(id) on delete cascade,
  exam_number text not null check (exam_number ~ '^[0-9]{1,12}$'),
  full_name text,
  student_id uuid references students(id) on delete set null,
  excluded boolean not null default false,
  exclude_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, exam_number)
);
create index idx_exam_candidates_cycle on exam_candidates(cycle_id);

create table exam_imports (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references exam_papers(id) on delete cascade,
  file_name text,
  rows_in_file int not null default 0,
  sheets_saved int not null default 0,
  -- Review decisions (duplicates kept/skipped, numbers corrected, …).
  summary jsonb not null default '{}'::jsonb,
  imported_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index idx_exam_imports_paper on exam_imports(paper_id);

-- One scanned paper per candidate per exam paper.
create table exam_sheets (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references exam_papers(id) on delete cascade,
  candidate_id uuid not null references exam_candidates(id) on delete cascade,
  -- answers[1] = question 1; '' = blank; 'BD' = two bubbles (scored wrong).
  answers text[] not null,
  name_on_sheet text,
  zip_earned numeric(7,2),
  zip_possible numeric(7,2),
  key_version text,
  import_id uuid references exam_imports(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (paper_id, candidate_id)
);
create index idx_exam_sheets_paper on exam_sheets(paper_id);
create index idx_exam_sheets_candidate on exam_sheets(candidate_id);

-- Ordered pass rules; a candidate passes when every rule passes.
create table exam_rules (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references selection_cycles(id) on delete cascade,
  sort_order int not null default 0,
  paper_id uuid not null references exam_papers(id) on delete cascade,
  -- null = the whole paper's total; otherwise one subject of that paper.
  subject_id uuid references exam_subjects(id) on delete cascade,
  min_value numeric(7,2) not null check (min_value >= 0),
  unit text not null default 'points' check (unit in ('points', 'percent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_exam_rules_cycle on exam_rules(cycle_id);

-- Locked once results are announced; only super_admin can unlock (enforced in the API).
alter table selection_cycles add column if not exists exam_rules_locked boolean not null default false;

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['exam_papers','exam_questions','exam_subjects','exam_candidates','exam_sheets','exam_rules']
  loop
    execute format('create trigger trg_%1$s_updated before update on %1$I for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- RLS: the roles that enter exam scores today (lib/rbac enterExamScores).
do $$
declare t text;
begin
  foreach t in array array['exam_papers','exam_questions','exam_subjects','exam_candidates','exam_imports','exam_sheets','exam_rules']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      $f$create policy %1$I_select on %1$I for select using (auth_role() in ('super_admin','program_manager','selection_team'))$f$, t);
    execute format(
      $f$create policy %1$I_write on %1$I for insert with check (auth_role() in ('super_admin','program_manager','selection_team'))$f$, t);
    execute format(
      $f$create policy %1$I_update on %1$I for update using (auth_role() in ('super_admin','program_manager','selection_team'))$f$, t);
    execute format(
      $f$create policy %1$I_delete on %1$I for delete using (auth_role() in ('super_admin','program_manager','selection_team'))$f$, t);
  end loop;
end $$;

-- Audit (0050's trigger function). exam_sheets is left out on purpose: an
-- import writes hundreds of rows at once; exam_imports records each import.
do $$
declare t text;
begin
  foreach t in array array['exam_papers','exam_questions','exam_subjects','exam_candidates','exam_imports','exam_rules']
  loop
    execute format('drop trigger if exists trg_audit_%1$s on %1$I', t);
    execute format('create trigger trg_audit_%1$s after insert or update or delete on %1$I for each row execute function write_audit_log()', t);
  end loop;
end $$;
