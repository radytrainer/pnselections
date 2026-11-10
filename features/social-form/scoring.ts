/**
 * Point tables straight from the NGO's "Home Visit Form (with Full
 * Scoring)" PDF. Higher score = better-off (piped water beats river
 * water, a permanent house beats makeshift, etc.), so the final
 * category bands run low-score-is-poorest the same way the source
 * document does.
 *
 * Education (Section 8) lists levels with "M/F" next to each rather
 * than one shared field — read as one level per parent. The source
 * doesn't define how two parent values collapse into the section's
 * single score slot, so this averages them (rounded) — the only
 * choice that doesn't silently drop one parent's data.
 */

export const HEALTH_STATUS_POINTS = { healthy: 1, simple_disease: 2, chronic_disease: 3 } as const;
export const ACADEMIC_RANK_POINTS = { outstanding_ab: 1, good_cd: 2, average_e: 3 } as const;
export const HOUSEHOLD_SIZE_POINTS = { "1_3": 3, "4_6": 2, "7_plus": 1 } as const;
export const DEPENDENTS_POINTS = { none: 3, "1_2": 2, "3_plus": 1 } as const;
export const PARENT_OCCUPATION_POINTS = {
  unemployed: 0,
  daily_laborer: 1,
  farmer: 2,
  mother: 2,
  small_business: 2,
  stable_salaried: 3,
} as const;
export const HOUSING_TYPE_POINTS = { makeshift: 0, wooden_zinc: 1, brick_concrete: 2, permanent: 3 } as const;
export const HOUSE_STATUS_POINTS = { rented: 0, family_fragile: 1, family_fair: 2, family_strong: 3 } as const;
export const WATER_ACCESS_POINTS = { river_pond: 0, communal_well: 1, own_well: 2, piped: 3 } as const;
export const ELECTRICITY_ACCESS_POINTS = { none: 0, shared_solar: 1, regular: 2 } as const;
export const INCOME_POINTS = { lt_100: 0, "101_200": 1, "201_400": 2, gt_400: 3 } as const;
export const EXPENSES_POINTS = { lt_100: 3, "101_200": 2, "201_400": 1, gt_400: 0 } as const;
export const EDUCATION_SUPPORT_POINTS = { no: 0, maybe: 1, yes: 2 } as const;
export const PARENT_EDUCATION_POINTS = { none: 0, primary: 1, secondary: 2, high_school_above: 3 } as const;
export const SCHOOL_ATTENDANCE_POINTS = {
  none: 0,
  some_irregular: 1,
  most_attend: 2,
  all_attend: 3,
} as const;
export const DEBT_POINTS = { no_debt: 3, small_manageable: 2, high_burden: 1, very_high_risk: 0 } as const;
/** Shared scale for both farm and plantation land size. */
export const LAND_POINTS = { landless: 0, small: 1, medium: 2, large: 3 } as const;
/** Shared scale for both farm and plantation income contribution. */
export const INCOME_CONTRIBUTION_POINTS = { none: 0, minimal: 1, moderate: 2, major: 3 } as const;
export const HUSBANDRY_POINTS = { none: 0, small: 1, medium: 2, large: 3 } as const;

export const VULNERABILITY_FIELDS = [
  "vulnerability_orphan_single_parent",
  "vulnerability_disability",
  "vulnerability_chronic_illness",
  "vulnerability_debt_burden",
  "vulnerability_landless",
] as const;

