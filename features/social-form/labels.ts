import type { SocialFormValues } from "@/features/social-form/schema";
import {
  ACADEMIC_RANK_POINTS,
  DEBT_POINTS,
  DEPENDENTS_POINTS,
  EDUCATION_SUPPORT_POINTS,
  ELECTRICITY_ACCESS_POINTS,
  EXPENSES_POINTS,
  HEALTH_STATUS_POINTS,
  HOUSEHOLD_SIZE_POINTS,
  HOUSE_STATUS_POINTS,
  HOUSING_TYPE_POINTS,
  HUSBANDRY_POINTS,
  INCOME_CONTRIBUTION_POINTS,
  INCOME_POINTS,
  LAND_POINTS,
  PARENT_EDUCATION_POINTS,
  PARENT_OCCUPATION_POINTS,
  SCHOOL_ATTENDANCE_POINTS,
  WATER_ACCESS_POINTS,
} from "@/features/social-form/scoring";

export function opts<T extends string>(points: Record<T, number>, labels: Record<T, string>) {
  return (Object.keys(points) as T[]).map((value) => ({ value, label: labels[value], points: points[value] }));
}

export function labelFor<T extends string | number>(
  options: { value: T; label: string }[],
  value: T | null | undefined,
) {
  if (value == null || value === ("" as unknown as T)) return null;
  return options.find((o) => o.value === value)?.label ?? null;
}

export const HEALTH_OPTS = opts(HEALTH_STATUS_POINTS, {
  healthy: "Healthy",
  simple_disease: "Simple disease",
  chronic_disease: "Chronic disease",
});
export const ACADEMIC_OPTS = opts(ACADEMIC_RANK_POINTS, {
  outstanding_ab: "Outstanding — Ranks A & B",
  good_cd: "Good — Ranks C & D",
  average_e: "Average — Rank E",
});
export const MAJOR_OPTS: { value: "science" | "social_science"; label: string; points: number }[] = [
  { value: "science", label: "Science", points: 0 },
  { value: "social_science", label: "Social Science", points: 0 },
];
export const HOUSEHOLD_SIZE_OPTS = opts(HOUSEHOLD_SIZE_POINTS, {
  "1_3": "1–3 people",
  "4_6": "4–6 people",
  "7_plus": "7+ people",
});
export const DEPENDENTS_OPTS = opts(DEPENDENTS_POINTS, { none: "None", "1_2": "1–2", "3_plus": "3+" });
export const PARENT_OCCUPATION_OPTS = opts(PARENT_OCCUPATION_POINTS, {
  unemployed: "Unemployed",
  daily_laborer: "Daily laborer",
  farmer: "Farmer",
  mother: "Stay-at-home mother",
  small_business: "Small business",
  stable_salaried: "Stable salaried job",
});
export const FATHER_OCCUPATION_OPTS = PARENT_OCCUPATION_OPTS.filter((o) => o.value !== "mother");
export const HOUSING_TYPE_OPTS = opts(HOUSING_TYPE_POINTS, {
  makeshift: "Makeshift (bamboo, plastic, temporary)",
  wooden_zinc: "Wooden / basic zinc roof",
  brick_concrete: "Brick/Concrete simple",
  permanent: "Permanent well-structured house",
});
export const HOUSE_STATUS_OPTS = opts(HOUSE_STATUS_POINTS, {
  rented: "Rented / temporary",
  family_fragile: "Family-owned but fragile",
  family_fair: "Family-owned in fair condition",
  family_strong: "Family-owned and strong/permanent",
});
export const WATER_ACCESS_OPTS = opts(WATER_ACCESS_POINTS, {
  river_pond: "River/pond/unprotected source",
  communal_well: "Communal well / shared",
  own_well: "Own well / filtered water",
  piped: "Piped water supply",
});
export const ELECTRICITY_OPTS = opts(ELECTRICITY_ACCESS_POINTS, {
  none: "No electricity",
  shared_solar: "Shared / limited solar",
  regular: "Regular connection",
});
export const ASSET_OPTS = [
  { value: 0, label: "0", points: 0 },
  { value: 1, label: "1", points: 1 },
  { value: 2, label: "2", points: 2 },
  { value: 3, label: "3", points: 3 },
];
export const ASSET_RANK_LABELS = ["None", "Very few/old", "Some", "Many/modern"];
export const INCOME_OPTS = opts(INCOME_POINTS, {
  lt_100: "< $100",
  "101_200": "$101–200",
  "201_400": "$201–400",
  gt_400: "> $400",
});
export const EXPENSES_OPTS = opts(EXPENSES_POINTS, {
  lt_100: "< $100",
  "101_200": "$101–200",
  "201_400": "$201–400",
  gt_400: "> $400",
});
export const EDUCATION_SUPPORT_OPTS = opts(EDUCATION_SUPPORT_POINTS, {
  no: "No (cannot afford)",
  maybe: "Maybe (very limited)",
  yes: "Yes (can manage)",
});
export const PARENT_EDUCATION_OPTS = opts(PARENT_EDUCATION_POINTS, {
  none: "No formal education",
  primary: "Primary school",
  secondary: "Secondary school",
  high_school_above: "High school or above",
});
export const SCHOOL_ATTENDANCE_OPTS = opts(SCHOOL_ATTENDANCE_POINTS, {
  none: "None attend",
  some_irregular: "Some, irregular attendance",
  most_attend: "Most attend",
  all_attend: "All attend regularly",
});
export const DEBT_OPTS = opts(DEBT_POINTS, {
  no_debt: "No debt",
  small_manageable: "Small manageable debt",
  high_burden: "High debt with repayment burden",
  very_high_risk: "Very high debt / at risk",
});
export const LAND_OPTS = opts(LAND_POINTS, {
  landless: "Landless",
  small: "Small plot (<0.5 ha)",
  medium: "Medium plot (0.5–2 ha)",
  large: "Large (>2 ha)",
});
export const INCOME_CONTRIBUTION_OPTS = opts(INCOME_CONTRIBUTION_POINTS, {
  none: "None",
  minimal: "Minimal / subsistence only",
  moderate: "Moderate income support",
  major: "Major household income",
});
export const HUSBANDRY_OPTS = opts(HUSBANDRY_POINTS, {
  none: "No animal husbandry",
  small: "A few (2 pigs / 2 goats / 50 poultry)",
  medium: "Some (~2 cows / 2 buffaloes / 10 pigs / 10 goats / 100 poultry)",
  large: "Many (2+ cows / buffaloes / 10+ pigs / goats / 100+ poultry)",
});

export const VULNERABILITY_OPTS: { name: keyof SocialFormValues; label: string }[] = [
  { name: "vulnerability_orphan_single_parent", label: "Orphan / Single parent" },
  { name: "vulnerability_disability", label: "Disability in family" },
  { name: "vulnerability_chronic_illness", label: "Chronic illness" },
  { name: "vulnerability_debt_burden", label: "Debt burden" },
  { name: "vulnerability_landless", label: "Landless" },
];
