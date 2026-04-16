import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveCanonPath } from "./canonPaths";
import type { CanonProposal } from "./proposalSchema";

export interface ApplyProposalResult {
  appliedAt: string;
  filePath: string;
  relPath: string;
}

/**
 * Apply an accepted proposal to the canon working tree.
 *
 * This is the only function in the editorial workflow that mutates files
 * inside `packages/canon/` outside of the changelog scaffolder.
 */
export async function applyProposal(
  canonRoot: string,
  proposal: CanonProposal,
  options: { now?: string } = {}
): Promise<ApplyProposalResult> {
  const filePath = resolveCanonPath(canonRoot, proposal.target.path);
  const appliedAt = options.now ?? new Date().toISOString();

  if (proposal.changeKind === "delete") {
    try {
      await rm(filePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw error;
      }
    }
  } else {
    if (proposal.afterContent === null) {
      throw new Error(
        `Proposal ${proposal.id} has changeKind=${proposal.changeKind} but afterContent is null`
      );
    }

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, proposal.afterContent, "utf8");
  }

  return {
    appliedAt,
    filePath,
    relPath: proposal.target.path,
  };
}
