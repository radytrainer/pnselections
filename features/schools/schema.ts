import { z } from "zod";

export const schoolFormSchema = z.object({
  school_name: z.string().min(1, "School name is required"),
  logo_url: z.string().optional().or(z.literal("")),
  principal_name: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email("Enter a valid email address").optional().or(z.literal("")),
  province_id: z.string().uuid().optional().or(z.literal("")),
  district_name: z.string().optional().or(z.literal("")),
});

export type SchoolFormValues = z.infer<typeof schoolFormSchema>;
