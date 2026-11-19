/**
 * The scholarship application form (ពាក្យស្នើរសុំអាហារូបករណ៍) — the paper form's
 * six sections as data, used both by the public form (/apply/<token>) and the
 * staff view of the answers. Answers are stored as a flat object keyed by
 * field `key` (migration 0068): text → string, radio → option value,
 * checks → option values[], declaration → boolean.
 */

export type Option = { value: string; km: string; en: string };

export type FieldType = "text" | "textarea" | "date" | "tel" | "number" | "radio" | "checks";

export type Field = {
  key: string;
  type: FieldType;
  km: string;
  en: string;
  required?: boolean;
  options?: Option[];
  /** Only shown (and kept) when another answer matches. */
  showIf?: { key: string; equals?: string; includesOtherThan?: string; includes?: string };
  placeholder?: string;
  /** Grid width on wide screens. */
  half?: boolean;
  max?: number;
};

export type Section = { id: string; km: string; en: string; note?: { km: string; en: string }; fields: Field[] };

export type Answers = Record<string, string | string[] | boolean | null>;

const yesNo: Option[] = [
  { value: "yes", km: "បាទ/ចាស", en: "Yes" },
  { value: "no", km: "ទេ", en: "No" },
];

export const SECTIONS: Section[] = [
  {
    id: "personal",
    km: "ផ្នែក ១៖ ព័ត៌មានផ្ទាល់ខ្លួន",
    en: "Part 1: Personal information",
    fields: [
      { key: "name_kh", type: "text", km: "ឈ្មោះពេញជាភាសាខ្មែរ", en: "Full name in Khmer", required: true, half: true, max: 120 },
      { key: "name_latin", type: "text", km: "ឈ្មោះពេញជាឡាតាំង", en: "Full name in Latin letters", required: true, half: true, max: 120 },
      { key: "dob", type: "date", km: "ថ្ងៃខែឆ្នាំកំណើត", en: "Date of birth", required: true, half: true },
      {
        key: "gender",
        type: "radio",
        km: "ភេទ",
        en: "Gender",
        required: true,
        half: true,
        options: [
          { value: "male", km: "ប្រុស", en: "Male" },
          { value: "female", km: "ស្រី", en: "Female" },
          { value: "other", km: "ផ្សេងៗ", en: "Other" },
        ],
      },
      { key: "phone", type: "tel", km: "លេខទូរស័ព្ទ", en: "Phone", required: true, half: true, max: 30, placeholder: "012 345 678" },
      { key: "telegram", type: "text", km: "តេឡេក្រាម", en: "Telegram", half: true, max: 60, placeholder: "@username or phone" },
      { key: "address_village", type: "text", km: "ភូមិ", en: "Village", half: true, max: 100 },
      { key: "address_commune", type: "text", km: "ឃុំ/សង្កាត់", en: "Commune", half: true, max: 100 },
      { key: "address_district", type: "text", km: "ស្រុក/ខណ្ឌ", en: "District", half: true, max: 100 },
      { key: "address_province", type: "text", km: "ខេត្ត/រាជធានី", en: "Province", required: true, half: true, max: 100 },
      { key: "sponsor_ngo", type: "text", km: "អង្គការដែលឧបត្ថម្ភ", en: "Sponsoring organization (NGO)", max: 200, placeholder: "Leave empty if none" },
    ],
  },
  {
    id: "family",
    km: "ផ្នែក ២៖ ព័ត៌មានគ្រួសារ និងស្ថានភាពសេដ្ឋកិច្ច",
    en: "Part 2: Family and economic situation",
    note: { km: "ព័ត៌មានឪពុកម្តាយ / អ្នកអាណាព្យាបាល", en: "Parents / guardian" },
    fields: [
      { key: "father_name", type: "text", km: "ឪពុកឈ្មោះ", en: "Father's name", half: true, max: 120 },
      { key: "father_age", type: "number", km: "អាយុឪពុក", en: "Father's age", half: true, max: 3 },
      { key: "father_job", type: "text", km: "មុខរបរឪពុក", en: "Father's occupation", half: true, max: 120 },
      { key: "father_income", type: "text", km: "ចំណូលឪពុក (ក្នុងមួយខែ)", en: "Father's monthly income", half: true, max: 60, placeholder: "e.g. 500,000 រៀល" },
      { key: "mother_name", type: "text", km: "ម្តាយឈ្មោះ", en: "Mother's name", half: true, max: 120 },
      { key: "mother_age", type: "number", km: "អាយុម្តាយ", en: "Mother's age", half: true, max: 3 },
      { key: "mother_job", type: "text", km: "មុខរបរម្តាយ", en: "Mother's occupation", half: true, max: 120 },
      { key: "mother_income", type: "text", km: "ចំណូលម្តាយ (ក្នុងមួយខែ)", en: "Mother's monthly income", half: true, max: 60, placeholder: "e.g. 500,000 រៀល" },
      { key: "parents_phone", type: "tel", km: "លេខទូរស័ព្ទឪពុកម្តាយ", en: "Parents' phone", half: true, max: 30 },
      { key: "family_size", type: "number", km: "ទំហំគ្រួសារ (ចំនួនសមាជិក)", en: "Family size (members)", half: true, max: 2 },
      { key: "child_order", type: "number", km: "ជាកូនទី", en: "You are child number", half: true, max: 2 },
      { key: "siblings_count", type: "number", km: "ក្នុងចំណោមបងប្អូនបង្កើតចំនួន (នាក់)", en: "Out of how many siblings", half: true, max: 2 },
      {
        key: "income_band",
        type: "radio",
        km: "សូមប៉ាន់ស្មានប្រាក់ចំណូលក្នុងមួយខែក្នុងគ្រួសាររបស់អ្នក",
        en: "Estimated monthly income of your family",
        options: [
          { value: "lt_400k", km: "ក្រោម ៤០០,០០០ រៀល", en: "Under 400,000 riel" },
          { value: "400k_800k", km: "៤០០,០០០–៨០០,០០០ រៀល", en: "400,000–800,000 riel" },
          { value: "800k_1200k", km: "៨០០,០០០–១,២០០,០០០ រៀល", en: "800,000–1,200,000 riel" },
          { value: "gt_1200k", km: "លើស ១,២០០,០០០ រៀល", en: "Over 1,200,000 riel" },
        ],
      },
      {
        key: "housing_tenure",
        type: "radio",
        km: "ស្ថានភាពផ្ទះស្នាក់នៅ",
        en: "Housing",
        half: true,
        options: [
          { value: "own", km: "ផ្ទះផ្ទាល់ខ្លួន", en: "Own house" },
          { value: "rent", km: "ផ្ទះជួល", en: "Rented" },
          { value: "relatives", km: "ស្នាក់នៅជាមួយសាច់ញាតិ", en: "With relatives" },
        ],
      },
      {
        key: "housing_type",
        type: "radio",
        km: "ប្រភេទផ្ទះ",
        en: "Type of house",
        half: true,
        options: [
          { value: "brick", km: "ផ្ទះថ្ម", en: "Brick / concrete" },
          { value: "wood", km: "ផ្ទះឈើ", en: "Wooden" },
          { value: "thatch", km: "ផ្ទះស្លឹក", en: "Thatch (leaves)" },
        ],
      },
    ],
  },
  {
    id: "equity",
    km: "ផ្នែក ៣៖ សន្ទស្សន៍សមធម៌សង្គម",
    en: "Part 3: Social equity",
    fields: [
      {
        key: "area",
        type: "radio",
        km: "១. តើអ្នករស់នៅតំបន់ជនបទ ឬ តំបន់ប្រជុំជន?",
        en: "1. Do you live in a rural or an urban area?",
        options: [
          { value: "rural", km: "ជនបទ", en: "Rural" },
          { value: "urban", km: "ប្រជុំជន", en: "Urban" },
        ],
      },
      {
        key: "parents_support",
        type: "radio",
        km: "២. តើឪពុកម្តាយរបស់អ្នកនឹងមានថវិកាជួយផ្គត់ផ្គង់អោយអ្នករៀនបន្តថ្នាក់ឧត្តមសិក្សាដែរឬទេ?",
        en: "2. Can your parents afford to support your university studies?",
        options: [
          { value: "yes", km: "មាន", en: "Yes" },
          { value: "no", km: "គ្មាន", en: "No" },
        ],
      },
      {
        key: "parents_support_major",
        type: "text",
        km: "ប្រសិនបើមាន តើអ្នកនឹងរៀនជំនាញអ្វី?",
        en: "If yes, what would you study?",
        showIf: { key: "parents_support", equals: "yes" },
        max: 200,
      },
      {
        key: "equity_card",
        type: "radio",
        km: "៣. តើគ្រួសាររបស់អ្នកមានឬបានចុះបញ្ជីក្នុងកម្មវិធីបណ្ណសមធម៌ដែរឬទេ?",
        en: "3. Is your family registered for an Equity Card (IDPoor)?",
        options: [
          { value: "level1", km: "បានចុះ កម្រិត១", en: "Yes, level 1" },
          { value: "level2", km: "បានចុះ កម្រិត២", en: "Yes, level 2" },
          { value: "no", km: "ទេ", en: "No" },
        ],
      },
      {
        key: "family_problems",
        type: "checks",
        km: "៤. តើគ្រួសាររបស់អ្នកមានបញ្ហាណាមួយដូចជា៖",
        en: "4. Does your family have any of these problems?",
        options: [
          { value: "unemployment", km: "អត់ការងារ", en: "Unemployment" },
          { value: "illness", km: "ជំងឺធ្ងន់", en: "Serious illness" },
          { value: "disability", km: "អ្នកមានពិការភាពក្នុងគ្រួសារ", en: "Disability in the family" },
          { value: "single_parent", km: "គ្រួសារម្តាយឬឪពុកតែម្នាក់", en: "Single-parent family" },
          { value: "none", km: "គ្មាន", en: "None" },
        ],
      },
      {
        key: "family_problems_detail",
        type: "textarea",
        km: "ប្រសិនបើមាន សូមពិពណ៌នា",
        en: "If yes, please describe",
        showIf: { key: "family_problems", includesOtherThan: "none" },
        max: 1000,
      },
      { key: "study_interrupted", type: "radio", km: "៥. តើអ្នកធ្លាប់ផ្អាកការសិក្សាជាបណ្តោះអាសន្នទេ?", en: "5. Have you ever stopped your studies for a while?", options: yesNo },
      {
        key: "study_interrupted_reason",
        type: "text",
        km: "បើធ្លាប់ ដោយសារមូលហេតុអ្វី?",
        en: "If yes, why?",
        showIf: { key: "study_interrupted", equals: "yes" },
        max: 300,
      },
      {
        key: "study_obstacles",
        type: "checks",
        km: "៦. តើបញ្ហាណាដែលមានឥទ្ធិពលលើការសិក្សារបស់អ្នក? (សូមជ្រើសរើសគ្រប់ប្រភេទដែលមាន)",
        en: "6. Which problems affect your studies? (choose all that apply)",
        options: [
          { value: "no_materials", km: "គ្មានសម្ភារៈសិក្សា", en: "No study materials" },
          { value: "work_for_family", km: "ត្រូវបម្រើការងារដើម្បីគ្រួសារ", en: "Must work for the family" },
          { value: "lack_money", km: "ខ្វះថវិកា", en: "Not enough money" },
          { value: "no_electricity", km: "គ្មានអគ្គិសនី", en: "No electricity" },
          { value: "care_family", km: "ត្រូវថែទាំគ្រួសារ", en: "Must care for family" },
          { value: "other", km: "ផ្សេងៗ", en: "Other" },
        ],
      },
      {
        key: "study_obstacles_other",
        type: "text",
        km: "ផ្សេងៗ (សូមបញ្ជាក់)",
        en: "Other (please specify)",
        showIf: { key: "study_obstacles", includes: "other" },
        max: 300,
      },
      {
        key: "first_generation",
        type: "radio",
        km: "៧. តើអ្នកជាមនុស្សដំបូងក្នុងគ្រួសាររបស់អ្នកដែលរំពឹងថានឹងបញ្ចប់ថ្នាក់ទី១២ ឬ សាកលវិទ្យាល័យមែនទេ?",
        en: "7. Are you the first in your family expected to finish grade 12 or university?",
        options: yesNo,
      },
      {
        key: "discrimination",
        type: "radio",
        km: "៨. តើអ្នកប្រឈមមុខការរើសអើងនៅក្នុងសង្គម ឬសហគមន៍ ដែលមានឥទ្ធិពលលើការសិក្សារបស់អ្នកដែរទេ?",
        en: "8. Do you face discrimination in society or your community that affects your studies?",
        options: yesNo,
      },
      {
        key: "discrimination_detail",
        type: "textarea",
        km: "ប្រសិនបើមាន សូមពិពណ៌នា",
        en: "If yes, please describe",
        showIf: { key: "discrimination", equals: "yes" },
        max: 1000,
      },
    ],
  },
  {
    id: "education",
    km: "ផ្នែក ៤៖ ព័ត៌មានអប់រំ",
    en: "Part 4: Education",
    fields: [
      { key: "high_school", type: "text", km: "ជាសិស្សនៃវិទ្យាល័យ", en: "High school", required: true, max: 200 },
      { key: "grade", type: "text", km: "ថ្នាក់ទី", en: "Grade", half: true, max: 20, placeholder: "12" },
      { key: "school_year", type: "text", km: "ឆ្នាំសិក្សា", en: "School year", half: true, max: 20, placeholder: "2026-2027" },
      { key: "school_track", type: "text", km: "ផ្នែក", en: "Track", half: true, max: 60, placeholder: "វិទ្យាសាស្ត្រ / សង្គម" },
      { key: "semester1_result", type: "text", km: "លទ្ធផលសិក្សាឆមាសទី១", en: "Semester 1 result", half: true, max: 60 },
      { key: "favorite_subjects", type: "text", km: "មុខវិជ្ជាដែលចូលចិត្ត", en: "Favorite subjects", max: 200 },
    ],
  },
  {
    id: "motivation",
    km: "ផ្នែក ៥៖ ការលើកទឹកចិត្ត",
    en: "Part 5: Motivation",
    fields: [
      {
        key: "desired_majors",
        type: "checks",
        km: "តើជំនាញអ្វីដែលអ្នកចង់បន្តការសិក្សានៅថ្នាក់ឧត្តមសិក្សា (រៀននៅមហាវិទ្យាល័យ)?",
        en: "Which major would you like to study at university?",
        options: [
          { value: "economics", km: "ជំនាញសេដ្ឋកិច្ច", en: "Economics" },
          { value: "banking_finance", km: "ជំនាញធនាគារនិងហិរញ្ញវត្ថុ", en: "Banking and finance" },
          { value: "marketing", km: "ជំនាញទីផ្សារ", en: "Marketing" },
          { value: "architecture", km: "ជំនាញស្ថាបត្យកម្ម", en: "Architecture" },
          { value: "computer", km: "ជំនាញកុំព្យូទ័រ", en: "Computer science" },
          { value: "english", km: "ជំនាញអក្សរសាស្ត្រអង់គ្លេស", en: "English literature" },
          { value: "agriculture", km: "ជំនាញកសិកម្ម", en: "Agriculture" },
          { value: "hospitality", km: "ជំនាញសណ្ឋាគារ", en: "Hotel and hospitality" },
          { value: "public_admin", km: "ជំនាញរដ្ឋបាលសាធារណៈ", en: "Public administration" },
          { value: "other", km: "ផ្សេងៗ", en: "Other" },
        ],
      },
      {
        key: "desired_major_other",
        type: "text",
        km: "ជំនាញផ្សេងៗ (សូមបញ្ជាក់)",
        en: "Other major (please specify)",
        showIf: { key: "desired_majors", includes: "other" },
        max: 200,
      },
      {
        key: "scholarship_impact",
        type: "textarea",
        km: "តើអាហារូបករណ៍នេះនឹងជួយអ្នកដោះស្រាយបញ្ហាដែលទាក់ទងនឹងសង្គមឬសេដ្ឋកិច្ចរបស់អ្នកយ៉ាងដូចម្តេច?",
        en: "How will this scholarship help you with your social or economic problems?",
        max: 2000,
      },
    ],
  },
];

