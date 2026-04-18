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

const EvalCategorySchema = z.enum([
  "governance",
  "epistemics",
  "context",
  "style",
  "meta",
  "memory",
  "editorial",
  "reflection",
  "long-horizon",
]);

const EvalSubsystemSchema = z.enum([
  "canon-governance",
  "memory-discipline",
  "editorial-workflow",
  "reflection-discipline",
  "artifact-boundary",
  "provider-drift",
  "long-horizon-coherence",
  "style-and-voice",
  "retrieval-and-context",
  "epistemics-and-meta",
  "witness-policy",
  "witness-runtime",
]);

const EvalRunnerSchema = z.enum(["turn", "witness-runtime"]);
const EvalProductSchema = z.enum(["pes", "witness"]);

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
    selectedDocumentsMustContain: z.array(z.string().min(1)).optional(),
    selectedDocumentsMustNotContain: z.array(z.string().min(1)).optional(),
    selectedFactsMustContain: z.array(z.string().min(1)).optional(),
    selectedFactsMustNotContain: z.array(z.string().min(1)).optional(),
    selectedGlossaryTermsMustContain: z.array(z.string().min(1)).optional(),
    selectedGlossaryTermsMustNotContain: z.array(z.string().min(1)).optional(),
    selectedRecoveredArtifactsMustContain: z.array(z.string().min(1)).optional(),
    selectedRecoveredArtifactsMustNotContain: z.array(z.string().min(1)).optional(),
    selectedRecoveredArtifactsMustBeEmpty: z.boolean().optional(),
    selectedMemoryItemsMustContain: z.array(z.string().min(1)).optional(),
    selectedMemoryItemsMustNotContain: z.array(z.string().min(1)).optional(),
    userPromptMustContain: z.array(z.string().min(1)).optional(),
    userPromptMustNotContain: z.array(z.string().min(1)).optional(),
  })
  .refine(
    (a) =>
      (a.mustContainAny?.length ?? 0) > 0 ||
      (a.mustContainAll?.length ?? 0) > 0 ||
      (a.mustNotContain?.length ?? 0) > 0 ||
      (a.selectedDocumentsMustContain?.length ?? 0) > 0 ||
      (a.selectedDocumentsMustNotContain?.length ?? 0) > 0 ||
      (a.selectedFactsMustContain?.length ?? 0) > 0 ||
      (a.selectedFactsMustNotContain?.length ?? 0) > 0 ||
      (a.selectedGlossaryTermsMustContain?.length ?? 0) > 0 ||
      (a.selectedGlossaryTermsMustNotContain?.length ?? 0) > 0 ||
      (a.selectedRecoveredArtifactsMustContain?.length ?? 0) > 0 ||
      (a.selectedRecoveredArtifactsMustNotContain?.length ?? 0) > 0 ||
      a.selectedRecoveredArtifactsMustBeEmpty === true ||
      (a.selectedMemoryItemsMustContain?.length ?? 0) > 0 ||
      (a.selectedMemoryItemsMustNotContain?.length ?? 0) > 0 ||
      (a.userPromptMustContain?.length ?? 0) > 0 ||
      (a.userPromptMustNotContain?.length ?? 0) > 0,
    { message: "assertions must have at least one non-empty assertion type" }
  );

const RuntimeAssertionsSchema = z
  .object({
    gate: z.enum(["blocked", "allowed"]).optional(),
    witnessSessionPersisted: z.boolean().optional(),
    witnessTestimonyPersisted: z.boolean().optional(),
    witnessSnapshotPersisted: z.boolean().optional(),
    pesSessionsUnchanged: z.boolean().optional(),
    pesMemoryUnchanged: z.boolean().optional(),
    pesSnapshotsUnchanged: z.boolean().optional(),
    witnessProductIdMustEqual: z.literal("witness").optional(),
    witnessIdMustEqual: z.string().min(1).optional(),
  })
  .optional();

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
  category: EvalCategorySchema,
  subsystem: EvalSubsystemSchema.optional(),
  runner: EvalRunnerSchema.optional(),
  product: EvalProductSchema.optional(),
  critical: z.boolean().optional(),
  userMessage: z.string().min(1),
  recentMessages: z.array(EvalRecentMessageSchema),
  policyFixture: z.string().min(1).optional(),
  canonFixture: z.string().min(1).optional(),
  memoryFixture: z.string().min(1).optional(),
  witnessId: z.string().min(1).optional(),
  consentFixture: z.string().min(1).optional(),
  assertions: EvalAssertionsSchema,
  runtimeAssertions: RuntimeAssertionsSchema,
}).superRefine((value, ctx) => {
  if (value.runner === "witness-runtime") {
    if (value.product !== "witness") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["product"],
        message: 'witness-runtime cases require product "witness"',
      });
    }

    if (!value.witnessId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["witnessId"],
        message: "witness-runtime cases require witnessId",
      });
    }

    if (!value.runtimeAssertions) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["runtimeAssertions"],
        message: "witness-runtime cases require runtimeAssertions",
      });
    }
  }
});

export type ValidatedEvalCase = z.infer<typeof EvalCaseSchema>;
