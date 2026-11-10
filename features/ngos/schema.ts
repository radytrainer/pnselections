import { z } from "zod";

export const ngoFormSchema = z.object({
  organization_name: z.string().min(1, "Organization name is required"),
  logo_url: z.string().optional().or(z.literal("")),
  contact_person: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email("Enter a valid email address").optional().or(z.literal("")),
  website: z.string().optional().or(z.literal("")),
  province_id: z.string().uuid().optional().or(z.literal("")),
  district_name: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type NgoFormValues = z.infer<typeof ngoFormSchema>;
