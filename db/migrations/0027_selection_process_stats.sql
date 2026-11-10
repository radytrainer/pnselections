-- New "Selection Process" page tracks the recruitment funnel (information
-- sessions -> exam centers/results -> interview centers/results) as a set
-- of manually-entered, per-cycle aggregate numbers — there's no granular
-- per-session/per-center data model behind this, just one editable row of
-- counts per section per cycle, matching how the program currently tracks
-- this funnel (spreadsheet-style totals, not individual session records).
-- cycle_id is the primary key: exactly one stats row per section per cycle.

create table information_session_stats (
  cycle_id uuid primary key references selection_cycles(id) on delete cascade,
  sessions_done int not null default 0,
  sessions_planned int not null default 0,
  sessions_without_date int not null default 0,
  sessions_without_hosting_partner int not null default 0,
  attendees_expected_boys int not null default 0,
  attendees_expected_girls int not null default 0,
  attendees_actual_boys int not null default 0,
  attendees_actual_girls int not null default 0,
  additional_expected_boys int not null default 0,
  additional_expected_girls int not null default 0,
  sessions_without_expected_number int not null default 0,
  applicants_total int not null default 0,
  applicants_girls int not null default 0,
  applicants_boys int not null default 0,
  updated_at timestamptz not null default now()
);

create table exam_center_stats (
  cycle_id uuid primary key references selection_cycles(id) on delete cascade,
  centers_total int not null default 0,
  sessions_done int not null default 0,
  sessions_not_done int not null default 0,
  info_sessions_not_linked int not null default 0,
  applicants_total int not null default 0,
  applicants_not_assigned int not null default 0,
  applicants_without_schedule int not null default 0,
  updated_at timestamptz not null default now()
);

create table exam_result_stats (
  cycle_id uuid primary key references selection_cycles(id) on delete cascade,
  attended int not null default 0,
  absent int not null default 0,
  partially_attended int not null default 0,
  still_to_be_done int not null default 0,
  passed int not null default 0,
  passed_girls int not null default 0,
  passed_boys int not null default 0,
  updated_at timestamptz not null default now()
);

create table interview_center_stats (
  cycle_id uuid primary key references selection_cycles(id) on delete cascade,
  centers_total int not null default 0,
  sessions_done int not null default 0,
  sessions_not_done int not null default 0,
  exam_centers_not_linked int not null default 0,
  applicants_eligible int not null default 0,
  applicants_not_assigned int not null default 0,
  applicants_without_schedule int not null default 0,
  updated_at timestamptz not null default now()
);

create table interview_result_stats (
  cycle_id uuid primary key references selection_cycles(id) on delete cascade,
  attended int not null default 0,
  absent int not null default 0,
  still_to_be_done int not null default 0,
  passed int not null default 0,
  passed_girls int not null default 0,
  passed_boys int not null default 0,
  updated_at timestamptz not null default now()
);

create trigger trg_information_session_stats_updated before update on information_session_stats
  for each row execute function set_updated_at();
create trigger trg_exam_center_stats_updated before update on exam_center_stats
  for each row execute function set_updated_at();
create trigger trg_exam_result_stats_updated before update on exam_result_stats
  for each row execute function set_updated_at();
create trigger trg_interview_center_stats_updated before update on interview_center_stats
  for each row execute function set_updated_at();
create trigger trg_interview_result_stats_updated before update on interview_result_stats
  for each row execute function set_updated_at();

alter table information_session_stats enable row level security;
alter table exam_center_stats enable row level security;
alter table exam_result_stats enable row level security;
alter table interview_center_stats enable row level security;
alter table interview_result_stats enable row level security;

-- Read access mirrors students_select's staff group (everyone who works the
-- pipeline day to day); write access mirrors createEditStudents — the roles
-- that already own pipeline data entry.
do $$
declare
  t text;
begin
  foreach t in array array[
    'information_session_stats',
    'exam_center_stats',
    'exam_result_stats',
    'interview_center_stats',
    'interview_result_stats'
  ]
  loop
    execute format(
      $f$create policy %1$I_select on %1$I for select using (
        auth_role() in ('super_admin','program_manager','selection_team','interview_team','home_visit_team','committee_member','donor')
      )$f$,
      t
    );
    execute format(
      $f$create policy %1$I_write on %1$I for insert with check (
        auth_role() in ('super_admin','program_manager','selection_team')
      )$f$,
      t
    );
    execute format(
      $f$create policy %1$I_update on %1$I for update using (
        auth_role() in ('super_admin','program_manager','selection_team')
      )$f$,
      t
    );
  end loop;
end $$;
