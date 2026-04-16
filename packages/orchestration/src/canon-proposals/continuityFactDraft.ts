import { parse as parseYaml } from "yaml";

/**
 * Helpers for drafting continuity-fact proposals against
 * `packages/canon/continuity-facts.yaml`.
 *
 * We deliberately do NOT round-trip through yaml.stringify — that would lose
 * the file's existing comments, section headers, and formatting that operators
 * rely on for legibility. Instead we manipulate the file as text using the
 * structural conventions of the file itself.
 */

export interface ContinuityFactDraftInput {
  factId?: string;
  statement: string;
  category: string;
  status?: string;
  source?: string;
}

export interface ParsedContinuityFact {
  id: string;
  statement: string;
  category?: string;
  status?: string;
  source?: string;
}

export function parseContinuityFacts(yamlText: string): ParsedContinuityFact[] {
  const parsed = parseYaml(yamlText) as { facts?: unknown };
  if (!parsed || !Array.isArray(parsed.facts)) {
    return [];
  }

  return (parsed.facts as Array<Record<string, unknown>>).map((entry) => ({
    id: String(entry.id ?? ""),
    statement: String(entry.statement ?? ""),
    category:
      typeof entry.category === "string" ? entry.category : undefined,
    status: typeof entry.status === "string" ? entry.status : undefined,
    source: typeof entry.source === "string" ? entry.source : undefined,
  }));
}

export function nextContinuityFactId(facts: ParsedContinuityFact[]): string {
  let max = 0;
  for (const fact of facts) {
    const match = /^CF-(\d+)$/.exec(fact.id);
    if (match) {
      const value = parseInt(match[1], 10);
      if (Number.isFinite(value) && value > max) {
        max = value;
      }
    }
  }

  const next = max + 1;
  return `CF-${String(next).padStart(3, "0")}`;
}

function escapeYamlString(value: string): string {
  // Force double-quoted form so embedded colons / quotes are unambiguous.
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

export function buildContinuityFactBlock(input: {
  id: string;
  statement: string;
  category: string;
  status: string;
  source?: string;
}): string {
  const lines = [
    `  - id: ${input.id}`,
    `    statement: ${escapeYamlString(input.statement)}`,
    `    category: ${input.category}`,
    `    status: ${input.status}`,
  ];

  if (input.source) {
    lines.push(`    source: ${escapeYamlString(input.source)}`);
  }

  return `${lines.join("\n")}\n`;
}

/**
 * Append a new continuity fact at the end of the file.
 *
 * If a fact with the same id already exists in the file, throws — the caller
 * should switch to a "modify" proposal instead.
 */
export function appendContinuityFact(
  beforeContent: string,
  input: {
    id: string;
    statement: string;
    category: string;
    status: string;
    source?: string;
  }
): string {
  const existing = parseContinuityFacts(beforeContent);
  if (existing.some((fact) => fact.id === input.id)) {
    throw new Error(`Continuity fact ${input.id} already exists`);
  }

  const block = buildContinuityFactBlock(input);
  const normalized = ensureTrailingNewline(beforeContent);
  return `${normalized}${block}`;
}
