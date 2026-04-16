import { z } from "zod";
import { SCHEMA_VERSIONS } from "../persistence/schemaVersions";

export const PROPOSAL_SCHEMA_VERSION = 1;

export const PROPOSAL_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "needs_revision",
] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const PROPOSAL_SOURCES = [
  "inquiry_turn",
  "memory_item",
  "manual",
  "reflection_output",
] as const;

export type ProposalSource = (typeof PROPOSAL_SOURCES)[number];

export const PROPOSAL_CHANGE_KINDS = ["create", "modify", "delete"] as const;

export type ProposalChangeKind = (typeof PROPOSAL_CHANGE_KINDS)[number];

export const ProposalProvenanceSchema = z.object({
  source: z.enum(PROPOSAL_SOURCES),
  sessionId: z.string().min(1).optional(),
  turnId: z.string().min(1).optional(),
  memoryId: z.string().min(1).optional(),
  reflectionId: z.string().min(1).optional(),
  note: z.string().optional(),
});

export const ProposalTargetSchema = z.object({
  path: z
    .string()
    .min(1)
    .refine(
      (value) =>
        !value.includes("..") && !value.startsWith("/") && !value.includes("\\"),
      { message: "target.path must be relative within canon root" }
    ),
  label: z.string().min(1),
  kind: z.enum([
    "canon_document",
    "continuity_fact",
    "glossary_term",
    "manifest",
  ]),
  factId: z.string().optional(),
  glossaryTerm: z.string().optional(),
});

export const ProposalReviewEntrySchema = z.object({
  at: z.string().min(1),
  action: z.enum([
    "created",
    "edited",
    "marked_pending",
    "marked_needs_revision",
    "accepted",
    "rejected",
    "applied",
    "changelog_scaffolded",
  ]),
  status: z.enum(PROPOSAL_STATUSES).optional(),
  note: z.string().optional(),
  reviewer: z.string().optional(),
});

const cappedStatusEnum = z.enum(PROPOSAL_STATUSES);

export const CanonProposalSchema = z.object({
  schemaVersion: z.literal(PROPOSAL_SCHEMA_VERSION),
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  status: cappedStatusEnum,
  changeKind: z.enum(PROPOSAL_CHANGE_KINDS),
  target: ProposalTargetSchema,
  beforeContent: z.string().nullable(),
  afterContent: z.string().nullable(),
  rationale: z.string().min(1),
  provenance: ProposalProvenanceSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  acceptedAt: z.string().min(1).optional(),
  rejectedAt: z.string().min(1).optional(),
  appliedAt: z.string().min(1).optional(),
  changelogPath: z.string().min(1).optional(),
  reviewHistory: z.array(ProposalReviewEntrySchema),
  createdBy: z.string().optional(),
});

export type CanonProposal = z.infer<typeof CanonProposalSchema>;
export type ProposalProvenance = z.infer<typeof ProposalProvenanceSchema>;
export type ProposalTarget = z.infer<typeof ProposalTargetSchema>;
export type ProposalReviewEntry = z.infer<typeof ProposalReviewEntrySchema>;

export function parseProposal(raw: unknown): CanonProposal {
  return CanonProposalSchema.parse(raw);
}

// Re-export schemaVersions to keep co-located callers consistent, even though
// proposals carry their own dedicated version number distinct from the global
// session/memory/report versions.
export const RELATED_SCHEMA_VERSIONS = SCHEMA_VERSIONS;
