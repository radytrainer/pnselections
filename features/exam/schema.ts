import { z } from "zod";

// Kept as strings (native input values), converted to numbers at the call
// site — see features/students/schema.ts for why.
export const examFormSchema = z.object({
  math_score: z.string().min(1, "Required"),
  english_score: z.string().min(1, "Required"),
  logic_score: z.string().min(1, "Required"),
  computer_score: z.string().min(1, "Required"),
});

export type ExamFormValues = z.infer<typeof examFormSchema>;
