"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { getStudent, updateStudent, type StudentDetail } from "@/services/studentService";
import { getLatestSocialAssessment, saveSocialAssessment, type SocialAssessment } from "@/services/socialFormService";
import { SocialForm } from "@/components/forms/SocialForm";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { can } from "@/lib/rbac";
import { displayStudentStatus } from "@/lib/constants";
import type { SocialFormValues } from "@/features/social-form/schema";

function toFormValues(row: SocialAssessment, studentGender?: string): Partial<SocialFormValues> {
  return {
    gender: (studentGender as SocialFormValues["gender"]) ?? undefined,
    age: row.age != null ? String(row.age) : "",
    health_status: row.health_status ?? undefined,
    ok_to_join_training: row.ok_to_join_training ?? "",
    academic_rank: row.academic_rank ?? undefined,
    academic_note: row.academic_note ?? "",
    major: row.major ?? undefined,
    household_size_band: row.household_size_band ?? undefined,
    household_size_note: row.household_size_note ?? "",
    dependents_band: row.dependents_band ?? undefined,
    dependents_note: row.dependents_note ?? "",
    father_age: row.father_age != null ? String(row.father_age) : "",
    father_job: row.father_job ?? "",
    father_income: row.father_income ?? "",
    mother_age: row.mother_age != null ? String(row.mother_age) : "",
    mother_job: row.mother_job ?? "",
    mother_income: row.mother_income ?? "",
    child1_income: row.child1_income ?? "",
    child2_income: row.child2_income ?? "",
    child3_income: row.child3_income ?? "",
    parent_occupation_band: row.parent_occupation_band ?? undefined,
    father_occupation_band: row.father_occupation_band ?? undefined,
    mother_occupation_band: row.mother_occupation_band ?? undefined,
    house_owner: row.house_owner ?? "",
    housing_type_band: row.housing_type_band ?? undefined,
    house_status_band: row.house_status_band ?? undefined,
    water_access_band: row.water_access_band ?? undefined,
    electricity_access_band: row.electricity_access_band ?? undefined,
    assets_furniture: row.assets_furniture ?? 0,
    assets_furniture_note: row.assets_furniture_note ?? "",
    assets_transport: row.assets_transport ?? 0,
    assets_transport_note: row.assets_transport_note ?? "",
    assets_electronics: row.assets_electronics ?? 0,
    assets_electronics_note: row.assets_electronics_note ?? "",
    assets_livestock: row.assets_livestock ?? 0,
    assets_livestock_note: row.assets_livestock_note ?? "",
    income_band: row.income_band ?? undefined,
    income_note: row.income_note ?? "",
    expenses_band: row.expenses_band ?? undefined,
    expenses_note: row.expenses_note ?? "",
    education_support_band: row.education_support_band ?? undefined,
    education_support_note: row.education_support_note ?? "",
    father_education_band: row.father_education_band ?? undefined,
    mother_education_band: row.mother_education_band ?? undefined,
    school_aged_children_studying:
      row.school_aged_children_studying != null ? String(row.school_aged_children_studying) : "",
    school_aged_children_working:
      row.school_aged_children_working != null ? String(row.school_aged_children_working) : "",
    school_attendance_band: row.school_attendance_band ?? undefined,
    debt_band: row.debt_band ?? undefined,
    debt_amount: row.debt_amount ?? "",
    debt_note: row.debt_note ?? "",
    farm_land_band: row.farm_land_band ?? undefined,
    farm_land_note: row.farm_land_note ?? "",
    farm_income_band: row.farm_income_band ?? undefined,
    plantation_land_band: row.plantation_land_band ?? undefined,
    plantation_income_band: row.plantation_income_band ?? undefined,
    vulnerability_orphan_single_parent: row.vulnerability_orphan_single_parent,
    vulnerability_disability: row.vulnerability_disability,
    vulnerability_chronic_illness: row.vulnerability_chronic_illness,
    vulnerability_debt_burden: row.vulnerability_debt_burden,
    vulnerability_landless: row.vulnerability_landless,
    vulnerability_note: row.vulnerability_note ?? "",
    husbandry_band: row.husbandry_band ?? undefined,
    husbandry_note: row.husbandry_note ?? "",
    manual_failed: row.manual_failed,
    poverty_certificate: row.poverty_certificate ?? "",
    distance_from_town: row.distance_from_town ?? "",
    visitor_name: row.visitor_name ?? "",
    visitor_comments: row.visitor_comments ?? "",
    vac_income_employment: (row.vac_income_employment ?? undefined) as SocialFormValues["vac_income_employment"],
    vac_food_security: (row.vac_food_security ?? undefined) as SocialFormValues["vac_food_security"],
    vac_housing_conditions: (row.vac_housing_conditions ?? undefined) as SocialFormValues["vac_housing_conditions"],
    vac_health_services: (row.vac_health_services ?? undefined) as SocialFormValues["vac_health_services"],
    vac_education: (row.vac_education ?? undefined) as SocialFormValues["vac_education"],
    vac_debt_finance: (row.vac_debt_finance ?? undefined) as SocialFormValues["vac_debt_finance"],
    vac_assets_livelihoods: (row.vac_assets_livelihoods ?? undefined) as SocialFormValues["vac_assets_livelihoods"],
    vac_social_protection: (row.vac_social_protection ?? undefined) as SocialFormValues["vac_social_protection"],
    vac_family_structure: (row.vac_family_structure ?? undefined) as SocialFormValues["vac_family_structure"],
    vac_shocks_risks: (row.vac_shocks_risks ?? undefined) as SocialFormValues["vac_shocks_risks"],
    vac_water_sanitation: (row.vac_water_sanitation ?? undefined) as SocialFormValues["vac_water_sanitation"],
    vac_psychological_vulnerability: (row.vac_psychological_vulnerability ?? undefined) as SocialFormValues["vac_psychological_vulnerability"],
  };
}

