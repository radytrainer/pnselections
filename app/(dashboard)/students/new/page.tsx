"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StudentForm } from "@/components/forms/StudentForm";
import { createStudent, generateStudentCode } from "@/services/studentService";
import { getActiveCycle } from "@/services/lookupService";
import { uploadStudentPhoto } from "@/lib/storage";
import type { StudentFormValues } from "@/features/students/schema";

export default function NewStudentPage() {
  const router = useRouter();

  async function handleSubmit(values: StudentFormValues, photoFile: File | null) {
    const cycle = await getActiveCycle();
    if (!cycle) {
      toast.error("No active selection cycle found. Ask a Program Manager to create one.");
      return;
    }

    const studentCode = await generateStudentCode(cycle.year);

    const student = await createStudent({
      student_code: studentCode,
      cycle_id: cycle.id,
      first_name: values.first_name,
      last_name: values.last_name,
      gender: values.gender,
      dob: values.dob || null,
      phone: values.phone || null,
      photo_drive_url: values.photo_drive_url || null,
      province_id: values.province_id || null,
      district_name: values.district_name || null,
      commune_name: values.commune_name || null,
      village_name: values.village_name || null,
      school_id: values.school_id || null,
      referred_by_ngo_id: values.referred_by_ngo_id || null,
      information_session: values.information_session || null,
      exam_center: values.exam_center || null,
      eligible_for_social_investigation: values.eligible_for_social_investigation,
      father_name: values.father_name || null,
      mother_name: values.mother_name || null,
      parent_occupation: values.parent_occupation || null,
      family_income_monthly: values.family_income_monthly
        ? Number(values.family_income_monthly)
        : null,
      siblings_count: values.siblings_count ? Number(values.siblings_count) : null,
    });

    if (photoFile) {
      try {
        await uploadStudentPhoto(photoFile, student.id);
      } catch {
        toast.error("Student created, but the photo upload failed. Add it from the student's profile.");
      }
    }

    toast.success(`Student ${student.student_code} created`);
    router.push(`/students/${student.id}`);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New Student</h1>
        <p className="text-sm text-muted-foreground">
          Register a new applicant in the active selection cycle.
        </p>
      </div>
      <StudentForm onSubmit={handleSubmit} submitLabel="Create Student" />
    </div>
  );
}