/** Part 6 — the documents the paper form asks to attach (uploaded as files). */
export const DOCUMENTS_TO_ATTACH: Option[] = [
  { value: "home_map", km: "ផែនទីពីសាលាទៅផ្ទះគូរដោយដៃមួយសន្លឹក", en: "Hand-drawn map from school to your home" },
  { value: "family_book", km: "សៀវភៅគ្រួសារ / សៀវភៅស្នាក់នៅ", en: "Family book / residence book" },
  { value: "equity_card", km: "បណ្ណសមធម៌ (ប្រសិនបើមាន)", en: "Equity card (if you have one)" },
];

export const DECLARATION = {
  key: "declaration",
  km: "ខ្ញុំសូមធានាថាព័ត៌មានទាំងអស់ខាងលើដែលបានផ្តល់ក្នុងពាក្យស្នើរសុំនេះគឺពិតប្រាកដ និងត្រឹមត្រូវ។",
  en: "I confirm that all the information in this application is true and correct.",
};

export const MAX_ATTACHMENTS = 5;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const ALL_FIELDS: Field[] = SECTIONS.flatMap((s) => s.fields);

/** Whether a field is shown for these answers (its showIf condition holds). */
export function isShown(f: Field, a: Answers): boolean {
  if (!f.showIf) return true;
  const v = a[f.showIf.key];
  if (f.showIf.equals !== undefined) return v === f.showIf.equals;
  const list = Array.isArray(v) ? v : [];
  if (f.showIf.includes !== undefined) return list.includes(f.showIf.includes);
  if (f.showIf.includesOtherThan !== undefined) return list.some((x) => x !== f.showIf!.includesOtherThan);
  return true;
}

