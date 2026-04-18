import type { TestimonySegment } from "../../../../witness-types/src/testimony";

function formatSegments(segments: TestimonySegment[]): string {
  return segments
    .map(
      (segment) =>
        `[${segment.id}] ${segment.role.toUpperCase()} (${segment.createdAt})\n${segment.text}`
    )
    .join("\n\n");
}

const WITNESS_DRAFT_DISCIPLINE = [
  "Witness downstream drafting discipline:",
  "- These outputs are reviewable Witness records, not canon.",
  "- Keep claims provisional, bounded, and traceable to testimony.",
  "- Preserve contradiction, ambiguity, and uncertainty.",
  "- Do not imply archive release or publication permission.",
  "- Do not upgrade style into ontology or certainty.",
].join("\n");

export function buildWitnessSynthesisDraftPrompt(input: {
  testimonyId: string;
  witnessId: string;
  segments: TestimonySegment[];
}): string {
  return [
    WITNESS_DRAFT_DISCIPLINE,
    "",
    "Task: Draft a concise Witness synthesis for operator review.",
    "The synthesis should summarize salient patterns while preserving uncertainty.",
    "",
    `Witness ID: ${input.witnessId}`,
    `Testimony ID: ${input.testimonyId}`,
    "",
    "Testimony segments:",
    formatSegments(input.segments),
  ].join("\n");
}

export function buildWitnessSynthesisCritiquePrompt(draft: string): string {
  return [
    "Critique this Witness synthesis draft for:",
    "- overclaiming or totalizing language",
    "- canon drift",
    "- publication assumptions",
    "- loss of contradiction or uncertainty",
    "",
    draft,
  ].join("\n");
}

export function buildWitnessSynthesisRevisePrompt(
  draft: string,
  critique: string
): string {
  return [
    "Revise this Witness synthesis draft using the critique.",
    "Keep the result restrained, reviewable, and grounded in the testimony only.",
    "",
    "Draft:",
    draft,
    "",
    "Critique:",
    critique,
  ].join("\n");
}

export function buildWitnessAnnotationDraftPrompt(input: {
  testimonyId: string;
  witnessId: string;
  segments: TestimonySegment[];
  taxonomyYaml: string;
}): string {
  return [
    WITNESS_DRAFT_DISCIPLINE,
    "",
    "Task: Draft Witness annotations for operator review.",
    "Only annotate witness segments. Return JSON only.",
    'Return exactly: {"entries":[...]}',
    "Each entry must include: labelId, labelName, segmentId, startOffset, endOffset, quote.",
    "Use taxonomy-backed labels only. Optional rationale must be brief.",
    "",
    `Witness ID: ${input.witnessId}`,
    `Testimony ID: ${input.testimonyId}`,
    "",
    "Allowed taxonomy:",
    input.taxonomyYaml.trim(),
    "",
    "Witness segments:",
    formatSegments(input.segments),
  ].join("\n");
}

export function buildWitnessAnnotationCritiquePrompt(draft: string): string {
  return [
    "Critique this Witness annotation JSON for:",
    "- non-taxonomy labels",
    "- non-witness segments",
    "- unsupported or over-strong labeling",
    "- quotes that are not exact substrings",
    "",
    draft,
  ].join("\n");
}

export function buildWitnessAnnotationRevisePrompt(
  draft: string,
  critique: string
): string {
  return [
    "Revise this Witness annotation JSON using the critique.",
    "Return JSON only in the same shape.",
    "",
    "Draft:",
    draft,
    "",
    "Critique:",
    critique,
  ].join("\n");
}