export default function SocialFormEntryPage() {
  const params = useParams<{ studentId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { role } = useRole();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [existing, setExisting] = useState<SocialAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEliminateBox, setShowEliminateBox] = useState(false);
  const [eliminationReason, setEliminationReason] = useState("");
  const [eliminating, setEliminating] = useState(false);

  useEffect(() => {
    Promise.all([getStudent(params.studentId), getLatestSocialAssessment(params.studentId)])
      .then(([studentData, assessment]) => {
        setStudent(studentData);
        setExisting(assessment);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load student"))
      .finally(() => setLoading(false));
  }, [params.studentId]);

  async function handleSubmit(values: SocialFormValues) {
    if (!student) return;
    try {
      await saveSocialAssessment({
        id: existing?.id,
        studentId: student.id,
        cycleId: student.cycle_id,
        visitNumber: existing?.visit_number ?? 1,
        currentStatus: student.status,
        gender: values.gender ?? null,
        age: values.age ? Number(values.age) : null,
        health_status: values.health_status ?? null,
        ok_to_join_training: values.ok_to_join_training || null,
        academic_rank: values.academic_rank ?? null,
        academic_note: values.academic_note || null,
        major: values.major ?? null,
        household_size_band: values.household_size_band ?? null,
        household_size_note: values.household_size_note || null,
        dependents_band: values.dependents_band ?? null,
        dependents_note: values.dependents_note || null,
        father_age: values.father_age ? Number(values.father_age) : null,
        father_job: values.father_job || null,
        father_income: values.father_income || null,
        mother_age: values.mother_age ? Number(values.mother_age) : null,
        mother_job: values.mother_job || null,
        mother_income: values.mother_income || null,
        child1_income: values.child1_income || null,
        child2_income: values.child2_income || null,
        child3_income: values.child3_income || null,
        parent_occupation_band: values.parent_occupation_band ?? null,
        father_occupation_band: values.father_occupation_band ?? null,
        mother_occupation_band: values.mother_occupation_band ?? null,
        house_owner: values.house_owner || null,
        housing_type_band: values.housing_type_band ?? null,
        house_status_band: values.house_status_band ?? null,
        water_access_band: values.water_access_band ?? null,
        electricity_access_band: values.electricity_access_band ?? null,
        assets_furniture: values.assets_furniture,
        assets_furniture_note: values.assets_furniture_note || null,
        assets_transport: values.assets_transport,
        assets_transport_note: values.assets_transport_note || null,
        assets_electronics: values.assets_electronics,
        assets_electronics_note: values.assets_electronics_note || null,
        assets_livestock: values.assets_livestock,
        assets_livestock_note: values.assets_livestock_note || null,
        income_band: values.income_band ?? null,
        income_note: values.income_note || null,
        expenses_band: values.expenses_band ?? null,
        expenses_note: values.expenses_note || null,
        education_support_band: values.education_support_band ?? null,
        education_support_note: values.education_support_note || null,
        father_education_band: values.father_education_band ?? null,
        mother_education_band: values.mother_education_band ?? null,
        school_aged_children_studying: values.school_aged_children_studying
          ? Number(values.school_aged_children_studying)
          : null,
        school_aged_children_working: values.school_aged_children_working
          ? Number(values.school_aged_children_working)
          : null,
        school_attendance_band: values.school_attendance_band ?? null,
        debt_band: values.debt_band ?? null,
        debt_amount: values.debt_amount || null,
        debt_note: values.debt_note || null,
        farm_land_band: values.farm_land_band ?? null,
        farm_land_note: values.farm_land_note || null,
        farm_income_band: values.farm_income_band ?? null,
        plantation_land_band: values.plantation_land_band ?? null,
        plantation_income_band: values.plantation_income_band ?? null,
        vulnerability_orphan_single_parent: values.vulnerability_orphan_single_parent,
        vulnerability_disability: values.vulnerability_disability,
        vulnerability_chronic_illness: values.vulnerability_chronic_illness,
        vulnerability_debt_burden: values.vulnerability_debt_burden,
        vulnerability_landless: values.vulnerability_landless,
        vulnerability_note: values.vulnerability_note || null,
        husbandry_band: values.husbandry_band ?? null,
        husbandry_note: values.husbandry_note || null,
        manual_failed: values.manual_failed,
        poverty_certificate: values.poverty_certificate || null,
        distance_from_town: values.distance_from_town || null,
        visitor_name: values.visitor_name || null,
        visitor_comments: values.visitor_comments || null,
        vac_income_employment: values.vac_income_employment ?? null,
        vac_food_security: values.vac_food_security ?? null,
        vac_housing_conditions: values.vac_housing_conditions ?? null,
        vac_health_services: values.vac_health_services ?? null,
        vac_education: values.vac_education ?? null,
        vac_debt_finance: values.vac_debt_finance ?? null,
        vac_assets_livelihoods: values.vac_assets_livelihoods ?? null,
        vac_social_protection: values.vac_social_protection ?? null,
        vac_family_structure: values.vac_family_structure ?? null,
        vac_shocks_risks: values.vac_shocks_risks ?? null,
        vac_water_sanitation: values.vac_water_sanitation ?? null,
        vac_psychological_vulnerability: values.vac_psychological_vulnerability ?? null,
      });
      toast.success("Social form saved");
      router.push(`/students/${student.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save social form");
    }
  }

  async function handleEliminate() {
    if (!student || !eliminationReason.trim()) return;
    setEliminating(true);
    try {
      const updated = await updateStudent(student.id, {
        status: "eliminated",
        elimination_reason: eliminationReason.trim(),
      });
      setStudent({ ...student, ...updated });
      setShowEliminateBox(false);
      setEliminationReason("");
      toast.success("Student eliminated for not matching social criteria");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to eliminate student");
    } finally {
      setEliminating(false);
    }
  }

  async function handleUndoElimination() {
    if (!student) return;
    setEliminating(true);
    try {
      const updated = await updateStudent(student.id, {
        // Only regress status if elimination itself is what set it to
        // "eliminated" — if the case was already sent to committee (status
        // stayed "committee_review", see sendToCommittee), leave status
        // alone so undoing doesn't pull it back out of the committee queue.
        status: student.status === "eliminated" ? "home_visit_completed" : student.status,
        elimination_reason: null,
      });
      setStudent({ ...student, ...updated });
      toast.success("Elimination undone");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to undo elimination");
    } finally {
      setEliminating(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-xl space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!student) {
    return <p className="text-sm text-muted-foreground">Student not found.</p>;
  }

  const canEliminate = can(role, "enterHomeVisitData");
  // elimination_reason survives being sent to committee (sendToCommittee
  // leaves status as "committee_review" so the elimination still shows
  // there) — check that instead of the raw status so this page keeps
  // showing the elimination banner even after the case moves to committee.
  const isEliminated = displayStudentStatus(student.status, student.elimination_reason) === "eliminated";

  return (
    <div className="max-w-xl space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2.5 gap-1.5" onClick={() => router.back()}>
        <ArrowLeft className="size-4" />
        Back
      </Button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            Social Form — {student.first_name} {student.last_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {student.student_code} · Home Visit #{existing?.visit_number ?? 1}
          </p>
        </div>
        {canEliminate &&
          (isEliminated ? (
            <Button variant="outline" size="sm" disabled={eliminating} onClick={handleUndoElimination}>
              Undo Elimination
            </Button>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              disabled={eliminating}
              onClick={() => setShowEliminateBox((v) => !v)}
            >
              Eliminate
            </Button>
          ))}
      </div>

      {isEliminated && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-medium text-destructive">Eliminated — doesn&apos;t match social criteria</p>
          {student.elimination_reason && (
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{student.elimination_reason}</p>
          )}
        </div>
      )}

      {showEliminateBox && !isEliminated && (
        <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <label className="text-sm font-medium text-destructive">Reason for elimination</label>
          <Textarea
            rows={3}
            placeholder="Explain why this student doesn't match the social criteria..."
            value={eliminationReason}
            onChange={(e) => setEliminationReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEliminateBox(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={eliminating || !eliminationReason.trim()}
              onClick={handleEliminate}
            >
              {eliminating ? "Eliminating..." : "Confirm Elimination"}
            </Button>
          </div>
        </div>
      )}

      <SocialForm
        studentId={student.id}
        defaultValues={
          existing
            ? toFormValues(existing, student.gender)
            : { gender: (student.gender as SocialFormValues["gender"]) ?? undefined }
        }
        visitorName={user?.displayName || user?.email || ""}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
