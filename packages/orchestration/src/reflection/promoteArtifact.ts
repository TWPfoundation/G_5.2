import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AuthoredArtifact } from "../schemas/reflection";

export interface PromoteArtifactInput {
  artifact: AuthoredArtifact;
  /** Absolute path to packages/canon. */
  canonRoot: string;
  /** Optional operator note explaining what change to canon is being proposed. */
  proposedChange?: string;
  /** Operator name/handle for provenance. */
  proposedBy?: string;
}

export interface PromoteArtifactResult {
  proposalId: string;
  proposalPath: string;
  createdAt: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";
}

/**
 * Write a canon proposal markdown file derived from an authored artifact.
 *
 * This is the *only* path from authored artifact into the canon system,
 * and it does not by itself mutate canon. The proposal lands in
 * `packages/canon/proposals/pending/` and must subsequently be reviewed
 * and explicitly promoted via the M4 editorial workflow.
 *
 * Approving the artifact in M5 does not call this function. The operator
 * must call it explicitly via the authoring UI.
 */
export async function promoteArtifactToProposal(
  input: PromoteArtifactInput
): Promise<PromoteArtifactResult> {
  if (input.artifact.status === "draft") {
    throw new Error(
      `Artifact ${input.artifact.id} must be approved (or beyond) before being proposed to canon.`
    );
  }
  if (input.artifact.status === "archived") {
    throw new Error(
      `Artifact ${input.artifact.id} is archived and cannot be proposed to canon.`
    );
  }
  if (input.artifact.proposalRef) {
    throw new Error(
      `Artifact ${input.artifact.id} already has a proposal reference (${input.artifact.proposalRef.proposalId}).`
    );
  }

  const createdAt = new Date().toISOString();
  const proposalId = `${slugify(input.artifact.title)}-${input.artifact.id.slice(0, 8)}`;
  const dir = path.join(input.canonRoot, "proposals", "pending");
  await mkdir(dir, { recursive: true });
  const filename = `${proposalId}.md`;
  const proposalPath = path.join(dir, filename);

  const meta = input.artifact.metadata;
  const frontmatter = [
    "---",
    `proposal_id: ${proposalId}`,
    `source_artifact_id: ${input.artifact.id}`,
    `source_topic_id: ${input.artifact.topicId}`,
    `source_run_id: ${input.artifact.runId}`,
    `canon_version_at_authoring: "${meta.canonVersion}"`,
    `provider: "${meta.provider.name}/${meta.provider.model}"`,
    `created_at: "${createdAt}"`,
    `artifact_status: ${input.artifact.status}`,
    `status: pending`,
    input.proposedBy ? `proposed_by: "${input.proposedBy}"` : null,
    meta.linkedSessionIds.length > 0
      ? `linked_session_ids: [${meta.linkedSessionIds.map((id) => `"${id}"`).join(", ")}]`
      : null,
    "---",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const body = [
    `# Canon proposal: ${input.artifact.title}`,
    "",
    "> This proposal was generated from an authored reflection artifact.",
    "> Approval here does not promote canon — it must be reviewed via the",
    "> M4 editorial workflow. The artifact itself remains an authored",
    "> document and is not canon.",
    "",
    "## Proposed change",
    "",
    input.proposedChange?.trim() ||
      "_(Operator did not specify the proposed canon change. The reviewer must " +
        "extract a concrete proposal from the artifact body before promotion.)_",
    "",
    "## Source artifact",
    "",
    input.artifact.body.trim(),
    "",
  ].join("\n");

  await writeFile(proposalPath, `${frontmatter}\n\n${body}`, "utf8");

  return { proposalId, proposalPath, createdAt };
}