export type SocialFormScoreInput = {
  health_status?: keyof typeof HEALTH_STATUS_POINTS | null;
  academic_rank?: keyof typeof ACADEMIC_RANK_POINTS | null;
  household_size_band?: keyof typeof HOUSEHOLD_SIZE_POINTS | null;
  dependents_band?: keyof typeof DEPENDENTS_POINTS | null;
  parent_occupation_band?: keyof typeof PARENT_OCCUPATION_POINTS | null;
  father_occupation_band?: keyof typeof PARENT_OCCUPATION_POINTS | null;
  mother_occupation_band?: keyof typeof PARENT_OCCUPATION_POINTS | null;
  housing_type_band?: keyof typeof HOUSING_TYPE_POINTS | null;
  house_status_band?: keyof typeof HOUSE_STATUS_POINTS | null;
  water_access_band?: keyof typeof WATER_ACCESS_POINTS | null;
  electricity_access_band?: keyof typeof ELECTRICITY_ACCESS_POINTS | null;
  assets_furniture?: number | null;
  assets_transport?: number | null;
  assets_electronics?: number | null;
  assets_livestock?: number | null;
  income_band?: keyof typeof INCOME_POINTS | null;
  expenses_band?: keyof typeof EXPENSES_POINTS | null;
  education_support_band?: keyof typeof EDUCATION_SUPPORT_POINTS | null;
  father_education_band?: keyof typeof PARENT_EDUCATION_POINTS | null;
  mother_education_band?: keyof typeof PARENT_EDUCATION_POINTS | null;
  school_attendance_band?: keyof typeof SCHOOL_ATTENDANCE_POINTS | null;
  debt_band?: keyof typeof DEBT_POINTS | null;
  farm_land_band?: keyof typeof LAND_POINTS | null;
  farm_income_band?: keyof typeof INCOME_CONTRIBUTION_POINTS | null;
  plantation_land_band?: keyof typeof LAND_POINTS | null;
  plantation_income_band?: keyof typeof INCOME_CONTRIBUTION_POINTS | null;
  husbandry_band?: keyof typeof HUSBANDRY_POINTS | null;
  vulnerability_orphan_single_parent: boolean;
  vulnerability_disability: boolean;
  vulnerability_chronic_illness: boolean;
  vulnerability_debt_burden: boolean;
  vulnerability_landless: boolean;
};

export type SocialFormCategory = "very_poor" | "poor" | "medium" | "relatively_well_off";

export const CATEGORY_LABELS: Record<SocialFormCategory, string> = {
  very_poor: "Very Poor / Vulnerable",
  poor: "Poor",
  medium: "Medium Poor",
  relatively_well_off: "Relatively Well-off",
};

export const CATEGORY_BADGE_CLASSES: Record<SocialFormCategory, string> = {
  very_poor: "bg-green-100 text-green-700",
  poor: "bg-blue-100 text-blue-700",
  medium: "bg-orange-100 text-orange-700",
  relatively_well_off: "bg-green-100 text-green-700",
};

function points<T extends string>(map: Record<T, number>, value: T | null | undefined): number {
  return value != null ? map[value] : 0;
}

/**
 * `relatively_well_off` is kept only so old stored assessments (from before this
 * band layout) still render a label/color — the score bands below no longer produce it,
 * since anything past the poor/medium split is caught by isFailedHomeVisit instead.
 */
function categoryFor(finalScore: number): SocialFormCategory {
  if (finalScore <= 25) return "very_poor";
  if (finalScore <= 40) return "poor";
  return "medium";
}

/** At or above this, the household is judged too well-off to qualify — the visit is flagged as failed rather than scored into a poverty band. */
export const FAILED_HOME_VISIT_THRESHOLD = 50;

/** `manualFailed` lets the selection team fail a visit outright for reasons the point rubric doesn't capture, regardless of score. */
export function isFailedHomeVisit(finalScore: number, manualFailed?: boolean | null): boolean {
  return manualFailed === true || finalScore >= FAILED_HOME_VISIT_THRESHOLD;
}

