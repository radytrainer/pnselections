/**
 * The written parts of the Annual Report that staff type in (saved per cycle
 * in annual_reports.content, migration 0070). Everything that can be counted
 * from the app's data is calculated in model.ts instead; a typed-in figure
 * overrides the calculated one (for numbers recorded outside the app).
 */

export type StageKey = "info_sessions" | "exams" | "interviews" | "home_visits" | "committee";

export const STAGES: { key: StageKey; label: string }[] = [
  { key: "info_sessions", label: "Information Sessions" },
  { key: "exams", label: "Examinations" },
  { key: "interviews", label: "Motivation Interviews" },
  { key: "home_visits", label: "Home Visits" },
  { key: "committee", label: "Final Selection Committee" },
];

/** Report chapters, in print order. `photo` = it can carry photos. */
export const CHAPTERS = [
  { key: "about", label: "All about the Report", photo: false },
  { key: "info_sessions", label: "Information Sessions", photo: true },
  { key: "exams", label: "Examinations", photo: true },
  { key: "interviews", label: "Motivation Interviews", photo: true },
  { key: "home_visits", label: "Home Visits", photo: true },
  { key: "committee", label: "Final Selection Committee", photo: true },
  { key: "announcement", label: "Final Announcement", photo: true },
  { key: "figures", label: "Overall Selection Figures", photo: false },
  { key: "timeline", label: "Timeline", photo: false },
  { key: "staff", label: "Overall Staff Participation", photo: false },
  { key: "budget", label: "Overall Selection Budget", photo: false },
  { key: "recommendations", label: "General Recommendations", photo: false },
  { key: "class", label: "Class Profile", photo: true },
  { key: "conclusion", label: "Conclusion", photo: true },
] as const;
export type ChapterKey = (typeof CHAPTERS)[number]["key"];
export type PhotoKey = ChapterKey | "cover";

/** Free-text paragraphs. `hint` guides what to write (shown as the placeholder). */
export const TEXTS = {
  intro: { chapter: "about", label: "Introduction", hint: "What this report covers: the selection journey from the first information session to contract signing, and what it celebrates." },
  is_text: { chapter: "info_sessions", label: "How the sessions were run", hint: "Official letters sent (MoEYS, provincial/district offices), staff training, regions reached, online sessions, how schedules were announced…" },
  is_challenges: { chapter: "info_sessions", label: "Challenges", hint: "e.g. school timetables, no hall or electricity, outdated materials…" },
  collaboration: { chapter: "info_sessions", label: "Collaboration highlight", hint: "Partner schools and NGOs who helped, and the ties with MoEYS and partners." },
  exam_text: { chapter: "exams", label: "How the exams were run", hint: "Exam content review, coordination with host schools, modalities (face-to-face / online), ZipGrade scanning…" },
  exam_protocol: { chapter: "exams", label: "Exam protocol (one point per line)", hint: "Conducted at designated test centers\nID verification and registration list used for attendance\n2 or 3 supervisors per room…" },
  exam_challenges: { chapter: "exams", label: "Challenges", hint: "e.g. school calendar, end-of-year activities, unknown number of examinees…" },
  exam_analysis: { chapter: "exams", label: "Score analysis comments", hint: "What the subject scores show — strongest and weakest subject, how the selected students compare with all exam takers." },
  exam_next: { chapter: "exams", label: "What next?", hint: "What exam passers did next (e.g. sketched the way to their home, joined a contact channel)." },
  mi_text: { chapter: "interviews", label: "How the interviews were run", hint: "Confirming interest, guideline review, staff training, face-to-face and online (Telegram, Messenger)…" },
  mi_challenges: { chapter: "interviews", label: "Challenges", hint: "e.g. no-shows, unstable internet, cameras off…" },
  hv_text: { chapter: "home_visits", label: "How the visits were run", hint: "Questionnaire review, staff training, NGO partners who helped…" },
  hv_challenges: { chapter: "home_visits", label: "Challenges", hint: "e.g. weather, remote areas, transportation…" },
  fsc_text: { chapter: "committee", label: "The committee", hint: "Who sat on the panel, when the sessions were held, how cases were presented and rated." },
  ranking: { chapter: "committee", label: "Global ranking", hint: "How the first list and the waiting list were set, and replacements for students who declined." },
  announcement: { chapter: "announcement", label: "Final result announcement", hint: "How and where the first list was shared, how long candidates had to confirm, enrollment." },
  registration_history: { chapter: "announcement", label: "Registration history", hint: "Comments on students who declined before enrollment and why." },
  dday: { chapter: "announcement", label: "Contract signing & D-Day", hint: "Contract signing with parents/guardians, first day on campus…" },
  overall_text: { chapter: "figures", label: "Comments on the overall figures", hint: "Targets reached, how selective the process was…" },
  timeline_text: { chapter: "timeline", label: "Timeline description", hint: "When each stage started and ended, and which ran at the same time." },
  staff_text: { chapter: "staff", label: "Staff participation", hint: "How staff were trained and assigned to each stage." },
  budget_text: { chapter: "budget", label: "Budget comments", hint: "Main costs and why (e.g. motodop rental for home visits in remote areas)." },
  overall_recommendation: { chapter: "recommendations", label: "Overall recommendation", hint: "What to strengthen next year." },
  class_text: { chapter: "class", label: "About the new class", hint: "Anything to add about the new scholars' backgrounds." },
  conclusion: { chapter: "conclusion", label: "Closing message", hint: "A short closing statement for the year." },
} as const satisfies Record<string, { chapter: ChapterKey; label: string; hint: string }>;
export type TextKey = keyof typeof TEXTS;

