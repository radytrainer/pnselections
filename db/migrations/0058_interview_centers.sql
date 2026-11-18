-- Interview centers (Motivation Interview venues) per cycle, and each
-- student's interview center — recorded at the interview or assigned ahead of
-- time, filterable on the Students page, counted on Selection Process.

create table if not exists interview_centers (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references selection_cycles(id) on delete cascade,
  name text not null,
  province_id uuid references provinces(id),
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, name)
);
create index if not exists idx_interview_centers_cycle on interview_centers(cycle_id);
create trigger trg_interview_centers_updated before update on interview_centers
  for each row execute function set_updated_at();

alter table interview_centers enable row level security;
-- Everyone who can see students can see the centers' names.
create policy interview_centers_select on interview_centers for select using (
  auth_role() in ('super_admin','program_manager','selection_team','interview_team','home_visit_team','committee_member','donor','ngo_partner')
);
create policy interview_centers_write on interview_centers for insert
  with check (auth_role() in ('super_admin','program_manager','selection_team','interview_team'));
create policy interview_centers_update on interview_centers for update
  using (auth_role() in ('super_admin','program_manager','selection_team','interview_team'));
create policy interview_centers_delete on interview_centers for delete
  using (auth_role() in ('super_admin','program_manager','selection_team','interview_team'));

drop trigger if exists trg_audit_interview_centers on interview_centers;
create trigger trg_audit_interview_centers after insert or update or delete on interview_centers
  for each row execute function write_audit_log();

alter table students add column if not exists interview_center_id uuid references interview_centers(id) on delete set null;
create index if not exists idx_students_interview_center on students(interview_center_id);

-- The interview team records interviews but may not edit student records
-- (students_update RLS). These two functions let interview roles change only
-- what the interview decides: the interview center and the interview outcome.

create or replace function assign_interview_center(p_students uuid[], p_center uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth_role() not in ('super_admin','program_manager','selection_team','interview_team') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_center is not null and exists (
    select 1 from students s where s.id = any(p_students)
      and s.cycle_id <> (select cycle_id from interview_centers where id = p_center)
  ) then
    raise exception 'That interview center belongs to another cycle' using errcode = '22023';
  end if;
  update students set interview_center_id = p_center where id = any(p_students) and deleted_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- recommendation: A1/A2 = passed, not_recommended = failed (eliminated, reason
-- below); a later "passed" undoes an interview elimination. p_center null =
-- leave the interview center unchanged.
create or replace function apply_interview_outcome(p_student uuid, p_recommendation text, p_center uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  st record;
  reason constant text := 'Did not pass the Motivation Interview';
begin
  if auth_role() not in ('super_admin','program_manager','selection_team','interview_team') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select status, elimination_reason, cycle_id into st from students where id = p_student;
  if not found then return; end if;
  if p_center is not null then
    if not exists (select 1 from interview_centers where id = p_center and cycle_id = st.cycle_id) then
      raise exception 'That interview center belongs to another cycle' using errcode = '22023';
    end if;
    update students set interview_center_id = p_center where id = p_student;
  end if;
  if p_recommendation = 'not_recommended' then
    if st.status in ('registered','exam_completed','interview_completed') then
      update students set status = 'eliminated', elimination_reason = reason where id = p_student;
    end if;
  elsif p_recommendation in ('A1','A2') then
    if st.status = 'eliminated' and st.elimination_reason = reason then
      update students set status = 'interview_completed', elimination_reason = null where id = p_student;
    elsif st.status in ('registered','exam_completed') then
      update students set status = 'interview_completed' where id = p_student;
    end if;
  end if;
end $$;

grant execute on function assign_interview_center(uuid[], uuid) to authenticated;
grant execute on function apply_interview_outcome(uuid, text, uuid) to authenticated;