export function computeSocialFormScore(input: SocialFormScoreInput) {
  const parentEducationAvg = Math.round(
    (points(PARENT_EDUCATION_POINTS, input.father_education_band) +
      points(PARENT_EDUCATION_POINTS, input.mother_education_band)) /
      2,
  );

  // Average the two per-parent occupation bands when available; fall back to the
  // legacy combined field for assessments recorded before the split.
  const parentOccupationScore =
    input.father_occupation_band != null || input.mother_occupation_band != null
      ? Math.round(
          (points(PARENT_OCCUPATION_POINTS, input.father_occupation_band) +
            points(PARENT_OCCUPATION_POINTS, input.mother_occupation_band)) /
            2,
        )
      : points(PARENT_OCCUPATION_POINTS, input.parent_occupation_band);

  const totalScore =
    points(HEALTH_STATUS_POINTS, input.health_status) +
    points(ACADEMIC_RANK_POINTS, input.academic_rank) +
    points(HOUSEHOLD_SIZE_POINTS, input.household_size_band) +
    points(DEPENDENTS_POINTS, input.dependents_band) +
    parentOccupationScore +
    points(HOUSING_TYPE_POINTS, input.housing_type_band) +
    points(HOUSE_STATUS_POINTS, input.house_status_band) +
    points(WATER_ACCESS_POINTS, input.water_access_band) +
    points(ELECTRICITY_ACCESS_POINTS, input.electricity_access_band) +
    (input.assets_furniture ?? 0) +
    (input.assets_transport ?? 0) +
    (input.assets_electronics ?? 0) +
    (input.assets_livestock ?? 0) +
    points(INCOME_POINTS, input.income_band) +
    points(EXPENSES_POINTS, input.expenses_band) +
    points(EDUCATION_SUPPORT_POINTS, input.education_support_band) +
    parentEducationAvg +
    points(SCHOOL_ATTENDANCE_POINTS, input.school_attendance_band) +
    points(DEBT_POINTS, input.debt_band) +
    points(LAND_POINTS, input.farm_land_band) +
    points(INCOME_CONTRIBUTION_POINTS, input.farm_income_band) +
    points(LAND_POINTS, input.plantation_land_band) +
    points(INCOME_CONTRIBUTION_POINTS, input.plantation_income_band) +
    points(HUSBANDRY_POINTS, input.husbandry_band);

  const vulnerabilityDeduction = VULNERABILITY_FIELDS.filter((field) => input[field]).length;
  const finalScore = totalScore - vulnerabilityDeduction;

  return {
    totalScore,
    vulnerabilityDeduction,
    finalScore,
    category: categoryFor(finalScore),
  };
}

/**
 * The NGO's separate 12-category "Vulnerability Assessment Checklist for
 * Poor Families" — filled in by the selection team at the end of the home
 * visit, alongside (not instead of) the scoring above. Low=3/Medium=2/
 * High=1, so unlike the rest of this file a LOWER total here means more
 * vulnerable, matching the source document's own scoring guide.
 */
export const VAC_FIELDS = [
  "vac_income_employment",
  "vac_food_security",
  "vac_housing_conditions",
  "vac_health_services",
  "vac_education",
  "vac_debt_finance",
  "vac_assets_livelihoods",
  "vac_social_protection",
  "vac_family_structure",
  "vac_shocks_risks",
  "vac_water_sanitation",
  "vac_psychological_vulnerability",
] as const;

export type VacField = (typeof VAC_FIELDS)[number];
export type VacScore = 1 | 2 | 3;

