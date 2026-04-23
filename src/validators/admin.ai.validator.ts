import { z } from "zod";

export const adminAiValidators = {
  testAnalyze: z.object({
    body: z.object({
      text: z
        .string()
        .min(1, "Text is required")
        .max(5000, "Text must be at most 5000 characters")
        .trim(),
    }),
  }),

  forceAnalyzeEntry: z.object({
    params: z.object({
      id: z.string().uuid("Entry ID must be a valid UUID"),
    }),
  }),
};
