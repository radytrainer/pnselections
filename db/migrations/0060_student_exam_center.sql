-- A student's written-exam center travels with them to the Motivation Interview
-- (Students list: shown on each student and filterable).
--
-- The center is read from the exam candidate linked to the student
-- (exam_candidates.student_id), never copied, so moving a candidate to another
-- center or room is reflected immediately. The exam tables are only readable by
-- super_admin / program_manager / selection_team (0052), but the interview team
-- and others who work the Students list need the center too — so these
-- security-definer helpers expose just the center id/name, to the same staff
-- roles that can read students (students_select).

create or replace function student_exam_center_id(p_student uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select c.center_id
    from exam_candidates c
   where c.student_id = p_student and c.center_id is not null
     and auth_role() in ('super_admin','program_manager','selection_team','interview_team',
                         'home_visit_team','committee_member','donor')
   limit 1
$$;

create or replace function student_exam_center_name(p_student uuid)
returns text language sql stable security definer set search_path = public as $$
  select ec.name
    from exam_candidates c join exam_centers ec on ec.id = c.center_id
   where c.student_id = p_student
     and auth_role() in ('super_admin','program_manager','selection_team','interview_team',
                         'home_visit_team','committee_member','donor')
   limit 1
$$;

-- The cycle's exam centers with how many linked students each has (Students filter).
create or replace function exam_centers_for_students(p_cycle uuid)
returns table (id uuid, name text, students int)
language sql stable security definer set search_path = public as $$
  select ec.id, ec.name,
         (select count(*)::int from exam_candidates c join students s on s.id = c.student_id
           where c.center_id = ec.id and s.deleted_at is null) as students
    from exam_centers ec
   where ec.cycle_id = p_cycle
     and auth_role() in ('super_admin','program_manager','selection_team','interview_team',
                         'home_visit_team','committee_member','donor')
   order by ec.name
$$;

grant execute on function student_exam_center_id(uuid) to authenticated;
grant execute on function student_exam_center_name(uuid) to authenticated;
grant execute on function exam_centers_for_students(uuid) to authenticated;
