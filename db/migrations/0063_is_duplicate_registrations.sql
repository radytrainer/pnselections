-- Stop the same student registering many times (information sessions).
--
-- Before: only the exact same name + date of birth in the SAME session was
-- caught. Now a registration is "already registered" when, anywhere in the
-- cycle (any session), there is:
--   * a registration, exam candidate or student with the same name and the
--     same date of birth, or
--   * a registration with the same name and the same phone number
--     (catches a mistyped birth date).
-- Names are compared ignoring capitals, spaces and punctuation, in either order
-- ("Sok Dara" = "DARA  sok"). Date of birth becomes required on the form so the
-- check is reliable.

create or replace function person_name_key(p text)
returns text language sql immutable as $$
  select regexp_replace(lower(coalesce(p, '')), '[[:space:][:punct:]]+', '', 'g')
$$;

-- Same person by name: first+last of one equals first+last or last+first of the other.
create or replace function same_person_name(f1 text, l1 text, f2 text, l2 text)
returns boolean language sql immutable as $$
  select person_name_key(f1) || person_name_key(l1) <> ''
     and person_name_key(f1) || person_name_key(l1) in (person_name_key(f2) || person_name_key(l2), person_name_key(l2) || person_name_key(f2))
$$;

-- Digits only, for phone comparison ("012 345-678" = "012345678").
create or replace function phone_key(p text)
returns text language sql immutable as $$
  select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g')
$$;

grant execute on function person_name_key(text) to authenticated;
grant execute on function same_person_name(text, text, text, text) to authenticated;
grant execute on function phone_key(text) to authenticated;

create or replace function public_register(p_token text, p jsonb)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  s information_sessions%rowtype;
  v_first text := left(trim(regexp_replace(coalesce(p->>'first_name', ''), '\s+', ' ', 'g')), 100);
  v_last text := left(trim(regexp_replace(coalesce(p->>'last_name', ''), '\s+', ' ', 'g')), 100);
  v_gender text := p->>'gender';
  v_phone text := nullif(left(trim(coalesce(p->>'phone', '')), 30), '');
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
  if v_dob is null then return json_build_object('ok', false, 'reason', 'dob_required'); end if;
  if v_dob < date '1980-01-01' or v_dob > current_date then
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

  -- Already registered anywhere in this cycle?
  if exists (
       select 1 from is_registrations r
        where r.cycle_id = s.cycle_id and same_person_name(r.first_name, r.last_name, v_first, v_last)
          and (r.dob = v_dob or (length(phone_key(v_phone)) >= 8 and phone_key(r.phone) = phone_key(v_phone))))
     or exists (
       select 1 from exam_candidates c
        where c.cycle_id = s.cycle_id and c.dob = v_dob
          and (same_person_name(c.first_name, c.last_name, v_first, v_last)
               or person_name_key(c.full_name) in (person_name_key(v_first) || person_name_key(v_last), person_name_key(v_last) || person_name_key(v_first))))
     or exists (
       select 1 from students st
        where st.cycle_id = s.cycle_id and st.deleted_at is null and st.dob = v_dob
          and same_person_name(st.first_name, st.last_name, v_first, v_last))
  then
    return json_build_object('ok', true, 'duplicate', true, 'session_id', s.id);
  end if;

  insert into is_registrations (session_id, cycle_id, first_name, last_name, gender, dob, phone, high_school, grade, province_id, exam_center_id)
  values (s.id, s.cycle_id, v_first, v_last, v_gender, v_dob, v_phone,
          nullif(left(trim(coalesce(p->>'high_school', '')), 200), ''),
          nullif(left(trim(coalesce(p->>'grade', '')), 20), ''),
          v_province, v_center);
  return json_build_object('ok', true, 'session_id', s.id);
end $$;
