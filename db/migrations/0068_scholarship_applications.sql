-- Scholarship application form (ពាក្យស្នើរសុំអាហារូបករណ៍), filled online by the
-- student after passing the Motivation Interview.
--
-- Staff create one link (and QR code) per student: /apply/<token>. The student
-- opens it without logging in, fills the paper form's questions, uploads a
-- profile photo (4x6) and up to 5 attachments (map to home, family book,
-- equity card...). Staff can close the link, set an expiry, or issue a new link
-- (the old one stops working). While the link is open the student can come
-- back and change their answers.
--
-- Answers are stored as JSON (data). The photo and attachments are ordinary
-- student_documents rows (photo = doc_type 'photo', so it becomes the profile
-- photo; attachments = doc_type 'other'), tagged with application_id.
--
-- Like the information-session form (0061), the public page never touches
-- tables directly: it runs under an anonymous claim and only the
-- security-definer public_application_* functions below can read or write,
-- after checking the link is open.

create table scholarship_applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references students(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  link_open boolean not null default true,
  expires_at timestamptz,
  data jsonb not null default '{}'::jsonb,
  -- Last time the student pressed Submit (null = not submitted yet).
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_scholarship_applications_updated before update on scholarship_applications
  for each row execute function set_updated_at();

alter table student_documents add column if not exists application_id uuid references scholarship_applications(id) on delete set null;
alter table student_documents add column if not exists original_name text;
create index if not exists idx_student_docs_application on student_documents(application_id) where application_id is not null;

-- Read: staff who can see student details. Write (create link, open/close,
-- expiry): the selection and interview teams.
alter table scholarship_applications enable row level security;
create policy scholarship_applications_select on scholarship_applications for select using (
  auth_role() in ('super_admin','program_manager','selection_team','interview_team','home_visit_team','committee_member'));
create policy scholarship_applications_insert on scholarship_applications for insert with check (
  auth_role() in ('super_admin','program_manager','selection_team','interview_team'));
create policy scholarship_applications_update on scholarship_applications for update using (
  auth_role() in ('super_admin','program_manager','selection_team','interview_team'));
create policy scholarship_applications_delete on scholarship_applications for delete using (
  auth_role() in ('super_admin','program_manager','selection_team'));
grant select, insert, update, delete on scholarship_applications to authenticated;
create trigger trg_audit_scholarship_applications after insert or update or delete on scholarship_applications
  for each row execute function write_audit_log();

-- ---------------------------------------------------------------------------
-- Link state shared by the public functions: null when the link is usable,
-- else the reason (not_found | closed | expired).
-- ---------------------------------------------------------------------------
create or replace function application_link_reason(p_token text)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  app scholarship_applications;
begin
  select * into app from scholarship_applications where token = p_token;
  if not found then return 'not_found'; end if;
  if not app.link_open then return 'closed'; end if;
  if app.expires_at is not null and app.expires_at <= now() then return 'expired'; end if;
  if not exists (select 1 from students s where s.id = app.student_id and s.deleted_at is null) then return 'not_found'; end if;
  return null;
end $$;

-- What the public page shows: the student's known details (to pre-fill),
-- saved answers and uploaded files (ids and names only, never storage paths).
create or replace function public_application_form(p_token text)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  a scholarship_applications;
  r text;
  st record;
begin
  r := application_link_reason(p_token);
  if r is not null then return json_build_object('status', r); end if;
  select * into a from scholarship_applications where token = p_token;
  select s.first_name, s.last_name, s.gender, s.dob, s.phone, s.student_code, c.year, c.name as cycle_name
    into st from students s join selection_cycles c on c.id = s.cycle_id where s.id = a.student_id;
  return json_build_object(
    'status', 'open',
    'student', json_build_object('first_name', st.first_name, 'last_name', st.last_name, 'gender', st.gender,
                                 'dob', st.dob, 'phone', st.phone, 'student_code', st.student_code),
    'academic_year', st.year::text || ' - ' || (st.year + 1)::text,
    'expires_at', a.expires_at,
    'submitted_at', a.submitted_at,
    'data', a.data,
    'files', coalesce((
      select json_agg(json_build_object('id', d.id, 'kind', case when d.doc_type = 'photo' then 'photo' else 'file' end,
                                        'name', d.original_name, 'uploaded_at', d.uploaded_at) order by d.uploaded_at)
        from student_documents d where d.application_id = a.id), '[]'::json)
  );
end $$;

-- Saves the answers (the API has already whitelisted their shape) and marks
-- the application submitted.
create or replace function public_application_submit(p_token text, p jsonb)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  a scholarship_applications;
  r text;
begin
  r := application_link_reason(p_token);
  if r is not null then return json_build_object('ok', false, 'reason', r); end if;
  select * into a from scholarship_applications where token = p_token;
  if jsonb_typeof(p) <> 'object' or length(p::text) > 60000 then
    return json_build_object('ok', false, 'reason', 'bad_data');
  end if;
  update scholarship_applications set data = p, submitted_at = now() where id = a.id;
  return json_build_object('ok', true);
end $$;

-- Records an uploaded file. kind 'photo' replaces the application's previous
-- photo; kind 'file' is limited to 5 per application. Returns the storage path
-- (<student>/<random>.<ext>, relative to student-documents/) for the API to
-- write the file to in the same transaction, so a failed upload leaves no row.
create or replace function public_application_add_file(p_token text, p_kind text, p_ext text, p_name text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  a scholarship_applications;
  r text;
  v_id uuid;
  v_path text;
begin
  r := application_link_reason(p_token);
  if r is not null then return json_build_object('ok', false, 'reason', r); end if;
  select * into a from scholarship_applications where token = p_token;
  if p_kind not in ('photo', 'file') or p_ext not in ('png', 'jpg', 'webp', 'pdf') or (p_kind = 'photo' and p_ext = 'pdf') then
    return json_build_object('ok', false, 'reason', 'bad_file');
  end if;
  v_path := a.student_id::text || '/' || gen_random_uuid()::text || '.' || p_ext;
  -- Serialize uploads for this application so two at once can't pass the limit.
  perform 1 from scholarship_applications where id = a.id for update;
  if p_kind = 'photo' then
    delete from student_documents where application_id = a.id and doc_type = 'photo';
  elsif (select count(*) from student_documents where application_id = a.id and doc_type <> 'photo') >= 5 then
    return json_build_object('ok', false, 'reason', 'too_many_files');
  end if;
  insert into student_documents (student_id, doc_type, file_path, application_id, original_name)
  values (a.student_id, case when p_kind = 'photo' then 'photo' else 'other' end, v_path, a.id,
          nullif(left(trim(coalesce(p_name, '')), 200), ''))
  returning id into v_id;
  return json_build_object('ok', true, 'id', v_id, 'path', v_path);
end $$;

create or replace function public_application_remove_file(p_token text, p_doc uuid)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  a scholarship_applications;
  r text;
begin
  r := application_link_reason(p_token);
  if r is not null then return json_build_object('ok', false, 'reason', r); end if;
  select * into a from scholarship_applications where token = p_token;
  delete from student_documents where id = p_doc and application_id = a.id;
  return json_build_object('ok', true);
end $$;

-- Storage path of one of this application's files (for showing it back to the student).
create or replace function public_application_file_path(p_token text, p_doc uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  a scholarship_applications;
  r text;
begin
  r := application_link_reason(p_token);
  if r is not null then return null; end if;
  select * into a from scholarship_applications where token = p_token;
  return (select file_path from student_documents where id = p_doc and application_id = a.id);
end $$;

revoke all on function application_link_reason(text) from public;
grant execute on function public_application_form(text) to authenticated;
grant execute on function public_application_submit(text, jsonb) to authenticated;
grant execute on function public_application_add_file(text, text, text, text) to authenticated;
grant execute on function public_application_remove_file(text, uuid) to authenticated;
grant execute on function public_application_file_path(text, uuid) to authenticated;
