import { z } from "zod";
import { MemoryItemSchema } from "../schemas/memory";
import { SCHEMA_VERSIONS } from "./schemaVersions";

const RecentMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
  passType: z
    .enum(["user", "draft", "critique", "revision", "final"])
    .optional(),
  createdAt: z.string().optional(),
});

/**
 * A first-class persisted context snapshot. Captures every input that
 * was fed to the pipeline, with enough fidelity to replay the turn.
 *
 * Light-weight inspection fields (selected documents / facts / etc.)
 * live alongside the replay-ready inputs so operators can read a
 * snapshot without the full canon loaded.
 */
export const ContextSnapshotSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.contextSnapshot),
  id: z.string().min(1),
  createdAt: z.string().min(1),
  mode: z.enum([
    "analytic",
    "reflective",
    "dialogic",
    "editorial",
    "speculative",
    "archive",
    "meta",
  ]),
  canonVersion: z.string().min(1),
  userMessage: z.string(),
  recentMessages: z.array(RecentMessageSchema),
  sessionSummary: z.string().nullable(),
  memoryItems: z.array(MemoryItemSchema),
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
  systemPrompt: z.string(),
  userPrompt: z.string(),
});

export type PersistedContextSnapshot = z.infer<typeof ContextSnapshotSchema>;
