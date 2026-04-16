import { z } from "zod";

/**
 * Reflection & authored-artifact schemas (M5).
 *
 * The reflection workflow is structurally separate from the inquiry
 * pipeline. Topics are queued deliberately by an operator, runs draft
 * authored material through draft -> critique -> revise, and runs are
 * stored as authored artifacts that move through their own state
 * machine. Approving an artifact never mutates canon; the only way an
 * artifact can become canon is via a canon proposal reviewed in M4.
 */

export const ReflectionTopicStateSchema = z.enum([
  "queued",
  "drafted",
  "archived",
]);

export const ReflectionRunStatusSchema = z.enum(["completed", "failed"]);

export const AuthoredArtifactStatusSchema = z.enum([
  "draft",
  "approved",
  "publishing_ready",
  "archived",
]);

export const ReflectionProviderSchema = z.object({
  name: z.string().min(1),
  model: z.string().min(1),
});

export const ReflectionTopicSchema = z.object({
  schemaVersion: z.literal(1).optional(),
  id: z.string().min(1),
  title: z.string().min(1),
  prompt: z.string().min(1),
  notes: z.string().optional(),
  state: ReflectionTopicStateSchema,
  linkedSessionIds: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string().min(1)).default([]),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  lastRunId: z.string().min(1).optional(),
  lastRunAt: z.string().min(1).optional(),
  archivedAt: z.string().min(1).optional(),
  archivedReason: z.string().min(1).optional(),
});

export const ReflectionRunSchema = z.object({
  schemaVersion: z.literal(1).optional(),
  id: z.string().min(1),
  topicId: z.string().min(1),
  startedAt: z.string().min(1),
  completedAt: z.string().min(1),
  status: ReflectionRunStatusSchema,
  provider: ReflectionProviderSchema,
  canonVersion: z.string().min(1),
  draft: z.string(),
  critique: z.string(),
  revision: z.string(),
  final: z.string(),
  error: z.string().optional(),
  /** Snapshot of which canon docs/facts were in scope when authoring. */
  contextSnapshot: z
    .object({
      selectedDocuments: z.array(
        z.object({ slug: z.string(), title: z.string() })
      ),
      selectedFacts: z.array(
        z.object({ id: z.string(), statement: z.string() })
      ),
      selectedGlossaryTerms: z.array(
        z.object({ term: z.string(), definition: z.string() })
      ),
      selectedRecoveredArtifacts: z.array(
        z.object({ slug: z.string(), title: z.string() })
      ),
    })
    .optional(),
});

export const AuthoredArtifactProposalRefSchema = z.object({
  proposalId: z.string().min(1),
  proposalPath: z.string().min(1),
  createdAt: z.string().min(1),
});

export const AuthoredArtifactSchema = z.object({
  schemaVersion: z.literal(1).optional(),
  id: z.string().min(1),
  topicId: z.string().min(1),
  runId: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  status: AuthoredArtifactStatusSchema,
  metadata: z.object({
    sourceTopicId: z.string().min(1),
    linkedSessionIds: z.array(z.string().min(1)).default([]),
    provider: ReflectionProviderSchema,
    canonVersion: z.string().min(1),
    createdAt: z.string().min(1),
    revisionDate: z.string().min(1),
    approvedAt: z.string().optional(),
    approvedBy: z.string().optional(),
    publishingReadyAt: z.string().optional(),
    archivedAt: z.string().optional(),
    archivedReason: z.string().optional(),
  }),
  proposalRef: AuthoredArtifactProposalRefSchema.optional(),
});

export type ReflectionTopicState = z.infer<typeof ReflectionTopicStateSchema>;
export type ReflectionRunStatus = z.infer<typeof ReflectionRunStatusSchema>;
export type AuthoredArtifactStatus = z.infer<
  typeof AuthoredArtifactStatusSchema
>;
export type ReflectionProvider = z.infer<typeof ReflectionProviderSchema>;
export type ReflectionTopic = z.infer<typeof ReflectionTopicSchema>;
export type ReflectionRun = z.infer<typeof ReflectionRunSchema>;
export type AuthoredArtifact = z.infer<typeof AuthoredArtifactSchema>;
export type AuthoredArtifactProposalRef = z.infer<
  typeof AuthoredArtifactProposalRefSchema
>;
