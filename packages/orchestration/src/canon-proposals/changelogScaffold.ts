import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CanonProposal } from "./proposalSchema";

function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "canon-change";
}

async function nextChangelogIndex(changelogDir: string): Promise<string> {
  if (!existsSync(changelogDir)) {
    await mkdir(changelogDir, { recursive: true });
  }

  const files = await readdir(changelogDir);
  let max = 0;
  for (const file of files) {
    const match = /^(\d{4})-/.exec(file);
    if (match) {
      const value = parseInt(match[1], 10);
      if (Number.isFinite(value) && value > max) {
        max = value;
      }
    }
  }

  return String(max + 1).padStart(4, "0");
}

function provenanceLine(proposal: CanonProposal): string {
  const { provenance } = proposal;
  const parts: string[] = [`source: ${provenance.source}`];
  if (provenance.sessionId) parts.push(`session: ${provenance.sessionId}`);
  if (provenance.turnId) parts.push(`turn: ${provenance.turnId}`);
  if (provenance.memoryId) parts.push(`memory: ${provenance.memoryId}`);
  if (provenance.reflectionId)
    parts.push(`reflection: ${provenance.reflectionId}`);
  return parts.join(", ");
}

function reviewNotesSection(proposal: CanonProposal): string {
  const reviews = proposal.reviewHistory.filter(
    (entry) => entry.note && entry.note.trim().length > 0
  );

  if (reviews.length === 0) {
    return "_No reviewer notes recorded._\n";
  }

  return reviews
    .map(
      (entry) =>
        `- **${entry.action}** (${entry.at}${
          entry.reviewer ? ` — ${entry.reviewer}` : ""
        }): ${entry.note}`
    )
    .join("\n") + "\n";
}

export interface ChangelogScaffoldResult {
  filePath: string;
  relPath: string;
  content: string;
}

/**
 * Scaffold a changelog markdown entry for an accepted proposal.
 *
 * Lives at `packages/canon/changelog/NNNN-<slug>.md`. The body is templated
 * but intentionally light: the operator is expected to edit the file before
 * committing if the change deserves a richer narrative.
 */
export async function scaffoldChangelogEntry(
  canonRoot: string,
  proposal: CanonProposal,
  options: { now?: string } = {}
): Promise<ChangelogScaffoldResult> {
  const changelogDir = path.join(canonRoot, "changelog");
  const index = await nextChangelogIndex(changelogDir);
  const slug = slugify(proposal.title);
  const filename = `${index}-${slug}.md`;
  const filePath = path.join(changelogDir, filename);
  const date = (options.now ?? new Date().toISOString()).slice(0, 10);

  const content = [
    `# ${index} — ${proposal.title}`,
    "",
    `**Date:** ${date}`,
    `**Proposal:** \`${proposal.id}\``,
    `**Target:** \`${proposal.target.path}\` (${proposal.target.label})`,
    `**Change kind:** ${proposal.changeKind}`,
    `**Provenance:** ${provenanceLine(proposal)}`,
    "**Status:** Accepted",
    "",
    "---",
    "",
    "## Rationale",
    "",
    proposal.rationale.trim(),
    "",
    "## Reviewer notes",
    "",
    reviewNotesSection(proposal),
    "## Notes",
    "",
    "_Scaffolded by the M4 editorial workflow. Edit before committing if the",
    "change warrants a richer narrative (canon precedence, runtime impact,",
    "follow-up work)._",
    "",
  ].join("\n");

  await writeFile(filePath, content, "utf8");

  return {
    filePath,
    relPath: toPosixPath(path.relative(canonRoot, filePath)),
    content,
  };
}
