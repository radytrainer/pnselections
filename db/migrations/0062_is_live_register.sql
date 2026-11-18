-- Live registration display (information sessions).
-- public_register now also returns the session id so the API can notify the
-- live display for that session (Redis pub/sub -> Server-Sent Events). The API
-- strips session_id before answering the public form.

create or replace function public_register(p_token text, p jsonb)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  s information_sessions%rowtype;
  v_first text := left(trim(regexp_replace(coalesce(p->>'first_name', ''), '\s+', ' ', 'g')), 100);
  v_last text := left(trim(regexp_replace(coalesce(p->>'last_name', ''), '\s+', ' ', 'g')), 100);
  v_gender text := p->>'gender';
  v_dob date;
  v_center uuid;
  v_province uuid;
begin
  select * into s from information_sessions where reg_token = p_token;
  if not found then return json_build_object('ok', false, 'reason', 'not_found'); end if;
  if not s.reg_open then return json_build_object('ok', false, 'reason', 'closed'); end if;
  if s.reg_expires_at is not null and s.reg_expires_at <= now() then
    return json_build_object('ok', false, 'reason', 'expired');
  end if;
  if v_first = '' or v_last = '' then return json_build_object('ok', false, 'reason', 'name_required'); end if;
  if v_gender is null or v_gender not in ('male', 'female', 'lgbtqia+') then
    return json_build_object('ok', false, 'reason', 'gender_required');
  end if;
  begin
    v_dob := nullif(p->>'dob', '')::date;
  exception when others then
    return json_build_object('ok', false, 'reason', 'bad_dob');
  end;
  if v_dob is not null and (v_dob < date '1980-01-01' or v_dob > current_date) then
    return json_build_object('ok', false, 'reason', 'bad_dob');
  end if;
  begin
    v_center := nullif(p->>'exam_center_id', '')::uuid;
    v_province := nullif(p->>'province_id', '')::uuid;
  exception when others then
    return json_build_object('ok', false, 'reason', 'bad_choice');
  end;
  if v_center is not null and not exists (select 1 from exam_centers where id = v_center and cycle_id = s.cycle_id) then
    return json_build_object('ok', false, 'reason', 'bad_choice');
  end if;
  if exists (select 1 from exam_centers where cycle_id = s.cycle_id) and v_center is null then
    return json_build_object('ok', false, 'reason', 'center_required');
  end if;
  if v_province is not null and not exists (select 1 from provinces where id = v_province) then
    return json_build_object('ok', false, 'reason', 'bad_choice');
  end if;

  if exists (
    select 1 from is_registrations r
     where r.session_id = s.id and lower(r.first_name) = lower(v_first) and lower(r.last_name) = lower(v_last)
       and r.dob is not distinct from v_dob
  ) then
    return json_build_object('ok', true, 'duplicate', true, 'session_id', s.id);
  end if;

  insert into is_registrations (session_id, cycle_id, first_name, last_name, gender, dob, phone, high_school, grade, province_id, exam_center_id)
  values (s.id, s.cycle_id, v_first, v_last, v_gender, v_dob,
          nullif(left(trim(coalesce(p->>'phone', '')), 30), ''),
          nullif(left(trim(coalesce(p->>'high_school', '')), 200), ''),
          nullif(left(trim(coalesce(p->>'grade', '')), 20), ''),
          v_province, v_center);
  return json_build_object('ok', true, 'session_id', s.id);
end $$;
