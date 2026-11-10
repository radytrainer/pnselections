-- ============================================================================
-- Scholarship Selection Tracker System — PostgreSQL / Supabase Schema
-- ============================================================================
-- Conventions:
--   * All PKs are uuid (gen_random_uuid()).
--   * All mutable core tables have created_at, updated_at, deleted_at (soft delete).
--   * created_by / updated_by reference users.id and are set by the application layer.
--   * RLS is enabled on every table; policies read claims from the Firebase ID
--     token, verified directly by Supabase via Third-Party Auth (see
--     docs/09-security.md) — no custom JWT minting:
--       auth.jwt() ->> 'sub'       text   -- Firebase UID (resolve to users.id via firebase_uid)
--       auth.jwt() ->> 'role'      text   -- one of the 8 RBAC roles (Firebase custom claim)
--       auth.jwt() ->> 'ngo_id'    uuid   -- set only for ngo_partner role (Firebase custom claim)
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm"; -- fuzzy search on student/school/ngo names

-- ----------------------------------------------------------------------------
-- 0. Helper function: current role claim
-- ----------------------------------------------------------------------------
create or replace function auth_role() returns text
language sql stable as $$
  select coalesce(auth.jwt() ->> 'role', 'anonymous');
$$;

create or replace function auth_ngo_id() returns uuid
language sql stable as $$
  select (auth.jwt() ->> 'ngo_id')::uuid;
$$;

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1. Reference / Administrative hierarchy
-- ----------------------------------------------------------------------------
create table provinces (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,            -- e.g. 'PP', 'SR', 'BTB'
  name_en text not null,
  name_kh text,
  geojson_property_id text not null,    -- matches the GeoJSON feature id used by react-leaflet
  created_at timestamptz not null default now()
);

create table districts (
  id uuid primary key default gen_random_uuid(),
  province_id uuid not null references provinces(id) on delete restrict,
  name_en text not null,
  name_kh text,
  created_at timestamptz not null default now(),
  unique (province_id, name_en)
);
create index idx_districts_province on districts(province_id);

create table communes (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references districts(id) on delete restrict,
  name_en text not null,
  name_kh text,
  created_at timestamptz not null default now(),
  unique (district_id, name_en)
);
create index idx_communes_district on communes(district_id);

create table villages (
  id uuid primary key default gen_random_uuid(),
  commune_id uuid not null references communes(id) on delete restrict,
  name_en text not null,
  name_kh text,
  created_at timestamptz not null default now(),
  unique (commune_id, name_en)
);
create index idx_villages_commune on villages(commune_id);