/**
 * Figures. `auto: true` = calculated from the app's data when not typed in;
 * the others exist only when someone types them (they were never recorded in the app).
 */
export const FIGURES = {
  is_sessions: { chapter: "info_sessions", label: "Information sessions held", auto: true },
  is_online: { chapter: "info_sessions", label: "Of which online", auto: false },
  is_female: { chapter: "info_sessions", label: "Attendees — female", auto: true },
  is_male: { chapter: "info_sessions", label: "Attendees — male", auto: true },
  is_target_female: { chapter: "info_sessions", label: "Target % of girls", auto: false },
  is_target_attendees: { chapter: "info_sessions", label: "Target number of attendees", auto: false },
  is_indigenous: { chapter: "info_sessions", label: "Indigenous participants", auto: false },
  is_disability: { chapter: "info_sessions", label: "Persons with different abilities", auto: false },
  is_schools: { chapter: "info_sessions", label: "High schools reached", auto: true },
  partner_schools: { chapter: "info_sessions", label: "Partner high schools (contracts)", auto: true },
  partner_ngos: { chapter: "info_sessions", label: "NGO partners", auto: true },
  exam_takers: { chapter: "exams", label: "Exam takers", auto: true },
  exam_female: { chapter: "exams", label: "Exam takers — female", auto: true },
  exam_male: { chapter: "exams", label: "Exam takers — male", auto: true },
  exam_count: { chapter: "exams", label: "Exams conducted (sessions)", auto: true },
  exam_provinces: { chapter: "exams", label: "Provinces reached", auto: true },
  exam_indigenous: { chapter: "exams", label: "Exam takers from indigenous groups", auto: false },
  exam_passed: { chapter: "exams", label: "Exam passers", auto: true },
  mi_interviewed: { chapter: "interviews", label: "Students interviewed", auto: true },
  mi_online: { chapter: "interviews", label: "Of which online", auto: false },
  mi_passed: { chapter: "interviews", label: "Passed the interview", auto: true },
  hv_visited: { chapter: "home_visits", label: "Home visits conducted", auto: true },
  hv_indigenous: { chapter: "home_visits", label: "Indigenous students visited", auto: false },
  hv_youth_war: { chapter: "home_visits", label: "Youth from conflict-affected areas", auto: false },
  fsc_cases: { chapter: "committee", label: "Cases presented", auto: true },
  fsc_eligible: { chapter: "committee", label: "Cases eligible for the ranking", auto: true },
  fsc_indigenous: { chapter: "committee", label: "Indigenous students", auto: false },
  fsc_muslim: { chapter: "committee", label: "Muslim students", auto: false },
  contracts: { chapter: "announcement", label: "Contracts signed", auto: true },
  class_indigenous: { chapter: "class", label: "Indigenous students in the class", auto: false },
  class_rural: { chapter: "class", label: "Students from rural areas", auto: false },
  poverty_line: { chapter: "class", label: "National poverty line (USD / person / month)", auto: false },
} as const satisfies Record<string, { chapter: ChapterKey; label: string; auto: boolean }>;
export type FigureKey = keyof typeof FIGURES;

export type StageReview = { strengths?: string; challenges?: string; recommendations?: string };
export type TimelineRow = { stage: string; start: string; end: string };
/** Amounts in USD per stage. */
export type BudgetRow = { item: string; amounts: Partial<Record<StageKey, number | null>> };
export type StaffRow = { name: string; stages: StageKey[] };

export type ReportContent = {
  /** Look of the report: "classic" (default), "modern" or "formal" — see templates.ts. */
  template?: string;
  title?: string;
  subtitle?: string;
  generation?: string;
  tagline?: string;
  /** Partners/donors shown on the cover, one per line. */
  supportedBy?: string;
  text?: Partial<Record<TextKey, string>>;
  figures?: Partial<Record<FigureKey, number | null>>;
  reviews?: Partial<Record<StageKey, StageReview>>;
  /** null/undefined = use the dates found in the data. */
  timeline?: TimelineRow[] | null;
  budget?: BudgetRow[];
  /** Staff who helped but aren't recorded in the app (info sessions, exams…). */
  staff?: StaffRow[];
  photos?: Partial<Record<PhotoKey, string[]>>;
  /** Chapters left out of the report. */
  hidden?: ChapterKey[];
};

export const MAX_PHOTOS: Record<PhotoKey, number> = {
  cover: 1, about: 0, info_sessions: 4, exams: 4, interviews: 3, home_visits: 4, committee: 3, announcement: 3,
  figures: 0, timeline: 0, staff: 0, budget: 0, recommendations: 0, class: 4, conclusion: 1,
};

export const DEFAULT_BUDGET_ITEMS = [
  "Transportation",
  "Accommodation",
  "Per diem",
  "Food & beverages",
  "Communication",
  "Office supplies & printing",
];

/** Text parts carried over by "Copy from another year" (not figures, photos or amounts). */
export function copyableContent(c: ReportContent): ReportContent {
  return {
    template: c.template,
    tagline: c.tagline,
    supportedBy: c.supportedBy,
    text: c.text,
    reviews: c.reviews,
    budget: c.budget?.map((b) => ({ item: b.item, amounts: {} })),
    figures: {
      is_target_female: c.figures?.is_target_female ?? null,
      is_target_attendees: c.figures?.is_target_attendees ?? null,
      poverty_line: c.figures?.poverty_line ?? null,
    },
  };
}
