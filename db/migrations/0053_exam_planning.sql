-- Written exams, Phase 2: exam centers with rooms and sessions, and candidate
-- details needed for planning and statistics (gender, center/session/room).
-- Attendance is derived: a candidate with a scanned sheet for a paper was present.

create table exam_centers (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references selection_cycles(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  province_id uuid references provinces(id),
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, name)
);
create index idx_exam_centers_cycle on exam_centers(cycle_id);

create table exam_rooms (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references exam_centers(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  capacity int check (capacity is null or capacity > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_exam_rooms_center on exam_rooms(center_id);

create table exam_sessions (
  id uuid primary key default gen_random_uuid(),
  center_id uuid not null references exam_centers(id) on delete cascade,
  session_date date not null,
  start_time time,
  end_time time,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time is null or start_time is null or end_time > start_time)
);
create index idx_exam_sessions_center on exam_sessions(center_id);

alter table exam_candidates
  add column if not exists gender text check (gender in ('male', 'female', 'lgbtqia+')),
  add column if not exists center_id uuid references exam_centers(id) on delete set null,
  add column if not exists session_id uuid references exam_sessions(id) on delete set null,
  add column if not exists room_id uuid references exam_rooms(id) on delete set null;

do $$
declare t text;
begin
  foreach t in array array['exam_centers','exam_rooms','exam_sessions']
  loop
    execute format('create trigger trg_%1$s_updated before update on %1$I for each row execute function set_updated_at()', t);
    execute format('alter table %I enable row level security', t);
    execute format($f$create policy %1$I_select on %1$I for select using (auth_role() in ('super_admin','program_manager','selection_team'))$f$, t);
    execute format($f$create policy %1$I_write on %1$I for insert with check (auth_role() in ('super_admin','program_manager','selection_team'))$f$, t);
    execute format($f$create policy %1$I_update on %1$I for update using (auth_role() in ('super_admin','program_manager','selection_team'))$f$, t);
    execute format($f$create policy %1$I_delete on %1$I for delete using (auth_role() in ('super_admin','program_manager','selection_team'))$f$, t);
    execute format('drop trigger if exists trg_audit_%1$s on %1$I', t);
    execute format('create trigger trg_audit_%1$s after insert or update or delete on %1$I for each row execute function write_audit_log()', t);
  end loop;
end $$;
