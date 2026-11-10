-- Lets each committee member score a student against fixed selection
-- criteria (financial need, family condition, academic performance,
-- interview/motivation fit) independently, so the queue can show a
-- consensus average instead of relying on a single reviewer's judgement.

create or replace function auth_user_id() returns uuid
language sql stable as $$
  select id from users where firebase_uid = (auth.jwt() ->> 'sub');
$$;

create table committee_ratings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  cycle_id uuid not null references selection_cycles(id),
  rated_by uuid not null default auth_user_id() references users(id),

  criterion text not null check (criterion in (
    'financial_need','family_condition','academic_performance','interview_fit'
  )),
  score int not null check (score between 1 and 5),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (student_id, rated_by, criterion)
);
create index idx_committee_ratings_student on committee_ratings(student_id);
create index idx_committee_ratings_cycle on committee_ratings(cycle_id);
create trigger trg_committee_ratings_updated before update on committee_ratings
  for each row execute function set_updated_at();

alter table committee_ratings enable row level security;

create policy committee_ratings_select on committee_ratings for select using (
  auth_role() in ('super_admin','program_manager','committee_member','donor')
);
-- rated_by always resolves to the caller's own row (the column default), so
-- this also blocks anyone from filing a rating under another member's name.
create policy committee_ratings_insert on committee_ratings for insert with check (
  auth_role() in ('super_admin','program_manager','committee_member')
  and rated_by = auth_user_id()
);
create policy committee_ratings_update on committee_ratings for update using (
  auth_role() in ('super_admin','program_manager')
  or (auth_role() = 'committee_member' and rated_by = auth_user_id())
);
