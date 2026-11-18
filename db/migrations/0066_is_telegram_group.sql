-- Telegram group per information session: after registering (or being told
-- they're already registered) students see a "Join Telegram group" button.
-- The link is only returned by a successful submit, not with the empty form.

alter table information_sessions add column if not exists telegram_url text
  check (telegram_url is null or telegram_url ~ '^https://(t\.me|telegram\.me)/[A-Za-z0-9_+/-]+$');

create or replace function public_register(p_token text, p jsonb)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  s information_sessions%rowtype;
  v_first text := left(trim(regexp_replace(coalesce(p->>'first_name', ''), '\s+', ' ', 'g')), 100);
  v_last text := left(trim(regexp_replace(coalesce(p->>'last_name', ''), '\s+', ' ', 'g')), 100);
  v_gender text := p->>'gender';
  v_phone_in text := trim(coalesce(p->>'phone', ''));
  v_phone text;
  v_school text := left(trim(regexp_replace(coalesce(p->>'high_school', ''), '\s+', ' ', 'g')), 200);
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
  if v_school = '' then return json_build_object('ok', false, 'reason', 'school_required'); end if;
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
    return json_build_object('ok', true, 'duplicate', true, 'session_id', s.id, 'telegram_url', s.telegram_url);
  end if;

  insert into is_registrations (session_id, cycle_id, first_name, last_name, gender, dob, phone, high_school, grade, province_id, exam_center_id)
  values (s.id, s.cycle_id, v_first, v_last, v_gender, v_dob, v_phone, v_school, '12', v_province, v_center);
  return json_build_object('ok', true, 'session_id', s.id, 'telegram_url', s.telegram_url);
end $$;
