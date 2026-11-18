-- Information-session registration rules:
--  * Phone is required and must be a Cambodian mobile number from Smart,
--    Cellcard or Metfone. Accepted as 012345678, 012 345 678, +855 12 345 678
--    or 85512345678; stored as 0XXXXXXXX(X).
--  * The student must be 17 to 24 years old on the day they register.
-- Same rules as features/info-sessions/rules.ts (instant feedback on the form).

-- Normalized Cambodian mobile number (leading 0), or null when it isn't a
-- Smart / Cellcard / Metfone number.
create or replace function khmer_mobile(p text)
returns text language plpgsql immutable as $$
declare
  d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
begin
  if d like '855%' then d := '0' || substr(d, 4); end if;
  if d like '00%' then return null; end if;
  if left(d, 1) <> '0' then d := '0' || d; end if;
  -- Smart: 10 15 16 69 70 81 86 87 93 96 98
  -- Cellcard: 11 12 14 17 61 76 77 78 79 85 89 92 95 99
  -- Metfone: 31 60 66 67 68 71 88 90 97
  if d ~ '^0(10|15|16|69|70|81|86|87|93|96|98|11|12|14|17|61|76|77|78|79|85|89|92|95|99|31|60|66|67|68|71|88|90|97)[0-9]{6,7}$' then
    return d;
  end if;
  return null;
end $$;
grant execute on function khmer_mobile(text) to authenticated;

create or replace function public_register(p_token text, p jsonb)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  s information_sessions%rowtype;
  v_first text := left(trim(regexp_replace(coalesce(p->>'first_name', ''), '\s+', ' ', 'g')), 100);
  v_last text := left(trim(regexp_replace(coalesce(p->>'last_name', ''), '\s+', ' ', 'g')), 100);
  v_gender text := p->>'gender';
  v_phone_in text := trim(coalesce(p->>'phone', ''));
  v_phone text;
  v_dob date;
  v_age int;
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
  if v_dob > current_date then return json_build_object('ok', false, 'reason', 'bad_dob'); end if;
  v_age := extract(year from age(current_date, v_dob))::int;
  if v_age < 17 or v_age > 24 then
    return json_build_object('ok', false, 'reason', 'age');
  end if;
  if v_phone_in = '' then return json_build_object('ok', false, 'reason', 'phone_required'); end if;
  v_phone := khmer_mobile(v_phone_in);
  if v_phone is null then return json_build_object('ok', false, 'reason', 'bad_phone'); end if;
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

  -- Already registered anywhere in this cycle? (migration 0063)
  if exists (
       select 1 from is_registrations r
        where r.cycle_id = s.cycle_id and same_person_name(r.first_name, r.last_name, v_first, v_last)
          and (r.dob = v_dob or coalesce(khmer_mobile(r.phone), phone_key(r.phone)) = v_phone))
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
