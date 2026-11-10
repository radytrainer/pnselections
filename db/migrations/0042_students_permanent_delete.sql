-- Students previously had no DELETE policy at all, so hard deletion was
-- impossible for every role (RLS defaults to deny when no policy matches).
-- The app already only ever soft-deletes (students.deleted_at) via the UI —
-- this adds the one narrow, deliberate path to permanently erase a record
-- (from the Trash view), restricted to super_admin. Everyone else's
-- "Delete" still only moves a student to Trash.
create policy students_delete on students for delete using (
  auth_role() = 'super_admin'
);
