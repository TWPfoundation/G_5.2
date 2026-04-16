import { z } from "zod";
import { MemoryDecisionSchema } from "../schemas/memory";
import { RunMetadataSchema } from "./runMetadata";
import { SCHEMA_VERSIONS } from "./schemaVersions";

const ModeSchema = z.enum([
  "analytic",
  "reflective",
  "dialogic",
  "editorial",
  "speculative",
  "archive",
  "meta",
]);

const ContextSnapshotInlineSchema = z.object({
  selectedDocuments: z.array(
    z.object({ slug: z.string(), title: z.string() })
  ),
  selectedFacts: z.array(z.object({ id: z.string(), statement: z.string() })),
  selectedGlossaryTerms: z.array(
    z.object({ term: z.string(), definition: z.string() })
  ),
  selectedRecoveredArtifacts: z.array(
    z.object({ slug: z.string(), title: z.string() })
  ),
  selectedMemoryItems: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      scope: z.string(),
      statement: z.string(),
      sessionId: z.string().optional(),
    })
  ),
  hadSessionSummary: z.boolean(),
  recentMessageCount: z.number().int().nonnegative(),
});

export const TurnTraceSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.turnTrace).optional(),
  draft: z.string(),
  critique: z.string(),
  revision: z.string(),
  final: z.string(),
});

export const SessionTurnRecordSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.sessionTurn).optional(),
  id: z.string().min(1),
  createdAt: z.string().min(1),
  mode: ModeSchema,
  userMessage: z.string(),
  assistantMessage: z.string(),
  memoryDecision: MemoryDecisionSchema,
  contextSnapshot: ContextSnapshotInlineSchema.optional(),
  contextSnapshotId: z.string().min(1).optional(),
  runMetadata: RunMetadataSchema.optional(),
  trace: TurnTraceSchema.optional(),
});

export const SessionSummarySchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.sessionSummary),
  text: z.string(),
  generatedAt: z.string().min(1),
});

export const InquirySessionSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.session),
  id: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  summary: SessionSummarySchema.nullable(),
  turns: z.array(SessionTurnRecordSchema),
});

export type PersistedInquirySession = z.infer<typeof InquirySessionSchema>;
export type PersistedSessionTurnRecord = z.infer<
  typeof SessionTurnRecordSchema
>;
export type PersistedSessionSummary = z.infer<typeof SessionSummarySchema>;
export type PersistedTurnTrace = z.infer<typeof TurnTraceSchema>;
