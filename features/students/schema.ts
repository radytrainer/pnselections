import { z } from "zod";

export const studentFormSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  gender: z.enum(["male", "female", "lgbtqia+"]),
  dob: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  photo_drive_url: z.string().optional().or(z.literal("")),

  province_id: z.string().uuid().optional().or(z.literal("")),
  district_name: z.string().optional().or(z.literal("")),
  commune_name: z.string().optional().or(z.literal("")),
  village_name: z.string().optional().or(z.literal("")),

  school_id: z.string().uuid().optional().or(z.literal("")),
  referred_by_ngo_id: z.string().uuid().optional().or(z.literal("")),
  information_session: z.string().optional().or(z.literal("")),
  exam_center: z.string().optional().or(z.literal("")),
  eligible_for_social_investigation: z.boolean(),

  father_name: z.string().optional().or(z.literal("")),
  mother_name: z.string().optional().or(z.literal("")),
  parent_occupation: z.string().optional().or(z.literal("")),
  family_income_monthly: z.string().optional().or(z.literal("")),
  siblings_count: z.string().optional().or(z.literal("")),
});

export type StudentFormValues = z.infer<typeof studentFormSchema>;
