-- Information sessions (IS) with online self-registration.
--
-- Staff create a session for a cycle (school/venue, date). Each session has its
-- own registration link (and QR code) that students open without logging in to
-- fill a short form, choosing the exam center where they will sit the written
-- exam. Staff can close the link, set an expiry, or issue a new link (the old
-- link and QR stop working). Registrations wait on the session page until staff
-- add them to the cycle's exam candidates.
--
-- The public form never touches tables directly: the API runs it under an
-- anonymous claim with no RLS grants, and only the two security-definer
-- functions below (public_registration_form / public_register) can read the
-- form data and insert a registration, after checking the link is open.

create table information_sessions (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references selection_cycles(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  venue text,
  province_id uuid references provinces(id),
  session_date date,
  notes text,
  -- Pre-selected exam center on the form (students can change it).
  default_exam_center_id uuid references exam_centers(id) on delete set null,
  -- Registration link: /register/<reg_token>
  reg_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  reg_open boolean not null default true,
  reg_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_information_sessions_cycle on information_sessions(cycle_id);
create trigger trg_information_sessions_updated before update on information_sessions
  for each row execute function set_updated_at();

create table is_registrations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references information_sessions(id) on delete cascade,
  cycle_id uuid not null references selection_cycles(id) on delete cascade,
  first_name text not null check (length(trim(first_name)) > 0),
  last_name text not null check (length(trim(last_name)) > 0),
  gender text not null check (gender in ('male', 'female', 'lgbtqia+')),
  dob date,
  phone text,
  high_school text,
  grade text,
  province_id uuid references provinces(id),
  exam_center_id uuid references exam_centers(id) on delete set null,
  -- Set once staff add the registration to the exam candidates.
  candidate_id uuid references exam_candidates(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_is_registrations_session on is_registrations(session_id);
create index idx_is_registrations_cycle on is_registrations(cycle_id);

-- Same staff group as the written-exam tables (0052).
alter table information_sessions enable row level security;
alter table is_registrations enable row level security;
do $$
declare t text;
begin
  foreach t in array array['information_sessions', 'is_registrations'] loop
    execute format($f$create policy %1$I_select on %1$I for select using (auth_role() in ('super_admin','program_manager','selection_team'))$f$, t);
    execute format($f$create policy %1$I_write on %1$I for insert with check (auth_role() in ('super_admin','program_manager','selection_team'))$f$, t);
    execute format($f$create policy %1$I_update on %1$I for update using (auth_role() in ('super_admin','program_manager','selection_team'))$f$, t);
    execute format($f$create policy %1$I_delete on %1$I for delete using (auth_role() in ('super_admin','program_manager','selection_team'))$f$, t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

create trigger trg_audit_information_sessions after insert or update or delete on information_sessions
  for each row execute function write_audit_log();
create trigger trg_audit_is_registrations after update or delete on is_registrations
  for each row execute function write_audit_log();

-- ---------------------------------------------------------------------------
-- Public form: what the registration page shows for a link.
-- status: open | closed | expired | not_found (no session details unless open).
-- ---------------------------------------------------------------------------
create or replace function public_registration_form(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  s information_sessions%rowtype;
begin
  select * into s from information_sessions where reg_token = p_token;
  if not found then return json_build_object('status', 'not_found'); end if;
  if not s.reg_open then return json_build_object('status', 'closed', 'session', json_build_object('name', s.name)); end if;
  if s.reg_expires_at is not null and s.reg_expires_at <= now() then
    return json_build_object('status', 'expired', 'session', json_build_object('name', s.name));
  end if;
  return json_build_object(
    'status', 'open',
    'session', json_build_object(
      'name', s.name, 'venue', s.venue, 'date', s.session_date,
      'province', (select name_en from provinces where id = s.province_id),
      'expires_at', s.reg_expires_at,
      'default_exam_center_id', s.default_exam_center_id),
    'centers', coalesce((
      select json_agg(json_build_object('id', ec.id, 'name', ec.name,
               'province', (select name_en from provinces p where p.id = ec.province_id)) order by ec.name)
        from exam_centers ec where ec.cycle_id = s.cycle_id), '[]'::json),
    'provinces', coalesce((
      select json_agg(json_build_object('id', p.id, 'name_en', p.name_en, 'name_kh', p.name_kh) order by p.name_en)
        from provinces p), '[]'::json)
  );
end $$;

-- ---------------------------------------------------------------------------
-- Public form submit. Returns {ok:true} or {ok:false, reason}. The same person
-- (name + date of birth) registering twice for a session is stored once.
-- ---------------------------------------------------------------------------
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
    return json_build_object('ok', true, 'duplicate', true);
  end if;

  insert into is_registrations (session_id, cycle_id, first_name, last_name, gender, dob, phone, high_school, grade, province_id, exam_center_id)
  values (s.id, s.cycle_id, v_first, v_last, v_gender, v_dob,
          nullif(left(trim(coalesce(p->>'phone', '')), 30), ''),
          nullif(left(trim(coalesce(p->>'high_school', '')), 200), ''),
          nullif(left(trim(coalesce(p->>'grade', '')), 20), ''),
          v_province, v_center);
  return json_build_object('ok', true);
end $$;

grant execute on function public_registration_form(text) to authenticated;
grant execute on function public_register(text, jsonb) to authenticated;
