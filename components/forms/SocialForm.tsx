"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  CreditCard,
  GraduationCap,
  HeartPulse,
  Home as HomeIcon,
  ListChecks,
  Package,
  ShieldAlert,
  Users,
  Wallet,
  Wheat,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { socialFormSchema, type SocialFormValues } from "@/features/social-form/schema";
import {
  CATEGORY_BADGE_CLASSES,
  CATEGORY_LABELS,
  computeSocialFormScore,
  computeVacScore,
  FAILED_HOME_VISIT_THRESHOLD,
  isFailedHomeVisit,
  VAC_CATEGORIES,
  VAC_TIER_BADGE_CLASSES,
  VAC_TIER_LABELS,
} from "@/features/social-form/scoring";
import {
  ACADEMIC_OPTS,
  ASSET_OPTS,
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
  FATHER_OCCUPATION_OPTS,
  PARENT_OCCUPATION_OPTS,
  SCHOOL_ATTENDANCE_OPTS,
  VULNERABILITY_OPTS,
  WATER_ACCESS_OPTS,
  labelFor,
} from "@/features/social-form/labels";
import { ChoiceGroup } from "@/components/forms/ChoiceGroup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { cn } from "@/lib/utils";

const STEPS: { title: string; icon: LucideIcon }[] = [
  { title: "Health & Academic", icon: HeartPulse },
  { title: "Household Profile", icon: Users },
  { title: "Housing & Utilities", icon: HomeIcon },
  { title: "Household Assets", icon: Package },
  { title: "Income & Expenses", icon: Wallet },
  { title: "Education Background", icon: GraduationCap },
  { title: "Debt", icon: CreditCard },
  { title: "Farming & Plantation", icon: Wheat },
  { title: "Vulnerability & Husbandry", icon: ShieldAlert },
  { title: "Vulnerability Checklist", icon: ListChecks },
  { title: "Summary", icon: ClipboardCheck },
];

/** Band fields that count toward each step's "answered" progress dot. Free-text notes and the always-defaulted asset ranks aren't required, so they're left out. */
const STEP_FIELDS: (keyof SocialFormValues)[][] = [
  ["gender", "health_status", "academic_rank"],
  ["household_size_band", "dependents_band", "father_occupation_band", "mother_occupation_band"],
  ["housing_type_band", "house_status_band", "water_access_band", "electricity_access_band"],
  [],
  ["income_band", "expenses_band", "education_support_band"],
  ["father_education_band", "mother_education_band", "school_attendance_band"],
  ["debt_band"],
  ["farm_land_band", "farm_income_band", "plantation_land_band", "plantation_income_band"],
  ["husbandry_band"],
  VAC_CATEGORIES.map((c) => c.field),
  [],
];

function SectionHeading({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <Icon className="size-4 text-primary" />
      <p className="text-sm font-medium">{title}</p>
      {hint && <span className="text-xs text-muted-foreground">({hint})</span>}
    </div>
  );
}

const DEFAULT_VALUES: SocialFormValues = {
  age: "",
  ok_to_join_training: "",
  academic_note: "",
  household_size_note: "",
  dependents_note: "",
  father_age: "",
  father_job: "",
  father_income: "",
  mother_age: "",
  mother_job: "",
  mother_income: "",
  child1_income: "",
  child2_income: "",
  child3_income: "",
  house_owner: "",
  assets_furniture: 0,
  assets_furniture_note: "",
  assets_transport: 0,
  assets_transport_note: "",
  assets_electronics: 0,
  assets_electronics_note: "",
  assets_livestock: 0,
  assets_livestock_note: "",
  income_note: "",
  expenses_note: "",
  education_support_note: "",
  school_aged_children_studying: "",
  school_aged_children_working: "",
  debt_amount: "",
  debt_note: "",
  farm_land_note: "",
  vulnerability_orphan_single_parent: false,
  vulnerability_disability: false,
  vulnerability_chronic_illness: false,
  vulnerability_debt_burden: false,
  vulnerability_landless: false,
  vulnerability_note: "",
  husbandry_note: "",
  manual_failed: false,
  poverty_certificate: "",
  distance_from_town: "",
  visitor_name: "",
  visitor_comments: "",
};

function draftKey(studentId: string) {
  return `social-form-draft-${studentId}`;
}

