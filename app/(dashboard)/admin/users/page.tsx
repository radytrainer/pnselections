"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Trash2, UserPlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserForm } from "@/components/forms/UserForm";
import type { CreateUserValues, UpdateUserValues } from "@/features/admin/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { ColumnDef } from "@tanstack/react-table";
import { ResponsiveDataTable, type ResponsiveColumnMeta } from "@/components/tables/ResponsiveDataTable";
import { SearchInput, matchesSearch } from "@/components/forms/SearchInput";

type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  status: string;
  created_at: string;
  role: string | null;
  ngoId: string | null;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState("");

  const visibleUsers = useMemo(
    () =>
      users.filter((u) =>
        matchesSearch(search, [u.full_name, u.email, u.role?.replace(/_/g, " "), u.status]),
      ),
    [users, search],
  );

  const load = useCallback(() => {
    setLoading(true);
    return fetch("/api/admin/users")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Failed to load users");
        setUsers(body.users);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load users"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(values: CreateUserValues) {
    const res = await fetch("/api/admin/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Failed to create user");

    toast.success(`${values.fullName} created`);
    setCreateOpen(false);
    load();
  }

  async function handleDelete() {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${deletingUser.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to delete user");
      toast.success(`${deletingUser.full_name} deleted`);
      setDeletingUser(null);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete user");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleUpdate(values: UpdateUserValues) {
    if (!editingUser) return;
    const res = await fetch(`/api/admin/users/${editingUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Failed to update user");

    toast.success(`${values.fullName} updated`);
    setEditingUser(null);
    load();
  }

  const columns = useMemo<ColumnDef<AdminUser>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        meta: {
          card: "title",
          cardCell: (u) => (
            <div className="min-w-0">
              <p className="truncate font-medium">{u.full_name}</p>
              <p className="truncate text-xs text-muted-foreground">{u.email}</p>
            </div>
          ),
        } satisfies ResponsiveColumnMeta<AdminUser>,
        cell: ({ row }) => <span className="font-medium">{row.original.full_name}</span>,
      },
      {
        id: "email",
        header: "Email",
        meta: { card: "hidden" } satisfies ResponsiveColumnMeta<AdminUser>,
        cell: ({ row }) => row.original.email,
      },
      {
        id: "role",
        header: "Role",
        meta: { card: "summary" } satisfies ResponsiveColumnMeta<AdminUser>,
        cell: ({ row }) =>
          row.original.role ? <Badge variant="outline" className="capitalize">{row.original.role.replace(/_/g, " ")}</Badge> : "—",
      },
      {
        id: "status",
        header: "Status",
        meta: { card: "summary" } satisfies ResponsiveColumnMeta<AdminUser>,
        cell: ({ row }) => <span className="capitalize">{row.original.status}</span>,
      },
      {
        id: "actions",
        header: "",
        meta: { card: "actions", className: "w-px" } satisfies ResponsiveColumnMeta<AdminUser>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${row.original.full_name}`}
              className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditingUser(row.original)}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeletingUser(row.original)}>
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">Manage user accounts and roles.</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <UserPlus className="size-4" />
          Create User
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, email or role..."
          aria-label="Search users"
        />
        {!loading && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {search ? `${visibleUsers.length} of ${users.length} users` : `${users.length} users`}
          </p>
        )}
      </div>

      <ResponsiveDataTable
        data={visibleUsers}
        columns={columns}
        getRowId={(u) => u.id}
        loading={loading}
        empty={users.length === 0 ? "No users yet." : `No users match "${search}".`}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
          </DialogHeader>
          <UserForm onSubmit={handleCreate} />
        </DialogContent>
      </Dialog>

      <Dialog open={deletingUser !== null} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-medium">{deletingUser?.full_name}</span> ({deletingUser?.email})? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingUser(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingUser !== null} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <UserForm
              mode="edit"
              defaultValues={{
                email: editingUser.email,
                fullName: editingUser.full_name,
                role: (editingUser.role as UpdateUserValues["role"]) ?? "selection_team",
                ngoId: editingUser.ngoId ?? "",
                password: "",
              }}
              onSubmit={handleUpdate}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