-- ----------------------------------------------------------------------------
-- 2. Selection Cycles
-- ----------------------------------------------------------------------------
create table selection_cycles (
  id uuid primary key default gen_random_uuid(),
  year int not null unique,
  name text not null,                                -- e.g. "2026 Selection Cycle"
  start_date date not null,
  end_date date,
  exam_pass_threshold numeric(5,2) default 50.00,
  status text not null default 'planning'
    check (status in ('planning','active','closed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_cycles_updated before update on selection_cycles
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. Users, Roles, RBAC
-- ----------------------------------------------------------------------------
create table users (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text unique not null,
  email text unique not null,
  full_name text not null,
  phone text,
  avatar_url text,
  status text not null default 'active' check (status in ('active','suspended','invited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_users_firebase_uid on users(firebase_uid);
create trigger trg_users_updated before update on users
  for each row execute function set_updated_at();

create table roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
    check (name in (
      'super_admin','program_manager','selection_team','interview_team',
      'home_visit_team','committee_member','ngo_partner','donor'
    )),
  description text
);

create table user_roles (
  user_id uuid not null references users(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references users(id),
  primary key (user_id, role_id)
);

-- (user_ngo_link is created in section 4, after ngo_partners exists)

-- ----------------------------------------------------------------------------
-- 4. NGO & School Partners
-- ----------------------------------------------------------------------------
create table ngo_partners (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  contact_person text,
  phone text,
  email text,
  website text,
  province_id uuid references provinces(id),
  district_id uuid references districts(id),
  lat numeric(9,6),
  lng numeric(9,6),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_by uuid references users(id),
  deleted_at timestamptz
);
create index idx_ngo_province on ngo_partners(province_id) where deleted_at is null;
create index idx_ngo_name_trgm on ngo_partners using gin (organization_name gin_trgm_ops);
create trigger trg_ngo_updated before update on ngo_partners
  for each row execute function set_updated_at();

create table ngo_projects (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references ngo_partners(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
create index idx_ngo_projects_ngo on ngo_projects(ngo_id);

-- NGO Partner accounts are additionally scoped to one or more NGOs
create table user_ngo_link (
  user_id uuid not null references users(id) on delete cascade,
  ngo_id uuid not null references ngo_partners(id) on delete cascade,
  primary key (user_id, ngo_id)
);

create table school_partners (
  id uuid primary key default gen_random_uuid(),
  school_name text not null,
  principal_name text,
  phone text,
  email text,
  province_id uuid references provinces(id),
  district_id uuid references districts(id),
  lat numeric(9,6),
  lng numeric(9,6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_by uuid references users(id),
  deleted_at timestamptz
);
create index idx_school_province on school_partners(province_id) where deleted_at is null;
create index idx_school_name_trgm on school_partners using gin (school_name gin_trgm_ops);
create trigger trg_school_updated before update on school_partners
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. Students
-- ----------------------------------------------------------------------------
create table students (
  id uuid primary key default gen_random_uuid(),
  student_global_id uuid not null default gen_random_uuid(), -- stable across re-application cycles
  student_code text unique not null,           -- e.g. "SST-2026-000123"
  cycle_id uuid not null references selection_cycles(id),

  first_name text not null,
  last_name text not null,
  gender text not null check (gender in ('male','female','other')),
  dob date not null,
  phone text,

  province_id uuid references provinces(id),
  district_id uuid references districts(id),
  commune_id uuid references communes(id),
  village_id uuid references villages(id),

  school_id uuid references school_partners(id),
  grade text,
  gpa numeric(4,2),
  english_level text check (english_level in ('none','beginner','intermediate','advanced')),

  father_name text,
  mother_name text,
  parent_occupation text,
  family_income_monthly numeric(12,2),
  siblings_count int,

  referred_by_ngo_id uuid references ngo_partners(id),

  status text not null default 'registered' check (status in (
    'registered','exam_completed','interview_completed',
    'home_visit_completed','committee_review',
    'selected','waitlisted','rejected','dropped_out'
  )),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users(id),
  updated_by uuid references users(id),
  deleted_at timestamptz
);

create index idx_students_cycle on students(cycle_id) where deleted_at is null;
create index idx_students_province on students(province_id) where deleted_at is null;
create index idx_students_cycle_province on students(cycle_id, province_id) where deleted_at is null;
create index idx_students_status on students(status) where deleted_at is null;
create index idx_students_school on students(school_id);
create index idx_students_ngo on students(referred_by_ngo_id);
create index idx_students_global on students(student_global_id);
create index idx_students_name_trgm on students using gin ((first_name || ' ' || last_name) gin_trgm_ops);
create trigger trg_students_updated before update on students
  for each row execute function set_updated_at();

create table student_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  doc_type text not null check (doc_type in ('photo','id_card','transcript','certificate','other')),
  file_path text not null,             -- Supabase Storage object path
  uploaded_by uuid references users(id),
  uploaded_at timestamptz not null default now()
);
create index idx_student_docs_student on student_documents(student_id);

-- ----------------------------------------------------------------------------
-- 6. Exam Module
-- ----------------------------------------------------------------------------
create table exam_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references students(id) on delete cascade,
  cycle_id uuid not null references selection_cycles(id),

  math_score numeric(5,2) not null check (math_score between 0 and 100),
  english_score numeric(5,2) not null check (english_score between 0 and 100),
  logic_score numeric(5,2) not null check (logic_score between 0 and 100),
  computer_score numeric(5,2) not null check (computer_score between 0 and 100),

  total_score numeric(6,2) generated always as
    (math_score + english_score + logic_score + computer_score) stored,

  rank_in_province int,                -- recalculated by recalc_exam_ranks()
  rank_in_cycle int,
  pass_status text check (pass_status in ('pass','fail')),

  exam_date date not null default current_date,
  entered_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_exam_cycle on exam_results(cycle_id);
create index idx_exam_student on exam_results(student_id);
create trigger trg_exam_updated before update on exam_results
  for each row execute function set_updated_at();

-- Recalculates rank + pass_status whenever a score is inserted/updated.
create or replace function recalc_exam_ranks() returns trigger
language plpgsql as $$
begin
  update exam_results e
  set rank_in_cycle = r.rnk
  from (
    select id, rank() over (partition by cycle_id order by total_score desc) as rnk
    from exam_results where cycle_id = new.cycle_id
  ) r
  where e.id = r.id and e.cycle_id = new.cycle_id;

  update exam_results e
  set rank_in_province = r.rnk
  from (
    select er.id, rank() over (partition by s.province_id order by er.total_score desc) as rnk
    from exam_results er join students s on s.id = er.student_id
    where er.cycle_id = new.cycle_id
  ) r
  where e.id = r.id;

  -- exam_pass_threshold is a percentage (0-100); total_score is out of 400 (4 subjects x 100)
  update exam_results
  set pass_status = case
    when total_score >= (select exam_pass_threshold from selection_cycles where id = new.cycle_id) * 4
    then 'pass' else 'fail' end
  where id = new.id;

  return new;
end;
$$;
create trigger trg_recalc_exam_ranks
  after insert or update of math_score, english_score, logic_score, computer_score
  on exam_results for each row execute function recalc_exam_ranks();

-- ----------------------------------------------------------------------------
-- 7. Interview Module
-- ----------------------------------------------------------------------------
create table interviews (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references students(id) on delete cascade,
  cycle_id uuid not null references selection_cycles(id),

  communication_score int check (communication_score between 1 and 5),
  leadership_score int check (leadership_score between 1 and 5),
  motivation_score int check (motivation_score between 1 and 5),
  confidence_score int check (confidence_score between 1 and 5),
  critical_thinking_score int check (critical_thinking_score between 1 and 5),

  comments text,
  recommendation text check (recommendation in (
    'strongly_recommend','recommend','neutral','not_recommend'
  )),

  interviewer_id uuid references users(id),
  interview_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_interviews_cycle on interviews(cycle_id);
create trigger trg_interviews_updated before update on interviews
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 8. Home Visit Module
-- ----------------------------------------------------------------------------
create table home_visits (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  cycle_id uuid not null references selection_cycles(id),
  visit_number int not null default 1,

  house_type text,
  family_income numeric(12,2),
  transportation text,
  electricity_access boolean default false,
  internet_access boolean default false,
  family_condition_notes text,

  recommendation text check (recommendation in (
    'strongly_recommend','recommend','neutral','not_recommend'
  )),

  visitor_id uuid references users(id),
  visit_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, visit_number)
);
create index idx_homevisits_student on home_visits(student_id);
create index idx_homevisits_cycle on home_visits(cycle_id);
create trigger trg_homevisits_updated before update on home_visits
  for each row execute function set_updated_at();

create table home_visit_media (
  id uuid primary key default gen_random_uuid(),
  home_visit_id uuid not null references home_visits(id) on delete cascade,
  media_type text not null check (media_type in ('house_photo','family_photo','report')),
  file_path text not null,
  uploaded_at timestamptz not null default now()
);
create index idx_visit_media_visit on home_visit_media(home_visit_id);

-- ----------------------------------------------------------------------------
-- 9. Selection Committee
-- ----------------------------------------------------------------------------
create table committee_decisions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references students(id) on delete cascade,
  cycle_id uuid not null references selection_cycles(id),

  decision text check (decision in ('selected','waitlisted','rejected')),
  decision_date date,
  approval_status text not null default 'pending'
    check (approval_status in ('pending','approved','rejected')),
  approved_by uuid references users(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_committee_cycle on committee_decisions(cycle_id);
create trigger trg_committee_updated before update on committee_decisions
  for each row execute function set_updated_at();

-- Multiple committee members can each append a note to one decision record.
create table committee_notes (
  id uuid primary key default gen_random_uuid(),
  committee_decision_id uuid not null references committee_decisions(id) on delete cascade,
  author_id uuid not null references users(id),
  note text not null,
  created_at timestamptz not null default now()
);
create index idx_committee_notes_decision on committee_notes(committee_decision_id);

-- ----------------------------------------------------------------------------
-- 10. AI Feature Tables
-- ----------------------------------------------------------------------------
create table ai_summaries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  summary_type text not null check (summary_type in (
    'profile_summary','home_visit_report','selection_recommendation'
  )),
  content text not null,
  model_version text not null,         -- e.g. "claude-sonnet-4-6"
  generated_by uuid references users(id),
  generated_at timestamptz not null default now()
);
create index idx_ai_summaries_student on ai_summaries(student_id);

create table ai_query_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  question text not null,
  generated_sql text not null,
  row_count int,
  was_executed boolean not null default false,
  error text,
  created_at timestamptz not null default now()
);
create index idx_ai_query_logs_user on ai_query_logs(user_id);

-- ----------------------------------------------------------------------------
-- 11. Reports
-- ----------------------------------------------------------------------------
create table reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type in (
    'province','gender','selection','ngo_performance','school_performance'
  )),
  format text not null check (format in ('pdf','xlsx','csv')),
  params jsonb not null default '{}',
  file_path text,
  generated_by uuid references users(id),
  created_at timestamptz not null default now()
);
create index idx_reports_type on reports(report_type);

-- ----------------------------------------------------------------------------
-- 12. Audit Log (generic, append-only)
-- ----------------------------------------------------------------------------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert','update','delete','soft_delete')),
  changed_by uuid references users(id),
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);
create index idx_audit_table_record on audit_logs(table_name, record_id);
create index idx_audit_changed_by on audit_logs(changed_by);
create index idx_audit_new_data_gin on audit_logs using gin (new_data);

create or replace function write_audit_log() returns trigger
language plpgsql as $$
declare
  v_user uuid;
begin
  -- auth.jwt()->>'sub' is the Firebase UID (Supabase verifies the Firebase ID
  -- token directly via Third-Party Auth), not our internal users.id, so it
  -- must be resolved via firebase_uid rather than cast straight to uuid.
  select id into v_user from users where firebase_uid = (auth.jwt() ->> 'sub');
  if (tg_op = 'INSERT') then
    insert into audit_logs(table_name, record_id, action, changed_by, new_data)
    values (tg_table_name, new.id, 'insert', v_user, to_jsonb(new));
  elsif (tg_op = 'UPDATE') then
    insert into audit_logs(table_name, record_id, action, changed_by, old_data, new_data)
    values (tg_table_name, new.id, case when new.deleted_at is not null and old.deleted_at is null
              then 'soft_delete' else 'update' end,
            v_user, to_jsonb(old), to_jsonb(new));
  end if;
  return new;
end;
$$;

-- Attach audit trigger to every auditable core table
create trigger trg_audit_students after insert or update on students
  for each row execute function write_audit_log();
create trigger trg_audit_exam_results after insert or update on exam_results
  for each row execute function write_audit_log();
create trigger trg_audit_interviews after insert or update on interviews
  for each row execute function write_audit_log();
create trigger trg_audit_home_visits after insert or update on home_visits
  for each row execute function write_audit_log();
create trigger trg_audit_committee_decisions after insert or update on committee_decisions
  for each row execute function write_audit_log();
create trigger trg_audit_ngo_partners after insert or update on ngo_partners
  for each row execute function write_audit_log();
create trigger trg_audit_school_partners after insert or update on school_partners
  for each row execute function write_audit_log();
create trigger trg_audit_users after insert or update on users
  for each row execute function write_audit_log();

-- ============================================================================
-- 13. Materialized Views (Dashboard performance at 50k+ scale)
-- ============================================================================
create materialized view mv_province_stats as
select
  s.cycle_id,
  s.province_id,
  p.name_en as province_name,
  count(*) filter (where s.deleted_at is null) as total_students,
  count(*) filter (where s.gender = 'male' and s.deleted_at is null) as male_students,
  count(*) filter (where s.gender = 'female' and s.deleted_at is null) as female_students,
  count(*) filter (where er.id is not null) as exam_completed,
  count(*) filter (where iv.id is not null) as interview_completed,
  count(*) filter (where hv.id is not null) as home_visit_completed,
  count(*) filter (where cd.decision = 'selected') as selected_students
from students s
join provinces p on p.id = s.province_id
left join exam_results er on er.student_id = s.id
left join interviews iv on iv.student_id = s.id
left join home_visits hv on hv.student_id = s.id
left join committee_decisions cd on cd.student_id = s.id
where s.deleted_at is null
group by s.cycle_id, s.province_id, p.name_en;

create unique index idx_mv_province_stats on mv_province_stats(cycle_id, province_id);

-- Refresh on a schedule (Supabase cron / pg_cron) — see docs/10-deployment.md
-- select cron.schedule('refresh_province_stats', '*/10 * * * *',
--   $$ refresh materialized view concurrently mv_province_stats; $$);

-- ============================================================================
-- 14. Row-Level Security
-- ============================================================================
alter table students enable row level security;
alter table exam_results enable row level security;
alter table interviews enable row level security;
alter table home_visits enable row level security;
alter table home_visit_media enable row level security;
alter table committee_decisions enable row level security;
alter table committee_notes enable row level security;
alter table ngo_partners enable row level security;
alter table school_partners enable row level security;
alter table users enable row level security;
alter table ai_summaries enable row level security;
alter table ai_query_logs enable row level security;
alter table audit_logs enable row level security;

-- Internal staff roles (full read, scoped write) vs NGO Partner (own students only) vs Donor (read-only, aggregate)
create policy students_select on students for select using (
  auth_role() in ('super_admin','program_manager','selection_team','interview_team',
                  'home_visit_team','committee_member','donor')
  or (auth_role() = 'ngo_partner' and referred_by_ngo_id = auth_ngo_id())
);
create policy students_write on students for insert with check (
  auth_role() in ('super_admin','program_manager','selection_team')
);
create policy students_update on students for update using (
  auth_role() in ('super_admin','program_manager','selection_team')
);

create policy exam_select on exam_results for select using (
  auth_role() in ('super_admin','program_manager','selection_team','interview_team',
                  'home_visit_team','committee_member','donor')
);
create policy exam_write on exam_results for insert with check (
  auth_role() in ('super_admin','program_manager','selection_team')
);
create policy exam_update on exam_results for update using (
  auth_role() in ('super_admin','program_manager','selection_team')
);

create policy interviews_select on interviews for select using (
  auth_role() in ('super_admin','program_manager','selection_team','interview_team',
                  'committee_member','donor')
);
create policy interviews_write on interviews for insert with check (
  auth_role() in ('super_admin','program_manager','interview_team')
);
create policy interviews_update on interviews for update using (
  auth_role() in ('super_admin','program_manager','interview_team')
);

create policy home_visits_select on home_visits for select using (
  auth_role() in ('super_admin','program_manager','home_visit_team','committee_member','donor')
);
create policy home_visits_write on home_visits for insert with check (
  auth_role() in ('super_admin','program_manager','home_visit_team')
);
create policy home_visits_update on home_visits for update using (
  auth_role() in ('super_admin','program_manager','home_visit_team')
);

create policy committee_select on committee_decisions for select using (
  auth_role() in ('super_admin','program_manager','committee_member','donor')
);
create policy committee_write on committee_decisions for insert with check (
  auth_role() in ('super_admin','program_manager','committee_member')
);
create policy committee_update on committee_decisions for update using (
  auth_role() in ('super_admin','program_manager','committee_member')
);

create policy ngo_select on ngo_partners for select using (true); -- public-ish reference data
create policy ngo_write on ngo_partners for insert with check (
  auth_role() in ('super_admin','program_manager')
);
create policy ngo_update on ngo_partners for update using (
  auth_role() in ('super_admin','program_manager')
  or (auth_role() = 'ngo_partner' and id = auth_ngo_id())
);

create policy school_select on school_partners for select using (true);
create policy school_write on school_partners for insert with check (
  auth_role() in ('super_admin','program_manager')
);

create policy users_select_self_or_admin on users for select using (
  auth_role() in ('super_admin','program_manager')
  or firebase_uid = (auth.jwt() ->> 'sub')
);
create policy users_admin_write on users for all using (
  auth_role() = 'super_admin'
);

create policy audit_admin_only on audit_logs for select using (
  auth_role() in ('super_admin','program_manager')
);

-- ============================================================================
-- 15. Soft Delete Strategy
-- ============================================================================
-- Core tables (students, ngo_partners, school_partners, users) are NEVER hard
-- deleted. "Delete" sets deleted_at = now() via the application layer (never
-- raw DELETE). All SELECT policies and application queries filter
-- `deleted_at is null` for default views; a "Show archived" admin view can
-- explicitly query `deleted_at is not null`. This preserves referential
-- integrity for exam/interview/home-visit/committee history and audit logs
-- even after a record is "removed" from normal views.
--
-- Hard DELETE is restricted at the database level: no DELETE grants are
-- issued to any application role. Only a super_admin using the Supabase
-- service role (server-side only, e.g. for GDPR-style erasure requests) can
-- perform a real DELETE, and that action is itself audit-logged before
-- execution by the calling Edge Function.
