-- The admin "Edit User" route (app/api/admin/users/[id]/route.ts) updates
-- email/status/etc via the service-role client, which bypasses RLS but not
-- triggers. guard_users_self_update() (0008) only special-cased
-- auth_role() = 'super_admin', i.e. a request carrying the app's own
-- `app_role` JWT claim — but the service-role key has no such claim, so
-- auth_role() fell through to 'anonymous' and every admin email/status edit
-- hit "Not permitted to change this field". Postgres's built-in auth.role()
-- (distinct from our auth_role() helper) reads the JWT's standard `role`
-- claim, which IS 'service_role' for that key, so use it to recognize the
-- already-application-gated (requireSuperAdmin) admin route.
create or replace function guard_users_self_update() returns trigger
language plpgsql as $$
begin
  if auth.role() <> 'service_role' and auth_role() <> 'super_admin' then
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
