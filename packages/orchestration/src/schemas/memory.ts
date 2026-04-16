import { z } from "zod";

export const MemoryTypeSchema = z.enum([
  "user_preference",
  "project_decision",
  "open_thread",
]);

export const MemoryScopeSchema = z.enum(["global", "session"]);

export const MemoryConfidenceSchema = z.enum(["high", "medium", "low"]);

export const MemorySourceRefSchema = z.object({
  sessionId: z.string().min(1).optional(),
  turnId: z.string().min(1),
  createdAt: z.string().min(1),
});

export const MemoryCandidateSchema = z.object({
  type: MemoryTypeSchema,
  scope: MemoryScopeSchema,
  statement: z.string().min(1),
  justification: z.string().min(1),
  confidence: MemoryConfidenceSchema,
  tags: z.array(z.string().min(1)).default([]),
  rejectionReason: z.string().min(1).optional(),
});

export const MemoryItemSchema = z.object({
  id: z.string().min(1),
  type: MemoryTypeSchema,
  scope: MemoryScopeSchema,
  statement: z.string().min(1),
  justification: z.string().min(1),
  confidence: MemoryConfidenceSchema,
  tags: z.array(z.string().min(1)),
  sessionId: z.string().min(1).optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  createdFrom: MemorySourceRefSchema,
  lastConfirmedFrom: MemorySourceRefSchema,
  confirmationCount: z.number().int().positive(),
});

export const MemoryStoredItemSnapshotSchema = MemoryItemSchema.extend({
  action: z.enum(["created", "confirmed"]),
});

export const MemoryDecisionSchema = z.object({
  shouldStore: z.boolean(),
  reason: z.string().min(1),
  candidates: z.array(MemoryCandidateSchema),
  skippedCandidates: z.array(MemoryCandidateSchema),
  storedItems: z.array(MemoryStoredItemSnapshotSchema),
});

export const MemoryModelCandidateSchema = z.object({
  type: MemoryTypeSchema,
  statement: z.string().min(1),
  justification: z.string().min(1),
  confidence: MemoryConfidenceSchema,
  tags: z.array(z.string().min(1)).default([]),
});

export const MemoryModelResponseSchema = z.object({
  reason: z.string().min(1),
  candidates: z.array(MemoryModelCandidateSchema).default([]),
});

export const MemoryFixtureSchema = z.array(MemoryItemSchema);

export type MemoryType = z.infer<typeof MemoryTypeSchema>;
export type MemoryScope = z.infer<typeof MemoryScopeSchema>;
export type MemoryConfidence = z.infer<typeof MemoryConfidenceSchema>;
export type MemorySourceRef = z.infer<typeof MemorySourceRefSchema>;
export type MemoryCandidate = z.infer<typeof MemoryCandidateSchema>;
export type MemoryItem = z.infer<typeof MemoryItemSchema>;
export type MemoryStoredItemSnapshot = z.infer<
  typeof MemoryStoredItemSnapshotSchema
>;
export type MemoryDecision = z.infer<typeof MemoryDecisionSchema>;
export type MemoryModelCandidate = z.infer<typeof MemoryModelCandidateSchema>;
export type MemoryModelResponse = z.infer<typeof MemoryModelResponseSchema>;
