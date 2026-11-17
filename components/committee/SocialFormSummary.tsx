import {
  CreditCard,
  HeartPulse,
  Home as HomeIcon,
  ListChecks,
  Package,
  ShieldAlert,
  Users,
  Wallet,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import {
  CATEGORY_BADGE_CLASSES,
  CATEGORY_LABELS,
  isFailedHomeVisit,
  VAC_CATEGORIES,
  VAC_TIER_BADGE_CLASSES,
  VAC_TIER_LABELS,
  vacTierFor,
  type SocialFormCategory,
} from "@/features/social-form/scoring";
import {
  ACADEMIC_OPTS,
  ASSET_RANK_LABELS,
  DEBT_OPTS,
  DEPENDENTS_OPTS,
  EDUCATION_SUPPORT_OPTS,
  ELECTRICITY_OPTS,
  EXPENSES_OPTS,
  HEALTH_OPTS,
  HOUSEHOLD_SIZE_OPTS,
  HOUSE_STATUS_OPTS,
  HOUSING_TYPE_OPTS,
  HUSBANDRY_OPTS,
  INCOME_CONTRIBUTION_OPTS,
  INCOME_OPTS,
  LAND_OPTS,
  MAJOR_OPTS,
  PARENT_EDUCATION_OPTS,
  PARENT_OCCUPATION_OPTS,
  SCHOOL_ATTENDANCE_OPTS,
  VULNERABILITY_OPTS,
  WATER_ACCESS_OPTS,
  labelFor,
} from "@/features/social-form/labels";
import {
  DEBT_POINTS,
  DEPENDENTS_POINTS,
  EDUCATION_SUPPORT_POINTS,
  ELECTRICITY_ACCESS_POINTS,
  EXPENSES_POINTS,
  HOUSEHOLD_SIZE_POINTS,
  HOUSE_STATUS_POINTS,
  HOUSING_TYPE_POINTS,
  HUSBANDRY_POINTS,
  INCOME_CONTRIBUTION_POINTS,
  INCOME_POINTS,
  LAND_POINTS,
  PARENT_OCCUPATION_POINTS,
  SCHOOL_ATTENDANCE_POINTS,
  WATER_ACCESS_POINTS,
} from "@/features/social-form/scoring";
import type { SocialAssessmentRow } from "@/services/committeeService";
import { cn } from "@/lib/utils";

/**
 * How much this answer points to need, from the scoring rubric (higher points
 * = better-off, see scoring.ts): fewest points = "high", most = "low".
 * Only set where the rubric gives a clear direction — Health and Academic
 * points don't map to need that way, so they stay neutral.
 */
export type Need = "high" | "medium" | "low";
export type Row = { label: string; value: string; need?: Need };

function needFrom<K extends string>(points: Record<K, number>, key: K | null | undefined): Need | undefined {
  if (key == null) return undefined;
  const p = points[key];
  if (p == null) return undefined;
  const values = Object.values(points) as number[];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return undefined;
  const t = (p - min) / (max - min);
  return t <= 0.34 ? "high" : t >= 0.67 ? "low" : "medium";
}

/** Household assets use a 0–3 rank (None … Many/modern). */
const ASSET_POINTS = { 0: 0, 1: 1, 2: 2, 3: 3 } as Record<string, number>;
const assetNeed = (rank: number | null | undefined) => (rank == null ? undefined : needFrom(ASSET_POINTS, String(rank)));

function section(title: string, icon: LucideIcon, rows: Row[]) {
  return { title, icon, rows: rows.filter((r) => r.value) };
}

/** The note is a free-text override ("Specify...") of the selected band, not
 * a comment alongside it — show the note alone when set, the band otherwise. */
/** "Age 40 · Farmer · Income 250 · Primary school" — labels the bare numbers. */
function parentLine(age: number | null | undefined, job: string | null | undefined, income: string | null | undefined, education: string | null | undefined) {
  return [age != null ? `Age ${age}` : "", job ?? "", income ? `Income ${income}` : "", education ?? ""].filter(Boolean).join(" · ");
}

function noteOrLabel(label: string | null | undefined, note: string | null | undefined) {
  return note?.trim() ? note : (label ?? "");
}

/** The Social Form sections (label/value rows), shared with the full-screen presentation. */
export function buildSections(a: SocialAssessmentRow) {
  return [
    section("Health & Academic", HeartPulse, [
      { label: "Age", value: a.age?.toString() ?? "" },
      { label: "Child Rank in Family", value: a.child_rank?.toString() ?? "" },
      { label: "Children in Family", value: a.children_count?.toString() ?? "" },
      {
        label: "Family Members",
        value: [
          a.family_male_count != null ? `${a.family_male_count} male` : "",
          a.family_female_count != null ? `${a.family_female_count} female` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      },
      { label: "Family Notes", value: a.family_note ?? "" },
      { label: "Health", value: labelFor(HEALTH_OPTS, a.health_status) ?? "" },
      { label: "Academic Performance", value: labelFor(ACADEMIC_OPTS, a.academic_rank) ?? "" },
      { label: "Academic Notes", value: a.academic_note ?? "" },
      { label: "Major", value: labelFor(MAJOR_OPTS, a.major) ?? "" },
      { label: "OK to Join Training", value: a.ok_to_join_training ?? "" },
    ]),
    section("Household & Family", Users, [
      { label: "Household Size", value: labelFor(HOUSEHOLD_SIZE_OPTS, a.household_size_band) ?? "", need: needFrom(HOUSEHOLD_SIZE_POINTS, a.household_size_band) },
      { label: "Dependents", value: labelFor(DEPENDENTS_OPTS, a.dependents_band) ?? "", need: needFrom(DEPENDENTS_POINTS, a.dependents_band) },
      { label: "Children Studying", value: a.school_aged_children_studying?.toString() ?? "" },
      { label: "Children Working", value: a.school_aged_children_working?.toString() ?? "" },
      { label: "School Attendance", value: labelFor(SCHOOL_ATTENDANCE_OPTS, a.school_attendance_band) ?? "", need: needFrom(SCHOOL_ATTENDANCE_POINTS, a.school_attendance_band) },
      { label: "Parent Occupation", value: labelFor(PARENT_OCCUPATION_OPTS, a.parent_occupation_band) ?? "", need: needFrom(PARENT_OCCUPATION_POINTS, a.parent_occupation_band) },
      {
        label: "Father",
        value: parentLine(a.father_age, a.father_job, a.father_income, labelFor(PARENT_EDUCATION_OPTS, a.father_education_band)),
      },
      {
        label: "Mother",
        value: parentLine(a.mother_age, a.mother_job, a.mother_income, labelFor(PARENT_EDUCATION_OPTS, a.mother_education_band)),
      },
      {
        label: "Children's Income",
        value: [a.child1_income, a.child2_income, a.child3_income]
          .map((v, i) => (v ? `Child ${i + 1}: ${v}` : ""))
          .filter(Boolean)
          .join(" · "),
      },
    ]),
    section("Housing & Utilities", HomeIcon, [
      { label: "House Owner", value: a.house_owner ?? "" },
      { label: "Housing Type", value: labelFor(HOUSING_TYPE_OPTS, a.housing_type_band) ?? "", need: needFrom(HOUSING_TYPE_POINTS, a.housing_type_band) },
      { label: "House Status", value: labelFor(HOUSE_STATUS_OPTS, a.house_status_band) ?? "", need: needFrom(HOUSE_STATUS_POINTS, a.house_status_band) },
      { label: "Water Access", value: labelFor(WATER_ACCESS_OPTS, a.water_access_band) ?? "", need: needFrom(WATER_ACCESS_POINTS, a.water_access_band) },
      { label: "Electricity", value: labelFor(ELECTRICITY_OPTS, a.electricity_access_band) ?? "", need: needFrom(ELECTRICITY_ACCESS_POINTS, a.electricity_access_band) },
    ]),
    section("Household Assets", Package, [
      { label: "Furniture", value: ASSET_RANK_LABELS[a.assets_furniture ?? 0] ?? "", need: assetNeed(a.assets_furniture) },
      { label: "Transport", value: ASSET_RANK_LABELS[a.assets_transport ?? 0] ?? "", need: assetNeed(a.assets_transport) },
      { label: "Electronics", value: ASSET_RANK_LABELS[a.assets_electronics ?? 0] ?? "", need: assetNeed(a.assets_electronics) },
      { label: "Livestock", value: ASSET_RANK_LABELS[a.assets_livestock ?? 0] ?? "", need: assetNeed(a.assets_livestock) },
    ]),
    section("Income & Expenses", Wallet, [
      { label: "Monthly Income", value: noteOrLabel(labelFor(INCOME_OPTS, a.income_band), a.income_note), need: needFrom(INCOME_POINTS, a.income_band) },
      { label: "Monthly Expenses", value: noteOrLabel(labelFor(EXPENSES_OPTS, a.expenses_band), a.expenses_note), need: needFrom(EXPENSES_POINTS, a.expenses_band) },
      {
        label: "Can Support Education",
        value: noteOrLabel(labelFor(EDUCATION_SUPPORT_OPTS, a.education_support_band), a.education_support_note),
        need: needFrom(EDUCATION_SUPPORT_POINTS, a.education_support_band),
      },
    ]),
    section("Debt", CreditCard, [
      { label: "Debt Status", value: [labelFor(DEBT_OPTS, a.debt_band), a.debt_amount].filter(Boolean).join(" — "), need: needFrom(DEBT_POINTS, a.debt_band) },
      { label: "Reason for Debt", value: a.debt_note ?? "" },
    ]),
    section("Farming, Plantation & Husbandry", Wheat, [
      { label: "Farm Land", value: [labelFor(LAND_OPTS, a.farm_land_band), a.farm_land_note].filter(Boolean).join(" — "), need: needFrom(LAND_POINTS, a.farm_land_band) },
      { label: "Farm Income", value: labelFor(INCOME_CONTRIBUTION_OPTS, a.farm_income_band) ?? "", need: needFrom(INCOME_CONTRIBUTION_POINTS, a.farm_income_band) },
      { label: "Plantation Land", value: labelFor(LAND_OPTS, a.plantation_land_band) ?? "", need: needFrom(LAND_POINTS, a.plantation_land_band) },
      { label: "Plantation Income", value: labelFor(INCOME_CONTRIBUTION_OPTS, a.plantation_income_band) ?? "", need: needFrom(INCOME_CONTRIBUTION_POINTS, a.plantation_income_band) },
      { label: "Husbandry", value: [labelFor(HUSBANDRY_OPTS, a.husbandry_band), a.husbandry_note].filter(Boolean).join(" — "), need: needFrom(HUSBANDRY_POINTS, a.husbandry_band) },
    ]),
    section("Vulnerability Factors", ShieldAlert, [
      {
        label: "Flagged",
        value: VULNERABILITY_OPTS.filter((v) => a[v.name as keyof SocialAssessmentRow])
          .map((v) => v.label)
          .join(", "),
        need: "high",
      },
      { label: "Score Deduction", value: a.vulnerability_deduction ? `−${a.vulnerability_deduction}` : "" },
      { label: "Notes", value: a.vulnerability_note ?? "" },
    ]),
  ];
}

/** Vulnerability Assessment Checklist rows + tier, shared with the presentation. */
export function buildVac(a: SocialAssessmentRow) {
  const VAC_NEED: Record<number, Need> = { 1: "high", 2: "medium", 3: "low" };
  const rows: Row[] = VAC_CATEGORIES.map((c) => ({
    label: c.label,
    value: c.options.find((o) => o.value === a[c.field])?.label ?? "",
    need: a[c.field] != null ? VAC_NEED[a[c.field] as number] : undefined,
  })).filter((r) => r.value);
  const tier = a.vac_total_score != null ? vacTierFor(a.vac_total_score) : null;
  return { rows, tier, answered: rows.length, total: VAC_CATEGORIES.length };
}

export function SocialFormSummary({ assessment }: { assessment: SocialAssessmentRow }) {
  const sections = buildSections(assessment);
  const category = assessment.category as SocialFormCategory;
  const failedHomeVisit = isFailedHomeVisit(assessment.final_score ?? 0, assessment.manual_failed);
  const { rows: vacRows, tier: vacTier } = buildVac(assessment);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <div className="text-sm">
          <span className="font-medium">Visit #{assessment.visit_number}</span>
          <span className="text-muted-foreground"> · {assessment.visit_date}</span>
          {assessment.visitor_name && <span className="text-muted-foreground"> · by {assessment.visitor_name}</span>}
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            failedHomeVisit ? "bg-red-100 text-red-700" : CATEGORY_BADGE_CLASSES[category],
          )}
        >
          {assessment.final_score} pts · {failedHomeVisit ? "Failed Home Visit" : CATEGORY_LABELS[category]}
        </span>
      </div>

      <div className="rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ListChecks className="size-4 text-primary" />
            Vulnerability Assessment Checklist
          </div>
          {vacTier && (
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", VAC_TIER_BADGE_CLASSES[vacTier])}>
              {assessment.vac_total_score}/36 · {VAC_TIER_LABELS[vacTier]}
            </span>
          )}
        </div>
        {vacRows.length === 0 ? (
          <p className="mt-1.5 text-xs text-muted-foreground">Not recorded</p>
        ) : (
          <dl className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
            {vacRows.map((row) => (
              <div key={row.label} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="text-right font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sections.map((sec) => (
          <div key={sec.title} className="rounded-lg border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <sec.icon className="size-4 text-primary" />
              {sec.title}
            </div>
            {sec.rows.length === 0 ? (
              <p className="mt-1.5 text-xs text-muted-foreground">Not recorded</p>
            ) : (
              <dl className="mt-1.5 space-y-1 text-xs">
                {sec.rows.map((row) => (
                  <div key={row.label} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="text-right font-medium">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>

      {(assessment.poverty_certificate || assessment.distance_from_town || assessment.visitor_comments) && (
        <div className="rounded-lg border p-3 text-xs">
          <dl className="space-y-1">
            {assessment.poverty_certificate && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Poverty Certificate</dt>
                <dd className="text-right font-medium">{assessment.poverty_certificate}</dd>
              </div>
            )}
            {assessment.distance_from_town && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Distance from Town</dt>
                <dd className="text-right font-medium">{assessment.distance_from_town}</dd>
              </div>
            )}
          </dl>
          {assessment.visitor_comments && (
            <p className="mt-2 border-t pt-2 text-muted-foreground">{assessment.visitor_comments}</p>
          )}
        </div>
      )}
    </div>
  );
}
