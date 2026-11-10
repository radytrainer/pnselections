-- ============================================================================
-- Lets every signed-in user manage their own profile (name, phone, avatar)
-- from the new /account page. Previously `users` only had a super_admin
-- write policy, and the only image bucket (`partner-logos`) is role-
-- restricted to staff/NGO partners — neither covers an arbitrary user
-- uploading their own profile photo.
-- ============================================================================

-- [self-hosted] The Supabase Storage bucket + storage.objects policies that
-- used to live here (public `avatars` bucket; each user writes only under their own firebase_uid folder) are now enforced by the Node.js API's upload/
-- download routes (api/src/routes/files.ts), which store objects on a local
-- volume or S3 instead of Supabase Storage.

-- Self-service profile updates: any signed-in user may update their own
-- `users` row, but a trigger blocks changes to fields that aren't theirs to
-- change (firebase_uid, email, status, deleted_at) — RBAC management of
-- those stays on the existing super_admin-only `users_admin_write` policy.
create or replace function guard_users_self_update() returns trigger
language plpgsql as $$
begin
  if auth_role() <> 'super_admin' then
    if new.firebase_uid <> old.firebase_uid
       or new.email <> old.email
       or new.status <> old.status
       or new.deleted_at is distinct from old.deleted_at then
      raise exception 'Not permitted to change this field';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_users_self_update_guard before update on users
  for each row execute function guard_users_self_update();

create policy users_update_self on users for update using (
  firebase_uid = (auth.jwt() ->> 'sub')
) with check (
  firebase_uid = (auth.jwt() ->> 'sub')
);
