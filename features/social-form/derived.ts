import { differenceInYears } from "date-fns";
import { labelFor, MAJOR_OPTS } from "@/features/social-form/labels";
import { MAX_ELIGIBLE_AGE, MIN_ELIGIBLE_AGE } from "@/lib/constants";
import type { StudentListItem } from "@/services/studentService";

/** Shared by the Finalist page and its Report tab so both read a student's
 * age/major the same way — sourced from social_assessments, which only
 * FINALIST_SELECT populates with age/major (see studentService). */
export function getLatestVisit(student: Pick<StudentListItem, "social_assessments">) {
  return [...student.social_assessments].sort((a, b) => b.visit_number - a.visit_number)[0] ?? null;
}

/** dob gives an exact, ever-current age; when it's missing, fall back to the
 * age the home visitor reported on the most recent social form visit. */
export function getAge(student: Pick<StudentListItem, "dob" | "social_assessments">): number | null {
  if (student.dob) return differenceInYears(new Date(), new Date(student.dob));
  return getLatestVisit(student)?.age ?? null;
}

/** Academic major/track reported on the most recent social form visit. */
export function getMajor(student: Pick<StudentListItem, "social_assessments">): string | null {
  return labelFor(MAJOR_OPTS, getLatestVisit(student)?.major);
}

/** yes = has a certificate (any level), no = doesn't have one, none = question left empty. */
export type PovertyCertificateStatus = "yes" | "no" | "none";

/**
 * The social form's "Poverty Certificate?" is free text ("Yes", "Yes 2", "2",
 * "Level 1", "No, doesn't have", "Used to have poor card", ...). Any yes-answer
 * or level number means they have one; anything else written (no, used to
 * have, ...) means they don't have one now.
 */
export function getPovertyCertificateStatus(
  student: Pick<StudentListItem, "social_assessments">,
): PovertyCertificateStatus {
  const value = getLatestVisit(student)?.poverty_certificate?.trim().toLowerCase() ?? "";
  if (!value) return "none";
  if (/^(yes|y\b|\d|level|lv)/.test(value)) return "yes";
  return "no";
}

export function isAgeOutOfRange(age: number | null): boolean {
  return age != null && (age < MIN_ELIGIBLE_AGE || age > MAX_ELIGIBLE_AGE);
}
