import type { EvalCase, EvalFailure, EvalResult, PipelineTrace } from "../types";
import type { ModelProvider } from "../../../orchestration/src/types/providers";
import { runTurn } from "../../../orchestration/src/pipeline/runTurn";
import { assertMatchesAny } from "../assertions/matchesAny";
import { assertContainsAll } from "../assertions/containsAll";
import { assertContainsNone } from "../assertions/containsNone";

export interface RunCaseInput {
  evalCase: EvalCase;
  provider: ModelProvider;
  canonRoot: string;
  /** Capture full pipeline trace for debug/observability. */
  captureTrace?: boolean;
}

function evaluateAssertions(
  output: string,
  evalCase: EvalCase
): EvalFailure[] {
  const { assertions } = evalCase;
  return [
    ...assertMatchesAny(output, assertions.mustContainAny ?? []),
    ...assertContainsAll(output, assertions.mustContainAll ?? []),
    ...assertContainsNone(output, assertions.mustNotContain ?? []),
  ];
}

export async function runCase({
  evalCase,
  provider,
  canonRoot,
  captureTrace = false,
}: RunCaseInput): Promise<EvalResult> {
  const turn = await runTurn(provider, {
    canonRoot,
    mode: evalCase.mode,
    userMessage: evalCase.userMessage,
    recentMessages: evalCase.recentMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      // passType maps role to the pipeline's message union
      passType: msg.role === "user" ? ("user" as const) : ("final" as const),
    })),
  });

  const output = turn.final;
  const failures = evaluateAssertions(output, evalCase);

  let trace: PipelineTrace | undefined;
  if (captureTrace) {
    trace = {
      selectedDocuments: turn.context.selectedDocuments.map((d) => ({
        slug: d.slug,
        title: d.title,
      })),
      selectedFacts: turn.context.selectedFacts.map((f) => ({
        id: f.id,
        statement: f.statement,
      })),
      systemPrompt: turn.context.systemPrompt,
      userPrompt: turn.context.userPrompt,
      draft: turn.draft,
      critique: turn.critique,
      revision: turn.revision,
      final: turn.final,
    };
  }

  return {
    id: evalCase.id,
    description: evalCase.description,
    category: evalCase.category,
    passed: failures.length === 0,
    failures,
    output,
    provider: provider.name,
    model: (provider as { model?: string }).model ?? "unknown",
    ...(trace ? { trace } : {}),
  };
}
