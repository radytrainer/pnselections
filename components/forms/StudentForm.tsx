"use client";

import { useEffect, useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CheckIcon, User, X } from "lucide-react";
import { studentFormSchema, type StudentFormValues } from "@/features/students/schema";
import { listProvinces, listSchools } from "@/services/lookupService";
import { listNgos } from "@/services/ngoService";
import { compressImageFile, validateStudentPhotoFile, MAX_IMAGE_BYTES } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LookupOption = { id: string; name_en: string };

const GENDER_LABELS: Record<string, string> = {
  female: "Female",
  male: "Male",
  "lgbtqia+": "LGBTQIA+",
};

const STEPS = [
  {
    key: "personal",
    label: "Personal",
    description: "Who is this student?",
    fields: ["first_name", "last_name", "gender", "dob", "phone", "photo_drive_url"] as FieldPath<StudentFormValues>[],
  },
  {
    key: "location",
    label: "Location",
    description: "Where do they live?",
    fields: ["province_id", "district_name", "commune_name", "village_name"] as FieldPath<StudentFormValues>[],
  },
  {
    key: "academic",
    label: "Academic",
    description: "School and referral details",
    fields: [
      "school_id",
      "referred_by_ngo_id",
      "information_session",
      "exam_center",
      "eligible_for_social_investigation",
    ] as FieldPath<StudentFormValues>[],
  },
  {
    key: "family",
    label: "Family",
    description: "Household context",
    fields: [
      "father_name",
      "mother_name",
      "parent_occupation",
      "family_income_monthly",
      "siblings_count",
    ] as FieldPath<StudentFormValues>[],
  },
];

