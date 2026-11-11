"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RotateCcw, Trash2 } from "lucide-react";
import {
  listDeletedStudents,
  restoreStudent,
  permanentlyDeleteStudent,
  type StudentListItem,
} from "@/services/studentService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { emptyTrash } from "@/services/adminToolsService";
import { useRole } from "@/hooks/useRole";
import { can } from "@/lib/rbac";

export default function StudentsTrashPage() {
  const { role } = useRole();
  const [data, setData] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [emptyOpen, setEmptyOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [emptying, setEmptying] = useState(false);

  const canView = can(role, "viewTrash");
  const canDeleteForever = can(role, "permanentlyDeleteStudents");

  const fetchDeleted = useCallback(async () => {
    setLoading(true);
    try {
      setData(await listDeletedStudents());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load trash");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) fetchDeleted();
    else setLoading(false);
  }, [canView, fetchDeleted]);

  async function handleRestore(student: StudentListItem) {
    setBusyId(student.id);
    try {
      await restoreStudent(student.id);
      toast.success(`${student.first_name} ${student.last_name} restored`);
      setData((prev) => prev.filter((s) => s.id !== student.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore student");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteForever(student: StudentListItem) {
    if (
      !window.confirm(
        `Permanently delete ${student.first_name} ${student.last_name} (${student.student_code})? This cannot be undone — all exam, interview, and home visit records for this student will be erased too.`,
      )
    ) {
      return;
    }
    setBusyId(student.id);
    try {
      await permanentlyDeleteStudent(student.id);
      toast.success(`${student.first_name} ${student.last_name} permanently deleted`);
      setData((prev) => prev.filter((s) => s.id !== student.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to permanently delete student");
    } finally {
      setBusyId(null);
    }
  }

  async function handleEmptyTrash() {
    setEmptying(true);
    try {
      const { deleted } = await emptyTrash();
      toast.success(`${deleted} student${deleted === 1 ? "" : "s"} permanently deleted`);
      setEmptyOpen(false);
      await fetchDeleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to empty the trash");
    } finally {
      setEmptying(false);
    }
  }

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You don&apos;t have permission to view this page.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Trash</h1>
          <p className="text-sm text-muted-foreground">
            Deleted students. Restore them, or{" "}
            {canDeleteForever ? "erase them permanently" : "ask a super admin to erase them permanently"}.
          </p>
        </div>
        {canDeleteForever && data.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setConfirmText("");
              setEmptyOpen(true);
            }}
          >
            <Trash2 className="size-4" />
            Delete all ({data.length})
          </Button>
        )}
      </div>

      <Dialog open={emptyOpen} onOpenChange={(open) => !emptying && setEmptyOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete all {data.length} students permanently?</DialogTitle>
            <DialogDescription>
              Every student in the trash will be erased, together with their exam, interview, home visit, committee
              and document records. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-empty" className="text-sm">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm
            </Label>
            <Input
              id="confirm-empty"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmptyOpen(false)} disabled={emptying}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleEmptyTrash}
              disabled={confirmText !== "DELETE" || emptying}
              className="gap-1.5"
            >
              <Trash2 className="size-4" />
              {emptying ? "Deleting..." : `Delete ${data.length} forever`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Deleted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Trash is empty.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      {student.first_name} {student.last_name}
                    </TableCell>
                    <TableCell>{student.student_code}</TableCell>
                    <TableCell>
                      {student.deleted_at ? new Date(student.deleted_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === student.id}
                          onClick={() => handleRestore(student)}
                        >
                          <RotateCcw className="size-4" />
                          Restore
                        </Button>
                        {canDeleteForever && (
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={busyId === student.id}
                            onClick={() => handleDeleteForever(student)}
                          >
                            <Trash2 className="size-4" />
                            Delete Forever
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
