"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ApplicationLinkPanel, useStudentApplication } from "@/components/applications/ApplicationLinkPanel";

/** Students list → the application link/QR for one student who passed the interview. */
export function ApplicationLinkDialog({
  student,
  open,
  onOpenChange,
  canManage,
}: {
  student: { id: string; first_name: string; last_name: string; student_code: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
}) {
  const name = `${student.first_name} ${student.last_name}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Scholarship application · {name}</DialogTitle>
          <DialogDescription>
            A personal link and QR code for {student.first_name} to fill the application form, upload a photo and attach documents.
          </DialogDescription>
        </DialogHeader>
        {open && <Body student={student} name={name} canManage={canManage} />}
      </DialogContent>
    </Dialog>
  );
}

function Body({ student, name, canManage }: { student: { id: string; student_code: string }; name: string; canManage: boolean }) {
  const { application, reload } = useStudentApplication(student.id);
  return (
    <div className="space-y-4">
      <ApplicationLinkPanel studentId={student.id} studentName={name} studentCode={student.student_code} application={application} reload={reload} canManage={canManage} />
      {application && (
        <div className="flex justify-end border-t pt-3">
          <Link href={`/students/${student.id}?tab=application`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            View answers &amp; files <ArrowRight />
          </Link>
        </div>
      )}
    </div>
  );
}