export function isEmpty(v: Answers[string] | undefined): boolean {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

/** Keys of required (and shown) fields that are still empty. */
export function missingRequired(a: Answers): Field[] {
  return ALL_FIELDS.filter((f) => f.required && isShown(f, a) && isEmpty(typeof a[f.key] === "string" ? (a[f.key] as string).trim() : a[f.key]));
}

/** The answers to save: trimmed, hidden follow-ups dropped, only known keys. */
export function cleanAnswers(a: Answers): Answers {
  const out: Answers = {};
  for (const f of ALL_FIELDS) {
    if (!isShown(f, a)) continue;
    const v = a[f.key];
    if (isEmpty(v)) continue;
    out[f.key] = typeof v === "string" ? v.trim().slice(0, f.max ?? 2000) : v;
  }
  if (a[DECLARATION.key] === true) out[DECLARATION.key] = true;
  return out;
}

/** Display text of one answer ("—" when empty), English labels with Khmer kept for free text. */
export function answerText(f: Field, v: Answers[string] | undefined): string {
  if (isEmpty(v)) return "—";
  if (f.options) {
    const label = (x: string) => f.options!.find((o) => o.value === x)?.en ?? x;
    return Array.isArray(v) ? v.map(label).join(", ") : label(String(v));
  }
  return String(v);
}