export function StudentForm({
  defaultValues,
  defaultPhotoUrl,
  onSubmit,
  submitLabel = "Save Student",
}: {
  defaultValues?: Partial<StudentFormValues>;
  /** Signed URL for the student's current photo, if editing one that already has one. */
  defaultPhotoUrl?: string | null;
  onSubmit: (values: StudentFormValues, photoFile: File | null) => Promise<void>;
  submitLabel?: string;
}) {
  const [provinces, setProvinces] = useState<LookupOption[]>([]);
  const [schools, setSchools] = useState<{ id: string; school_name: string }[]>([]);
  const [ngos, setNgos] = useState<{ id: string; organization_name: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(defaultPhotoUrl ?? null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  async function handlePhotoSelect(file: File | null) {
    if (!file) {
      setPhotoFile(null);
      setPhotoPreviewUrl(defaultPhotoUrl ?? null);
      return;
    }

    let finalFile = file;
    if (file.size > MAX_IMAGE_BYTES) {
      setIsProcessingPhoto(true);
      try {
        finalFile = await compressImageFile(file);
      } finally {
        setIsProcessingPhoto(false);
      }
    }

    const invalidReason = validateStudentPhotoFile(finalFile);
    if (invalidReason) {
      toast.error(invalidReason);
      return;
    }
    setPhotoFile(finalFile);
    setPhotoPreviewUrl(URL.createObjectURL(finalFile));
  }

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      gender: "female",
      dob: "",
      phone: "",
      photo_drive_url: "",
      province_id: "",
      district_name: "",
      commune_name: "",
      village_name: "",
      school_id: "",
      referred_by_ngo_id: "",
      information_session: "",
      exam_center: "",
      eligible_for_social_investigation: false,
      father_name: "",
      mother_name: "",
      parent_occupation: "",
      ...defaultValues,
    },
  });

  useEffect(() => {
    listProvinces().then(setProvinces).catch(() => toast.error("Failed to load provinces"));
    listSchools().then(setSchools).catch(() => toast.error("Failed to load schools"));
    listNgos().then(setNgos).catch(() => toast.error("Failed to load NGO partners"));
  }, []);

  async function handleSubmit(values: StudentFormValues) {
    setIsSubmitting(true);
    try {
      await onSubmit(values, photoFile);
    } catch (error) {
      // Some thrown errors are plain { message } objects rather than Error instances,
      // so `instanceof Error` alone would silently swallow
      // real DB errors (e.g. a unique constraint violation) behind this fallback.
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error && "message" in error
            ? String((error as { message: unknown }).message)
            : "Failed to save student";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function goToStep(target: number) {
    if (target <= step) {
      setStep(target);
      return;
    }
    // Advancing forward: validate every step up to (but not including) the target.
    for (let i = step; i < target; i++) {
      const valid = await form.trigger(STEPS[i].fields);
      if (!valid) {
        setStep(i);
        return;
      }
    }
    setStep(target);
  }

  const isLastStep = step === STEPS.length - 1;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <ol className="flex items-center">
          {STEPS.map((s, index) => (
            <li key={s.key} className={cn("flex items-center", index < STEPS.length - 1 && "flex-1")}>
              <button
                type="button"
                onClick={() => goToStep(index)}
                className="flex items-center gap-2 text-left"
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                    index < step
                      ? "border-primary bg-primary text-primary-foreground"
                      : index === step
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground",
                  )}
                >
                  {index < step ? <CheckIcon className="size-3.5" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-sm font-medium sm:inline",
                    index === step ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </button>
              {index < STEPS.length - 1 && (
                <div className={cn("mx-2 h-px flex-1", index < step ? "bg-primary" : "bg-border")} />
              )}
            </li>
          ))}
        </ol>

        <div>
          <h2 className="text-base font-semibold">{STEPS[step].label} Information</h2>
          <p className="text-sm text-muted-foreground">{STEPS[step].description}</p>
        </div>

        {step === 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-4 sm:col-span-2">
              {photoPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL / signed URL, not a static asset
                <img src={photoPreviewUrl} alt="" className="size-16 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="size-7" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <label
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "cursor-pointer",
                    isProcessingPhoto && "pointer-events-none opacity-50",
                  )}
                >
                  {isProcessingPhoto ? "Processing..." : photoPreviewUrl ? "Change Photo" : "Add Photo"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={isProcessingPhoto}
                    onChange={(e) => handlePhotoSelect(e.target.files?.[0] ?? null)}
                  />
                </label>
                {photoPreviewUrl && (
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => handlePhotoSelect(null)}>
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            </div>
            <FormField
              control={form.control}
              name="first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select value={field.value} onValueChange={(value) => field.onChange(value ?? "")}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select gender">
                          {(value: string) => GENDER_LABELS[value] ?? value}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="lgbtqia+">LGBTQIA+</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dob"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth (optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="012 345 678" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="photo_drive_url"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Photos (Google Drive Link)</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://drive.google.com/..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="province_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Province</FormLabel>
                  <Select value={field.value} onValueChange={(value) => field.onChange(value ?? "")}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select province">
                          {(value: string) => provinces.find((p) => p.id === value)?.name_en}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {provinces.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name_en}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="district_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>District</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Serei Saophoan" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="commune_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Commune</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Phnom Dei" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="village_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Village</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Chrey" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="school_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>School</FormLabel>
                  <Select value={field.value} onValueChange={(value) => field.onChange(value ?? "")}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select school">
                          {(value: string) => schools.find((s) => s.id === value)?.school_name}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {schools.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.school_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="referred_by_ngo_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Referring NGO</FormLabel>
                  <Select value={field.value} onValueChange={(value) => field.onChange(value ?? "")}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select NGO partner">
                          {(value: string) => ngos.find((n) => n.id === value)?.organization_name}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {ngos.map((n) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.organization_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="information_session"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Information Session</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. EDM" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="exam_center"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Exam Center</FormLabel>
                  <FormControl>
                    <Input placeholder="EDM - Banteaymeanchey" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="eligible_for_social_investigation"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 sm:col-span-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="font-normal">Eligible for Social Investigation</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="father_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Father&apos;s Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="mother_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mother&apos;s Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parent_occupation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent Occupation</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="family_income_monthly"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Family Monthly Income (USD)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="siblings_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of Siblings</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <div className="flex items-center justify-between border-t pt-4">
          <Button type="button" variant="outline" onClick={() => goToStep(step - 1)} disabled={step === 0}>
            Back
          </Button>
          {isLastStep ? (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : submitLabel}
            </Button>
          ) : (
            <Button type="button" onClick={() => goToStep(step + 1)}>
              Next
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
