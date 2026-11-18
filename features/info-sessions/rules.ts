/**
 * Information-session registration rules — same as the database
 * (db/migrations/0064_is_phone_age_rules.sql), here for instant feedback.
 */
export const MIN_AGE = 17;
export const MAX_AGE = 24;

const OPERATORS: Record<string, string[]> = {
  Smart: ["10", "15", "16", "69", "70", "81", "86", "87", "93", "96", "98"],
  Cellcard: ["11", "12", "14", "17", "61", "76", "77", "78", "79", "85", "89", "92", "95", "99"],
  Metfone: ["31", "60", "66", "67", "68", "71", "88", "90", "97"],
};

/** Normalized number (0XXXXXXXX) and its operator, or null when it isn't a Smart / Cellcard / Metfone mobile. */
export function khmerMobile(input: string): { number: string; operator: string } | null {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("855")) d = "0" + d.slice(3);
  if (d.startsWith("00")) return null;
  if (!d.startsWith("0")) d = "0" + d;
  if (!/^0\d{8,9}$/.test(d)) return null;
  const prefix = d.slice(1, 3);
  for (const [operator, prefixes] of Object.entries(OPERATORS)) if (prefixes.includes(prefix)) return { number: d, operator };
  return null;
}

/** "012 345 678" / "097 123 4567" */
export function formatKhmerMobile(n: string) {
  return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
}

/** Whole years between the birth date and today (same as Postgres age()). */
export function ageOn(dob: string, today = new Date()) {
  const [y, m, d] = dob.split("-").map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

/** Birth-date limits for the date picker: oldest allowed (24) and youngest allowed (17) today. */
export function dobLimits(today = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const youngest = new Date(today.getFullYear() - MIN_AGE, today.getMonth(), today.getDate());
  // Oldest: turned 25 tomorrow → born the day after today's date 25 years ago.
  const oldest = new Date(today.getFullYear() - MAX_AGE - 1, today.getMonth(), today.getDate() + 1);
  return { min: iso(oldest), max: iso(youngest) };
}
