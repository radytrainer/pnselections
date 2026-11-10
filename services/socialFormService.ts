import { api } from "@/lib/api/client";
import { advanceStatus, type StudentStatus } from "@/lib/constants";
import {
  computeSocialFormScore,
  computeVacScore,
  type SocialFormScoreInput,
  type VacField,
} from "@/features/social-form/scoring";
import type { Database } from "@/types/database.types";

export type SocialAssessment = Database["public"]["Tables"]["social_assessments"]["Row"];

/** Most recently recorded visit for this student, or null if none yet. */
export async function getLatestSocialAssessment(studentId: string) {
  return api.get<SocialAssessment | null>(`/api/v1/social-assessments/student/${studentId}/latest`);
}

type SaveInput = SocialFormScoreInput & {
  /** Updates this row if set; otherwise inserts a new visit. */
  id?: string;
  studentId: string;
  cycleId: string;
  visitNumber: number;
  currentStatus: StudentStatus;
  gender?: "male" | "female" | "lgbtqia+" | null;
  age?: number | null;
  major?: "science" | "social_science" | null;
  ok_to_join_training: string | null;
  academic_note: string | null;
  household_size_note: string | null;
  dependents_note: string | null;
  father_age: number | null;
  father_job: string | null;
  father_income: string | null;
  mother_age: number | null;
  mother_job: string | null;
  mother_income: string | null;
  child1_income: string | null;
  child2_income: string | null;
  child3_income: string | null;
  father_occupation_band?: string | null;
  mother_occupation_band?: string | null;
  house_owner: string | null;
  assets_furniture_note: string | null;
  assets_transport_note: string | null;
  assets_electronics_note: string | null;
  assets_livestock_note: string | null;
  income_note: string | null;
  expenses_note: string | null;
  education_support_note: string | null;
  school_aged_children_studying: number | null;
  school_aged_children_working: number | null;
  debt_amount: string | null;
  debt_note: string | null;
  farm_land_note: string | null;
  husbandry_note: string | null;
  vulnerability_note: string | null;
  poverty_certificate: string | null;
  distance_from_town: string | null;
  visitor_name: string | null;
  visitor_comments: string | null;
  manual_failed?: boolean;
} & Partial<Record<VacField, number | null | undefined>>;

export async function saveSocialAssessment(input: SaveInput) {
  const score = computeSocialFormScore(input);
  const vacScore = computeVacScore(input);

  const row = {
    student_id: input.studentId,
    cycle_id: input.cycleId,
    visit_number: input.visitNumber,
    age: input.age,
    health_status: input.health_status,
    ok_to_join_training: input.ok_to_join_training,
    academic_rank: input.academic_rank,
    academic_note: input.academic_note,
    major: input.major,
    household_size_band: input.household_size_band,
    household_size_note: input.household_size_note,
    dependents_band: input.dependents_band,
    dependents_note: input.dependents_note,
    father_age: input.father_age,
    father_job: input.father_job,
    father_income: input.father_income,
    mother_age: input.mother_age,
    mother_job: input.mother_job,
    mother_income: input.mother_income,
    child1_income: input.child1_income,
    child2_income: input.child2_income,
    child3_income: input.child3_income,
    parent_occupation_band: input.parent_occupation_band,
    father_occupation_band: input.father_occupation_band ?? null,
    mother_occupation_band: input.mother_occupation_band ?? null,
    house_owner: input.house_owner,
    housing_type_band: input.housing_type_band,
    house_status_band: input.house_status_band,
    water_access_band: input.water_access_band,
    electricity_access_band: input.electricity_access_band,
    assets_furniture: input.assets_furniture,
    assets_furniture_note: input.assets_furniture_note,
    assets_transport: input.assets_transport,
    assets_transport_note: input.assets_transport_note,
    assets_electronics: input.assets_electronics,
    assets_electronics_note: input.assets_electronics_note,
    assets_livestock: input.assets_livestock,
    assets_livestock_note: input.assets_livestock_note,
    income_band: input.income_band,
    income_note: input.income_note,
    expenses_band: input.expenses_band,
    expenses_note: input.expenses_note,
    education_support_band: input.education_support_band,
    education_support_note: input.education_support_note,
    father_education_band: input.father_education_band,
    mother_education_band: input.mother_education_band,
    school_aged_children_studying: input.school_aged_children_studying,
    school_aged_children_working: input.school_aged_children_working,
    school_attendance_band: input.school_attendance_band,
    debt_band: input.debt_band,
    debt_amount: input.debt_amount,
    debt_note: input.debt_note,
    farm_land_band: input.farm_land_band,
    farm_land_note: input.farm_land_note,
    farm_income_band: input.farm_income_band,
    plantation_land_band: input.plantation_land_band,
    plantation_income_band: input.plantation_income_band,
    vulnerability_orphan_single_parent: input.vulnerability_orphan_single_parent,
    vulnerability_disability: input.vulnerability_disability,
    vulnerability_chronic_illness: input.vulnerability_chronic_illness,
    vulnerability_debt_burden: input.vulnerability_debt_burden,
    vulnerability_landless: input.vulnerability_landless,
    vulnerability_note: input.vulnerability_note,
    husbandry_band: input.husbandry_band,
    husbandry_note: input.husbandry_note,
    total_score: score.totalScore,
    vulnerability_deduction: score.vulnerabilityDeduction,
    final_score: score.finalScore,
    category: score.category,
    manual_failed: input.manual_failed ?? false,
    poverty_certificate: input.poverty_certificate,
    distance_from_town: input.distance_from_town,
    visitor_name: input.visitor_name,
    visitor_comments: input.visitor_comments,
    vac_income_employment: input.vac_income_employment,
    vac_food_security: input.vac_food_security,
    vac_housing_conditions: input.vac_housing_conditions,
    vac_health_services: input.vac_health_services,
    vac_education: input.vac_education,
    vac_debt_finance: input.vac_debt_finance,
    vac_assets_livelihoods: input.vac_assets_livelihoods,
    vac_social_protection: input.vac_social_protection,
    vac_family_structure: input.vac_family_structure,
    vac_shocks_risks: input.vac_shocks_risks,
    vac_water_sanitation: input.vac_water_sanitation,
    vac_psychological_vulnerability: input.vac_psychological_vulnerability,
    vac_total_score: vacScore.totalScore,
  };

  const nextStatus = advanceStatus(input.currentStatus, "home_visit_completed");
  const statusChanged = nextStatus !== input.currentStatus;
  const genderChanged = !!input.gender;
  // Skip the student update when status isn't advancing and the student is already
  // in committee_review — home_visit_team RLS WITH CHECK requires visitor_id to
  // match at that stage, and pre-0026 rows have visitor_id = null.
  const shouldUpdateStudent =
    statusChanged || (genderChanged && input.currentStatus !== "committee_review");
  await api.post("/api/v1/social-assessments/save", {
    id: input.id,
    studentId: input.studentId,
    row,
    studentUpdate: shouldUpdateStudent
      ? {
          ...(statusChanged ? { status: nextStatus } : {}),
          ...(genderChanged ? { gender: input.gender! } : {}),
        }
      : undefined,
  });

  return score;
}
