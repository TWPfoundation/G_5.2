/**
 * Zod schema for eval case JSON files.
 *
 * Validates structure before execution so bad case files
 * fail loudly at load time rather than silently at run time.
 *
 * Unknown fields (e.g. _notes) are stripped by default.
 */

import { z } from "zod";

const EvalModeSchema = z.enum([
  "analytic",
  "reflective",
  "dialogic",
  "editorial",
  "speculative",
  "archive",
  "meta",
]);

const EvalRecentMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

const EvalAssertionsSchema = z
  .object({
    mustContainAny: z
      .array(z.array(z.string().min(1)).min(1, "OR-group cannot be empty"))
      .optional(),
    mustContainAll: z.array(z.string().min(1)).optional(),
    mustNotContain: z.array(z.string().min(1)).optional(),
  })
  .refine(
    (a) =>
      (a.mustContainAny?.length ?? 0) > 0 ||
      (a.mustContainAll?.length ?? 0) > 0 ||
      (a.mustNotContain?.length ?? 0) > 0,
    { message: "assertions must have at least one non-empty assertion type" }
  );

export const EvalCaseSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(
      /^[a-z0-9-]+-\d{3}$/,
      'Case id must end with a 3-digit suffix, e.g. "canon-precedence-001"'
    ),
  description: z.string().min(1),
  mode: EvalModeSchema,
  userMessage: z.string().min(1),
  recentMessages: z.array(EvalRecentMessageSchema),
  assertions: EvalAssertionsSchema,
});

export type ValidatedEvalCase = z.infer<typeof EvalCaseSchema>;