export const VAC_CATEGORIES: {
  field: VacField;
  label: string;
  options: { value: VacScore; label: string }[];
}[] = [
  {
    field: "vac_income_employment",
    label: "Income & Employment",
    options: [
      { value: 3, label: "Stable income, covers needs" },
      { value: 2, label: "Irregular income, sometimes insufficient" },
      { value: 1, label: "No regular income, cannot cover basics" },
    ],
  },
  {
    field: "vac_food_security",
    label: "Food Security",
    options: [
      { value: 3, label: "Enough food, balanced diet" },
      { value: 2, label: "Sometimes insufficient/low quality" },
      { value: 1, label: "Frequent shortages, malnutrition signs" },
    ],
  },
  {
    field: "vac_housing_conditions",
    label: "Housing Conditions",
    options: [
      { value: 3, label: "Safe house, clean water, electricity" },
      { value: 2, label: "Inadequate housing, partial utilities" },
      { value: 1, label: "Unsafe shelter, no utilities" },
    ],
  },
  {
    field: "vac_health_services",
    label: "Health & Services",
    options: [
      { value: 3, label: "Healthy, access to clinics" },
      { value: 2, label: "Some health issues, limited access" },
      { value: 1, label: "Serious illness/disability, no access" },
    ],
  },
  {
    field: "vac_education",
    label: "Education",
    options: [
      { value: 3, label: "All children in school" },
      { value: 2, label: "Some children miss/drop out" },
      { value: 1, label: "Most children not in school, no literacy" },
    ],
  },
  {
    field: "vac_debt_finance",
    label: "Debt & Finance",
    options: [
      { value: 3, label: "No or manageable debt" },
      { value: 2, label: "Some debt, repayable with difficulty" },
      { value: 1, label: "Heavy debt, borrowing for daily food" },
    ],
  },
  {
    field: "vac_assets_livelihoods",
    label: "Assets & Livelihoods",
    options: [
      { value: 3, label: "Own land/livestock/tools" },
      { value: 2, label: "Few assets, at risk of loss" },
      { value: 1, label: "No assets, no land/livelihood means" },
    ],
  },
  {
    field: "vac_social_protection",
    label: "Social Protection",
    options: [
      { value: 1, label: "Enrolled in programs" },
      { value: 2, label: "Limited support" },
      { value: 3, label: "No protection, excluded from programs" },
    ],
  },
  {
    field: "vac_family_structure",
    label: "Family Structure",
    options: [
      { value: 3, label: "Balanced earners/dependents" },
      { value: 2, label: "Many dependents, some support" },
      { value: 1, label: "Single parent/elderly/disabled, no support" },
    ],
  },
  {
    field: "vac_shocks_risks",
    label: "Shocks & Risks",
    options: [
      { value: 3, label: "Resilient, some savings" },
      { value: 2, label: "Some vulnerability" },
      { value: 1, label: "One shock could cause crisis" },
    ],
  },
  {
    field: "vac_water_sanitation",
    label: "Water & Sanitation",
    options: [
      { value: 3, label: "Safe water + sanitation" },
      { value: 2, label: "Safe water but poor sanitation" },
      { value: 1, label: "No safe water or sanitation" },
    ],
  },
  {
    field: "vac_psychological_vulnerability",
    label: "Psychological Vulnerability",
    options: [
      { value: 3, label: "Family copes well with stress" },
      { value: 2, label: "High stress, weak coping" },
      { value: 1, label: "Severe stress, no coping mechanisms" },
    ],
  },
];

export type VacTier = "high" | "moderate" | "low";

export const VAC_TIER_LABELS: Record<VacTier, string> = {
  high: "High Vulnerability",
  moderate: "Moderate Vulnerability",
  low: "Low Vulnerability",
};

export const VAC_TIER_BADGE_CLASSES: Record<VacTier, string> = {
  high: "bg-red-100 text-red-700",
  moderate: "bg-amber-100 text-amber-700",
  low: "bg-green-100 text-green-700",
};

/** Per the source document's scoring guide: 10–18 High, 18–25 Moderate, 25–36 Low. */
export function vacTierFor(totalScore: number): VacTier {
  if (totalScore <= 18) return "high";
  if (totalScore <= 25) return "moderate";
  return "low";
}

export function computeVacScore(input: Partial<Record<VacField, number | null | undefined>>) {
  const totalScore = VAC_FIELDS.reduce((sum, field) => sum + (input[field] ?? 0), 0);
  return { totalScore, tier: vacTierFor(totalScore) };
}