export function SocialForm({
  studentId,
  defaultValues,
  visitorName,
  onSubmit,
}: {
  studentId: string;
  defaultValues?: Partial<SocialFormValues>;
  /** Logged-in user's name — prefilled as visitor_name on a brand-new entry only; editable, and a saved entry keeps its own recorded name. */
  visitorName: string;
  onSubmit: (values: SocialFormValues) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditingExisting = !!defaultValues;

  const form = useForm<SocialFormValues>({
    resolver: zodResolver(socialFormSchema),
    // A saved visit keeps whoever actually recorded it; only a brand-new
    // entry defaults to the logged-in user's name, and it stays editable
    // either way so a mistaken/blank name can be corrected later.
    defaultValues: { ...DEFAULT_VALUES, ...defaultValues, visitor_name: defaultValues?.visitor_name || visitorName },
  });

  useEffect(() => {
    if (isEditingExisting) return;
    form.setValue("visitor_name", visitorName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitorName]);

  // Recover an in-progress draft on a brand-new entry only — editing an
  // existing saved assessment trusts the server data, not a possibly-stale
  // local draft from a previous abandoned attempt.
  useEffect(() => {
    if (isEditingExisting) return;
    const raw = localStorage.getItem(draftKey(studentId));
    if (!raw) return;
    try {
      form.reset(JSON.parse(raw));
    } catch {
      // corrupt draft — ignore and start fresh
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const values = form.watch();
  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem(draftKey(studentId), JSON.stringify(values));
    }, 500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(values)]);

  const score = useMemo(() => computeSocialFormScore(values), [values]);
  const vacScore = useMemo(() => computeVacScore(values), [values]);
  const failedHomeVisit = isFailedHomeVisit(score.finalScore, values.manual_failed);

  const stepProgress = useMemo(
    () =>
      STEP_FIELDS.map((fields) => {
        if (fields.length === 0) return null;
        const answered = fields.filter((f) => {
          const v = values[f];
          return v !== undefined && v !== null && v !== "";
        }).length;
        return { answered, total: fields.length };
      }),
    [values],
  );

  async function handleSubmit(submitted: SocialFormValues) {
    setIsSubmitting(true);
    try {
      await onSubmit(submitted);
      localStorage.removeItem(draftKey(studentId));
    } finally {
      setIsSubmitting(false);
    }
  }

  const isLastStep = step === STEPS.length - 1;
  const CurrentIcon = STEPS[step].icon;

  const reviewSections: { step: number; title: string; icon: LucideIcon; rows: { label: string; value: string }[] }[] = [
    {
      step: 0,
      title: "Health & Academic",
      icon: HeartPulse,
      rows: [
        { label: "Gender", value: values.gender ? values.gender === "lgbtqia+" ? "LGBTQIA+" : values.gender.charAt(0).toUpperCase() + values.gender.slice(1) : "" },
        { label: "Age", value: values.age ?? "" },
        { label: "Health", value: labelFor(HEALTH_OPTS, values.health_status) ?? "" },
        { label: "Academic Performance", value: labelFor(ACADEMIC_OPTS, values.academic_rank) ?? "" },
        { label: "Academic Notes", value: values.academic_note ?? "" },
        { label: "Major", value: labelFor(MAJOR_OPTS, values.major) ?? "" },
      ].filter((r) => r.value),
    },
    {
      step: 1,
      title: "Household Profile",
      icon: Users,
      rows: [
        { label: "Household Size", value: labelFor(HOUSEHOLD_SIZE_OPTS, values.household_size_band) ?? "" },
        { label: "Dependents", value: labelFor(DEPENDENTS_OPTS, values.dependents_band) ?? "" },
        { label: "Father's Occupation", value: labelFor(FATHER_OCCUPATION_OPTS, values.father_occupation_band) ?? "" },
        { label: "Mother's Occupation", value: labelFor(PARENT_OCCUPATION_OPTS, values.mother_occupation_band) ?? "" },
        { label: "Father", value: [values.father_age, values.father_job, values.father_income].filter(Boolean).join(" · ") },
        { label: "Mother", value: [values.mother_age, values.mother_job, values.mother_income].filter(Boolean).join(" · ") },
        {
          label: "Children's Income",
          value: [values.child1_income, values.child2_income, values.child3_income].filter(Boolean).join(" · "),
        },
      ].filter((r) => r.value),
    },
    {
      step: 2,
      title: "Housing & Utilities",
      icon: HomeIcon,
      rows: [
        { label: "Housing Type", value: labelFor(HOUSING_TYPE_OPTS, values.housing_type_band) ?? "" },
        { label: "House Status", value: labelFor(HOUSE_STATUS_OPTS, values.house_status_band) ?? "" },
        { label: "Water Access", value: labelFor(WATER_ACCESS_OPTS, values.water_access_band) ?? "" },
        { label: "Electricity", value: labelFor(ELECTRICITY_OPTS, values.electricity_access_band) ?? "" },
      ].filter((r) => r.value),
    },
    {
      step: 3,
      title: "Household Assets",
      icon: Package,
      rows: [
        { label: "Furniture", value: ASSET_RANK_LABELS[values.assets_furniture] },
        { label: "Transport", value: ASSET_RANK_LABELS[values.assets_transport] },
        { label: "Electronics", value: ASSET_RANK_LABELS[values.assets_electronics] },
        { label: "Livestock", value: ASSET_RANK_LABELS[values.assets_livestock] },
      ],
    },
    {
      step: 4,
      title: "Income & Expenses",
      icon: Wallet,
      rows: [
        { label: "Monthly Income", value: labelFor(INCOME_OPTS, values.income_band) ?? "" },
        { label: "Monthly Expenses", value: labelFor(EXPENSES_OPTS, values.expenses_band) ?? "" },
        { label: "Can Support Education", value: labelFor(EDUCATION_SUPPORT_OPTS, values.education_support_band) ?? "" },
      ].filter((r) => r.value),
    },
    {
      step: 5,
      title: "Education Background",
      icon: GraduationCap,
      rows: [
        { label: "Father's Education", value: labelFor(PARENT_EDUCATION_OPTS, values.father_education_band) ?? "" },
        { label: "Mother's Education", value: labelFor(PARENT_EDUCATION_OPTS, values.mother_education_band) ?? "" },
        { label: "School Attendance", value: labelFor(SCHOOL_ATTENDANCE_OPTS, values.school_attendance_band) ?? "" },
      ].filter((r) => r.value),
    },
    {
      step: 6,
      title: "Debt",
      icon: CreditCard,
      rows: [
        { label: "Debt Status", value: labelFor(DEBT_OPTS, values.debt_band) ?? "" },
        { label: "Amount", value: values.debt_amount ?? "" },
        { label: "Reason", value: values.debt_note ?? "" },
      ].filter((r) => r.value),
    },
    {
      step: 7,
      title: "Farming & Plantation",
      icon: Wheat,
      rows: [
        { label: "Farm Land", value: labelFor(LAND_OPTS, values.farm_land_band) ?? "" },
        { label: "Farm Income", value: labelFor(INCOME_CONTRIBUTION_OPTS, values.farm_income_band) ?? "" },
        { label: "Plantation Land", value: labelFor(LAND_OPTS, values.plantation_land_band) ?? "" },
        { label: "Plantation Income", value: labelFor(INCOME_CONTRIBUTION_OPTS, values.plantation_income_band) ?? "" },
      ].filter((r) => r.value),
    },
    {
      step: 8,
      title: "Vulnerability & Husbandry",
      icon: ShieldAlert,
      rows: [
        {
          label: "Vulnerabilities",
          value: VULNERABILITY_OPTS.filter((v) => values[v.name])
            .map((v) => v.label)
            .join(", "),
        },
        { label: "Husbandry", value: labelFor(HUSBANDRY_OPTS, values.husbandry_band) ?? "" },
      ].filter((r) => r.value),
    },
    {
      step: 9,
      title: "Vulnerability Checklist",
      icon: ListChecks,
      rows: VAC_CATEGORIES.map((c) => ({
        label: c.label,
        value: c.options.find((o) => o.value === values[c.field])?.label ?? "",
      })).filter((r) => r.value),
    },
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5 pb-20">
        <div className="sticky top-0 z-10 -mx-4 space-y-2 border-b bg-background px-4 py-2.5 sm:-mx-0 sm:rounded-md sm:border">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CurrentIcon className="size-4 text-primary" />
              <span className="text-sm font-medium">{STEPS[step].title}</span>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium",
                failedHomeVisit ? "bg-red-100 text-red-700" : CATEGORY_BADGE_CLASSES[score.category],
              )}
            >
              {score.finalScore} pts · {failedHomeVisit ? "Failed Home Visit" : CATEGORY_LABELS[score.category]}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-primary transition-all"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <div className="scrollbar-hide -mx-1 flex gap-1 overflow-x-auto pb-0.5">
            {STEPS.map((s, i) => {
              const progress = stepProgress[i];
              const isDone = progress ? progress.answered === progress.total : null;
              const isPartial = progress ? progress.answered > 0 && progress.answered < progress.total : false;
              const StepIcon = s.icon;
              return (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => setStep(i)}
                  aria-label={`Go to step ${i + 1}: ${s.title}`}
                  className={cn(
                    "relative flex shrink-0 items-center justify-center rounded-full p-2 transition-colors",
                    i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
                  )}
                >
                  <StepIcon className="size-4" />
                  {isDone && (
                    <span className="absolute -right-0.5 -top-0.5 flex size-3 items-center justify-center rounded-full bg-green-600 text-white">
                      <Check className="size-2" strokeWidth={4} />
                    </span>
                  )}
                  {isPartial && (
                    <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-amber-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {step === 0 && (
          <div className="space-y-5">
            <div>
              <SectionHeading icon={Users} title="Gender" />
              <ChoiceGroup
                value={form.watch("gender")}
                onChange={(v) => form.setValue("gender", v as SocialFormValues["gender"])}
                options={[
                  { value: "female", label: "Female", points: 0 },
                  { value: "male", label: "Male", points: 0 },
                  { value: "lgbtqia+", label: "LGBTQIA+", points: 0 },
                ]}
              />
            </div>
            <FormField
              control={form.control}
              name="age"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Age</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" className="max-w-32" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div>
              <SectionHeading icon={HeartPulse} title="Health" />
              <ChoiceGroup
                layout="grid"
                value={form.watch("health_status")}
                onChange={(v) => form.setValue("health_status", v)}
                options={HEALTH_OPTS}
              />
            </div>
            <FormField
              control={form.control}
              name="ok_to_join_training"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>OK to join the training?</FormLabel>
                  <FormControl>
                    <Input placeholder="Notes if a health condition affects training" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div>
              <SectionHeading icon={GraduationCap} title="Academic Performance" />
              <ChoiceGroup
                value={form.watch("academic_rank")}
                onChange={(v) => form.setValue("academic_rank", v)}
                options={ACADEMIC_OPTS}
              />
              <FormField
                control={form.control}
                name="academic_note"
                render={({ field }) => (
                  <FormItem className="mt-2">
                    <FormControl>
                      <Textarea rows={3} placeholder="Comment..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div>
              <SectionHeading icon={GraduationCap} title="Major" />
              <ChoiceGroup
                layout="grid"
                value={form.watch("major")}
                onChange={(v) => form.setValue("major", v)}
                options={MAJOR_OPTS}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <SectionHeading icon={Users} title="Household Size" />
              <ChoiceGroup
                layout="grid"
                value={form.watch("household_size_band")}
                onChange={(v) => form.setValue("household_size_band", v)}
                options={HOUSEHOLD_SIZE_OPTS}
              />
              <FormField
                control={form.control}
                name="household_size_note"
                render={({ field }) => (
                  <FormItem className="mt-2">
                    <FormControl>
                      <Input placeholder="Specify..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div>
              <SectionHeading icon={Users} title="Dependents" hint="children/elderly/disabled" />
              <ChoiceGroup
                layout="grid"
                value={form.watch("dependents_band")}
                onChange={(v) => form.setValue("dependents_band", v)}
                options={DEPENDENTS_OPTS}
              />
              <FormField
                control={form.control}
                name="dependents_note"
                render={({ field }) => (
                  <FormItem className="mt-2">
                    <FormControl>
                      <Input placeholder="Specify..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="father_age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Father&apos;s Age</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="father_job"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Father&apos;s Job</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mother_age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mother&apos;s Age</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mother_job"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mother&apos;s Job</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="father_income"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Father&apos;s Salary/Income</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mother_income"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mother&apos;s Salary/Income</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="child1_income"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Child 1 Income</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="child2_income"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Child 2 Income</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="child3_income"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Child 3 Income</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div>
              <SectionHeading icon={Wallet} title="Father's Occupation" />
              <ChoiceGroup
                layout="grid"
                value={form.watch("father_occupation_band")}
                onChange={(v) => form.setValue("father_occupation_band", v)}
                options={FATHER_OCCUPATION_OPTS}
              />
            </div>
            <div>
              <SectionHeading icon={Wallet} title="Mother's Occupation" />
              <ChoiceGroup
                layout="grid"
                value={form.watch("mother_occupation_band")}
                onChange={(v) => form.setValue("mother_occupation_band", v)}
                options={PARENT_OCCUPATION_OPTS}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <FormField
              control={form.control}
              name="house_owner"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>House Owner</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div>
              <SectionHeading icon={HomeIcon} title="Type of Housing" />
              <ChoiceGroup
                value={form.watch("housing_type_band")}
                onChange={(v) => form.setValue("housing_type_band", v)}
                options={HOUSING_TYPE_OPTS}
              />
            </div>
            <div>
              <SectionHeading icon={HomeIcon} title="Status of the House" />
              <ChoiceGroup
                value={form.watch("house_status_band")}
                onChange={(v) => form.setValue("house_status_band", v)}
                options={HOUSE_STATUS_OPTS}
              />
            </div>
            <div>
              <SectionHeading icon={HomeIcon} title="Water Access" />
              <ChoiceGroup
                value={form.watch("water_access_band")}
                onChange={(v) => form.setValue("water_access_band", v)}
                options={WATER_ACCESS_OPTS}
              />
            </div>
            <div>
              <SectionHeading icon={HomeIcon} title="Electricity Access" />
              <ChoiceGroup
                layout="grid"
                value={form.watch("electricity_access_band")}
                onChange={(v) => form.setValue("electricity_access_band", v)}
                options={ELECTRICITY_OPTS}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            {(
              [
                ["assets_furniture", "assets_furniture_note", "Furniture (bed, table, chairs)"],
                ["assets_transport", "assets_transport_note", "Transport (bicycle, motorbike, car)"],
                ["assets_electronics", "assets_electronics_note", "Electronics (radio, TV, phone, computer)"],
                ["assets_livestock", "assets_livestock_note", "Livestock (chickens, cows, pigs)"],
              ] as const
            ).map(([name, noteName, label]) => (
              <div key={name}>
                <SectionHeading icon={Package} title={label} hint={ASSET_RANK_LABELS[form.watch(name)]} />
                <ChoiceGroup
                  layout="segmented"
                  value={form.watch(name)}
                  onChange={(v) => form.setValue(name, v)}
                  options={ASSET_OPTS}
                />
                <FormField
                  control={form.control}
                  name={noteName}
                  render={({ field }) => (
                    <FormItem className="mt-2">
                      <FormControl>
                        <Input placeholder="Comment..." {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div>
              <SectionHeading icon={Wallet} title="Household Income" hint="monthly" />
              <ChoiceGroup
                layout="segmented"
                value={form.watch("income_band")}
                onChange={(v) => form.setValue("income_band", v)}
                options={INCOME_OPTS}
              />
              <FormField
                control={form.control}
                name="income_note"
                render={({ field }) => (
                  <FormItem className="mt-2">
                    <FormControl>
                      <Input placeholder="Specify..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div>
              <SectionHeading icon={Wallet} title="Household Expenses" hint="monthly" />
              <ChoiceGroup
                layout="segmented"
                value={form.watch("expenses_band")}
                onChange={(v) => form.setValue("expenses_band", v)}
                options={EXPENSES_OPTS}
              />
              <FormField
                control={form.control}
                name="expenses_note"
                render={({ field }) => (
                  <FormItem className="mt-2">
                    <FormControl>
                      <Input placeholder="Specify..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div>
              <SectionHeading icon={GraduationCap} title="Can the family afford higher education without PNC?" />
              <ChoiceGroup
                layout="grid"
                value={form.watch("education_support_band")}
                onChange={(v) => form.setValue("education_support_band", v)}
                options={EDUCATION_SUPPORT_OPTS}
              />
              <FormField
                control={form.control}
                name="education_support_note"
                render={({ field }) => (
                  <FormItem className="mt-2">
                    <FormControl>
                      <Input placeholder="Notes..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <div>
              <SectionHeading icon={GraduationCap} title="Father's Education Level" />
              <ChoiceGroup
                layout="grid"
                value={form.watch("father_education_band")}
                onChange={(v) => form.setValue("father_education_band", v)}
                options={PARENT_EDUCATION_OPTS}
              />
            </div>
            <div>
              <SectionHeading icon={GraduationCap} title="Mother's Education Level" />
              <ChoiceGroup
                layout="grid"
                value={form.watch("mother_education_band")}
                onChange={(v) => form.setValue("mother_education_band", v)}
                options={PARENT_EDUCATION_OPTS}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="school_aged_children_studying"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Children Studying</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="school_aged_children_working"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Children Working</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div>
              <SectionHeading icon={GraduationCap} title="School Attendance" />
              <ChoiceGroup
                layout="grid"
                value={form.watch("school_attendance_band")}
                onChange={(v) => form.setValue("school_attendance_band", v)}
                options={SCHOOL_ATTENDANCE_OPTS}
              />
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-5">
            <div>
              <SectionHeading icon={CreditCard} title="Household Debt Status" />
              <ChoiceGroup
                value={form.watch("debt_band")}
                onChange={(v) => form.setValue("debt_band", v)}
                options={DEBT_OPTS}
              />
            </div>
            <FormField
              control={form.control}
              name="debt_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="debt_note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Debt</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Explain what caused the debt..." {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        )}

        {step === 7 && (
          <div className="space-y-5">
            <div>
              <SectionHeading icon={Wheat} title="Farming — Land Ownership" />
              <ChoiceGroup
                layout="grid"
                value={form.watch("farm_land_band")}
                onChange={(v) => form.setValue("farm_land_band", v)}
                options={LAND_OPTS}
              />
              <FormField
                control={form.control}
                name="farm_land_note"
                render={({ field }) => (
                  <FormItem className="mt-2">
                    <FormControl>
                      <Input placeholder="Comment..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div>
              <SectionHeading icon={Wheat} title="Farming — Income Contribution" />
              <ChoiceGroup
                layout="grid"
                value={form.watch("farm_income_band")}
                onChange={(v) => form.setValue("farm_income_band", v)}
                options={INCOME_CONTRIBUTION_OPTS}
              />
            </div>
            <div>
              <SectionHeading icon={Wheat} title="Plantation — Land Ownership" />
              <ChoiceGroup
                layout="grid"
                value={form.watch("plantation_land_band")}
                onChange={(v) => form.setValue("plantation_land_band", v)}
                options={LAND_OPTS}
              />
            </div>
            <div>
              <SectionHeading icon={Wheat} title="Plantation — Income Contribution" />
              <ChoiceGroup
                layout="grid"
                value={form.watch("plantation_income_band")}
                onChange={(v) => form.setValue("plantation_income_band", v)}
                options={INCOME_CONTRIBUTION_OPTS}
              />
            </div>
          </div>
        )}

        {step === 8 && (
          <div className="space-y-5">
            <div>
              <SectionHeading icon={ShieldAlert} title="Vulnerability Factors" hint="tick all that apply, −1 each" />
              <div className="grid grid-cols-2 gap-2">
                {VULNERABILITY_OPTS.map(({ name, label }) => {
                  const checked = form.watch(name) as boolean;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => form.setValue(name, !checked)}
                      aria-pressed={checked}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border-2 px-3 py-3 text-left text-sm transition-all active:scale-[0.98]",
                        checked
                          ? "border-destructive bg-destructive/10 font-medium"
                          : "border-border bg-background hover:border-destructive/40 hover:bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                          checked ? "border-destructive bg-destructive text-white" : "border-muted-foreground/30",
                        )}
                      >
                        {checked && <Check className="size-3.5" strokeWidth={3} />}
                      </span>
                      {label}
                    </button>
                  );
                })}
              </div>
              <FormField
                control={form.control}
                name="vulnerability_note"
                render={({ field }) => (
                  <FormItem className="mt-2">
                    <FormControl>
                      <Input placeholder="Comment..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div>
              <SectionHeading icon={ShieldAlert} title="Husbandry" />
              <ChoiceGroup
                value={form.watch("husbandry_band")}
                onChange={(v) => form.setValue("husbandry_band", v)}
                options={HUSBANDRY_OPTS}
              />
              <FormField
                control={form.control}
                name="husbandry_note"
                render={({ field }) => (
                  <FormItem className="mt-2">
                    <FormControl>
                      <Input placeholder="Comment..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        {step === 9 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Selection team evaluation — rate each category as it stands today.
              </p>
              <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", VAC_TIER_BADGE_CLASSES[vacScore.tier])}>
                {vacScore.totalScore}/36 · {VAC_TIER_LABELS[vacScore.tier]}
              </span>
            </div>
            {VAC_CATEGORIES.map((category, i) => (
              <div key={category.field}>
                <SectionHeading icon={ListChecks} title={`${i + 1}. ${category.label}`} />
                <ChoiceGroup
                  layout="list"
                  value={form.watch(category.field)}
                  onChange={(v) => form.setValue(category.field, v)}
                  options={category.options.map((o) => ({ value: o.value, label: o.label, points: o.value }))}
                />
              </div>
            ))}
          </div>
        )}

        {step === 10 && (
          <div className="space-y-5">
            <div
              className={cn(
                "rounded-xl border-2 p-4",
                failedHomeVisit ? "bg-red-100 text-red-700" : CATEGORY_BADGE_CLASSES[score.category],
                "border-current/20",
              )}
            >
              <p className="text-xs font-medium uppercase tracking-wide opacity-70">Final Assessment</p>
              <p className="mt-1 text-2xl font-semibold">
                {failedHomeVisit ? "Failed Home Visit" : CATEGORY_LABELS[score.category]}
              </p>
              <p className="mt-1 text-sm opacity-80">
                {score.totalScore} pts total − {score.vulnerabilityDeduction} vulnerability ={" "}
                <span className="font-medium">{score.finalScore} pts</span>
              </p>
              {failedHomeVisit && !values.manual_failed && (
                <p className="mt-1 text-sm opacity-80">
                  Score is {FAILED_HOME_VISIT_THRESHOLD}+ pts — household appears too well-off to qualify.
                </p>
              )}
              <button
                type="button"
                onClick={() => form.setValue("manual_failed", !values.manual_failed)}
                aria-pressed={!!values.manual_failed}
                className="mt-3 flex items-center gap-2 rounded-lg border-2 border-current/20 bg-background/50 px-3 py-2 text-left text-sm transition-colors hover:bg-background/80"
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                    values.manual_failed ? "border-destructive bg-destructive text-white" : "border-muted-foreground/30",
                  )}
                >
                  {values.manual_failed && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                Manually mark as Failed Home Visit (overrides the score-based result)
              </button>
            </div>

            <div className={cn("rounded-xl border-2 p-4", VAC_TIER_BADGE_CLASSES[vacScore.tier], "border-current/20")}>
              <p className="text-xs font-medium uppercase tracking-wide opacity-70">Vulnerability Checklist</p>
              <p className="mt-1 text-2xl font-semibold">{VAC_TIER_LABELS[vacScore.tier]}</p>
              <p className="mt-1 text-sm opacity-80">
                <span className="font-medium">{vacScore.totalScore}</span> / 36 pts across 12 categories
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Review your answers</p>
              {reviewSections.map((section) => (
                <div key={section.title} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <section.icon className="size-4 text-primary" />
                      {section.title}
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(section.step)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                  {section.rows.length === 0 ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">Not answered yet</p>
                  ) : (
                    <dl className="mt-1.5 space-y-1 text-xs">
                      {section.rows.map((row) => (
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

            <FormField
              control={form.control}
              name="poverty_certificate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Poverty Certificate?</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Yes, issued by commune" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="distance_from_town"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Distance from Town</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="visitor_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Home Visitor Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="visitor_comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comments</FormLabel>
                  <FormControl>
                    <Textarea rows={4} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        )}

        <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between border-t bg-background p-3 sm:sticky sm:rounded-md sm:border">
          <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Back
          </Button>
          {isLastStep ? (
            <Button key="submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Social Form"}
            </Button>
          ) : (
            <Button key="next" type="button" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              Next
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
