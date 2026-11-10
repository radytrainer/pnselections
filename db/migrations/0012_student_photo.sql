-- ============================================================================
-- Finishes student_documents (created in 0001 but left without RLS or a
-- storage bucket — the Documents tab placeholder noted this as deferred).
-- First real use: student profile photos (doc_type = 'photo'), reusing the
-- same table/bucket for id_card/transcript/certificate/other later.
--
-- The bucket is PRIVATE, unlike partner-logos/avatars (0007/0008) — these
-- are children's faces and ID documents tied to vulnerability data, which
-- docs/09-security.md already classifies as PII with a restricted viewer
-- list. A public bucket would make a photo permanently fetchable by anyone
-- who ever saw its URL, with no way to revoke access. The app must request
-- a short-lived signed URL to display one (see lib/supabase/storage.ts)
-- rather than rendering file_path directly.
-- ============================================================================

alter table student_documents enable row level security;
alter table student_documents alter column uploaded_by set default auth_user_id();

-- Mirrors students_select exactly: staff roles see every student's
-- documents; an ngo_partner sees only documents of students they referred.
create policy student_documents_select on student_documents for select using (
  auth_role() in ('super_admin','program_manager','selection_team','interview_team',
                   'home_visit_team','committee_member','donor')
  or (
    auth_role() = 'ngo_partner'
    and exists (
      select 1 from students s
      where s.id = student_documents.student_id and s.referred_by_ngo_id = auth_ngo_id()
    )
  )
);
-- Mirrors students_write/students_update — only roles that can edit a
-- student's record may add/replace/remove their documents.
create policy student_documents_write on student_documents for insert with check (
  auth_role() in ('super_admin','program_manager','selection_team')
);
create policy student_documents_update on student_documents for update using (
  auth_role() in ('super_admin','program_manager','selection_team')
);
create policy student_documents_delete on student_documents for delete using (
  auth_role() in ('super_admin','program_manager','selection_team')
);

-- [self-hosted] The Supabase Storage bucket + storage.objects policies that
-- used to live here (PRIVATE `student-documents` bucket; read mirrors student_documents_select,
-- write limited to super_admin/program_manager/selection_team) are now enforced by the Node.js API's upload/
-- download routes (api/src/routes/files.ts), which store objects on a local
-- volume or S3 instead of Supabase Storage.
