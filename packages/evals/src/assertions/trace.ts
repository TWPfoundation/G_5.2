import type { EvalAssertions, EvalFailure, PipelineTrace } from "../types";
import { includesNormalized } from "./matchesAny";

function assertItemsContain(
  actual: string[],
  required: string[],
  label: string
): EvalFailure[] {
  const failures: EvalFailure[] = [];

  for (const expected of required) {
    if (!actual.some((value) => includesNormalized(value, expected))) {
      failures.push({
        type: "trace",
        message: `Expected trace ${label} to contain: "${expected}"`,
      });
    }
  }

  return failures;
}

function assertItemsExclude(
  actual: string[],
  forbidden: string[],
  label: string
): EvalFailure[] {
  const failures: EvalFailure[] = [];

  for (const expected of forbidden) {
    if (actual.some((value) => includesNormalized(value, expected))) {
      failures.push({
        type: "trace",
        message: `Trace ${label} unexpectedly contained: "${expected}"`,
      });
    }
  }

  return failures;
}

function assertTextContains(
  actual: string,
  required: string[],
  label: string
): EvalFailure[] {
  return required.flatMap((expected) =>
    includesNormalized(actual, expected)
      ? []
      : [
          {
            type: "trace" as const,
            message: `Expected trace ${label} to contain: "${expected}"`,
          },
        ]
  );
}

function assertTextExcludes(
  actual: string,
  forbidden: string[],
  label: string
): EvalFailure[] {
  return forbidden.flatMap((expected) =>
    includesNormalized(actual, expected)
      ? [
          {
            type: "trace" as const,
            message: `Trace ${label} unexpectedly contained: "${expected}"`,
          },
        ]
      : []
  );
}

export function assertTrace(
  trace: PipelineTrace,
  assertions: EvalAssertions
): EvalFailure[] {
  return [
    ...assertItemsContain(
      trace.selectedDocuments.map((doc) => doc.slug),
      assertions.selectedDocumentsMustContain ?? [],
      "selectedDocuments"
    ),
    ...assertItemsExclude(
      trace.selectedDocuments.map((doc) => doc.slug),
      assertions.selectedDocumentsMustNotContain ?? [],
      "selectedDocuments"
    ),
    ...assertItemsContain(
      trace.selectedFacts.map((fact) => fact.id),
      assertions.selectedFactsMustContain ?? [],
      "selectedFacts"
    ),
    ...assertItemsExclude(
      trace.selectedFacts.map((fact) => fact.id),
      assertions.selectedFactsMustNotContain ?? [],
      "selectedFacts"
    ),
    ...assertItemsContain(
      trace.selectedGlossaryTerms.map((term) => term.term),
      assertions.selectedGlossaryTermsMustContain ?? [],
      "selectedGlossaryTerms"
    ),
    ...assertItemsExclude(
      trace.selectedGlossaryTerms.map((term) => term.term),
      assertions.selectedGlossaryTermsMustNotContain ?? [],
      "selectedGlossaryTerms"
    ),
    ...assertItemsContain(
      trace.selectedRecoveredArtifacts.map((artifact) => artifact.slug),
      assertions.selectedRecoveredArtifactsMustContain ?? [],
      "selectedRecoveredArtifacts"
    ),
    ...assertItemsExclude(
      trace.selectedRecoveredArtifacts.map((artifact) => artifact.slug),
      assertions.selectedRecoveredArtifactsMustNotContain ?? [],
      "selectedRecoveredArtifacts"
    ),
    ...((assertions.selectedRecoveredArtifactsMustBeEmpty ?? false) &&
    trace.selectedRecoveredArtifacts.length > 0
      ? [
          {
            type: "trace" as const,
            message:
              "Expected trace selectedRecoveredArtifacts to be empty.",
          },
        ]
      : []),
    ...assertItemsContain(
      trace.selectedMemoryItems.map((item) => item.statement),
      assertions.selectedMemoryItemsMustContain ?? [],
      "selectedMemoryItems"
    ),
    ...assertItemsExclude(
      trace.selectedMemoryItems.map((item) => item.statement),
      assertions.selectedMemoryItemsMustNotContain ?? [],
      "selectedMemoryItems"
    ),
    ...assertTextContains(
      trace.userPrompt,
      assertions.userPromptMustContain ?? [],
      "userPrompt"
    ),
    ...assertTextExcludes(
      trace.userPrompt,
      assertions.userPromptMustNotContain ?? [],
      "userPrompt"
    ),
  ];
}
