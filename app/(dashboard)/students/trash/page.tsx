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
import { useRole } from "@/hooks/useRole";
import { can } from "@/lib/rbac";

export default function StudentsTrashPage() {
  const { role } = useRole();
  const [data, setData] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You don&apos;t have permission to view this page.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Trash</h1>
        <p className="text-sm text-muted-foreground">
          Deleted students. Restore them, or{" "}
          {canDeleteForever ? "erase them permanently" : "ask a super admin to erase them permanently"}.
        </p>
      </div>

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
