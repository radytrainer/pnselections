-- school_partners was missing an UPDATE policy entirely (only select/insert
-- existed), so soft-deleting or editing a school silently failed under RLS
-- for every role, including super_admin/program_manager. Mirrors ngo_update
-- minus the self-service clause (no "school_partner" role exists).
create policy school_update on school_partners for update using (
  auth_role() in ('super_admin','program_manager')
);
