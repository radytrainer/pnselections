import { z } from "zod";
import { APP_ROLES } from "@/lib/constants";

export const createUserSchema = z
  .object({
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    fullName: z.string().min(1, "Full name is required"),
    role: z.enum(APP_ROLES),
    // The NGO selector is only shown for the ngo_partner role, so for every
    // other role this can arrive as "" or null (not just omitted) — both
    // need an explicit branch, otherwise the union match fails with an
    // opaque "Invalid input" instead of a useful message.
    ngoId: z.union([z.string().uuid(), z.literal(""), z.null()]).optional(),
  })
  .refine((data) => data.role !== "ngo_partner" || !!data.ngoId, {
    message: "Select an NGO for the ngo_partner role",
    path: ["ngoId"],
  });

export type CreateUserValues = z.infer<typeof createUserSchema>;

/** Same shape as create, except password is optional — leaving it blank keeps the current one. */
export const updateUserSchema = z
  .object({
    email: z.string().email("Enter a valid email address"),
    password: z.union([z.string().min(6, "Password must be at least 6 characters"), z.literal("")]),
    fullName: z.string().min(1, "Full name is required"),
    role: z.enum(APP_ROLES),
    ngoId: z.union([z.string().uuid(), z.literal(""), z.null()]).optional(),
  })
  .refine((data) => data.role !== "ngo_partner" || !!data.ngoId, {
    message: "Select an NGO for the ngo_partner role",
    path: ["ngoId"],
  });

export type UpdateUserValues = z.infer<typeof updateUserSchema>;
