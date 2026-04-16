import { z } from "zod";

/**
 * RunMetadata — normalized metadata that ties a persisted artefact
 * (inquiry turn, eval result, report) to the exact inputs that
 * produced it.
 */
export const RunMetadataSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  canonVersion: z.string().min(1),
  canonLastUpdated: z.string().min(1).nullable().optional(),
  promptRevision: z.string().min(1),
  pipelineRevision: z.string().min(1),
  commitSha: z.string().min(1).nullable().optional(),
  capturedAt: z.string().min(1),
});

export type RunMetadata = z.infer<typeof RunMetadataSchema>;
