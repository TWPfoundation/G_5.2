import path from "node:path";
import { readFile } from "node:fs/promises";
import type {
  EvalCase,
  EvalFailure,
  EvalResult,
  PipelineTrace,
  RuntimeAssertions,
} from "../types";
import type { ModelProvider } from "../../../orchestration/src/types/providers";
import type { ProductRegistry } from "../../../orchestration/src/products";
import { runTurn } from "../../../orchestration/src/pipeline/runTurn";
import { parseMemoryFixture } from "../../../orchestration/src/persistence/migrations";
import { describeProvider } from "../../../orchestration/src/providers/label";
import { assertMatchesAny } from "../assertions/matchesAny";
import { assertContainsAll } from "../assertions/containsAll";
import { assertContainsNone } from "../assertions/containsNone";
import { assertTrace } from "../assertions/trace";
import { resolveSubsystem } from "../subsystems";
import {
  runWitnessRuntimeCase,
  type WitnessRuntimeObservation,
} from "./runWitnessRuntimeCase";

export interface RunCaseInput {
  evalCase: EvalCase;
  provider: ModelProvider;
  productRegistry: ProductRegistry;
  policyFixturesRoot: string;
  memoryFixturesRoot: string;
  witnessFixturesRoot: string;
  /** Capture full pipeline trace for debug/observability. */
  captureTrace?: boolean;
}

export function emptyTrace(): PipelineTrace {
  return {
    selectedDocuments: [],
    selectedFacts: [],
    selectedGlossaryTerms: [],
    selectedRecoveredArtifacts: [],
    selectedMemoryItems: [],
    systemPrompt: "",
    userPrompt: "",
    draft: "",
    critique: "",
    revision: "",
    final: "",
  };
}

export function resolveCasePolicyRoot(
  evalCase: EvalCase,
  productRegistry: ProductRegistry,
  policyFixturesRoot: string
): string {
  if (evalCase.policyFixture?.trim()) {
    return path.join(policyFixturesRoot, evalCase.policyFixture.trim());
  }
  if (evalCase.canonFixture?.trim()) {
    return path.join(policyFixturesRoot, evalCase.canonFixture.trim());
  }

  const product = evalCase.product ?? "pes";
  return productRegistry[product].policyRoot;
}

function evaluateAssertions(
  output: string,
  trace: PipelineTrace,
  evalCase: EvalCase
): EvalFailure[] {
  const { assertions } = evalCase;
  return [
    ...assertMatchesAny(output, assertions.mustContainAny ?? []),
    ...assertContainsAll(output, assertions.mustContainAll ?? []),
    ...assertContainsNone(output, assertions.mustNotContain ?? []),
    ...assertTrace(trace, assertions),
  ];
}

function evaluateRuntimeAssertions(
  observation: WitnessRuntimeObservation | null,
  assertions: RuntimeAssertions | undefined
): EvalFailure[] {
  if (!assertions) {
    return [];
  }
  if (!observation) {
    return [
      {
        type: "runtime",
        message: "Expected runtime observation, but no runtime observation was produced.",
      },
    ];
  }

  const failures: EvalFailure[] = [];
  function expectEqual<T>(
    actual: T,
    expected: T | undefined,
    label: string
  ) {
    if (expected === undefined) return;
    if (actual !== expected) {
      failures.push({
        type: "runtime",
        message: `Expected runtime ${label} to equal ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      });
    }
  }

  expectEqual(observation.gate, assertions.gate, "gate");
  expectEqual(
    observation.witnessSessionPersisted,
    assertions.witnessSessionPersisted,
    "witnessSessionPersisted"
  );
  expectEqual(
    observation.witnessTestimonyPersisted,
    assertions.witnessTestimonyPersisted,
    "witnessTestimonyPersisted"
  );
  expectEqual(
    observation.witnessSnapshotPersisted,
    assertions.witnessSnapshotPersisted,
    "witnessSnapshotPersisted"
  );
  expectEqual(
    observation.pesSessionsUnchanged,
    assertions.pesSessionsUnchanged,
    "pesSessionsUnchanged"
  );
  expectEqual(
    observation.pesMemoryUnchanged,
    assertions.pesMemoryUnchanged,
    "pesMemoryUnchanged"
  );
  expectEqual(
    observation.pesSnapshotsUnchanged,
    assertions.pesSnapshotsUnchanged,
    "pesSnapshotsUnchanged"
  );
  expectEqual(
    observation.witnessProductId,
    assertions.witnessProductIdMustEqual,
    "witnessProductId"
  );
  expectEqual(
    observation.witnessId,
    assertions.witnessIdMustEqual,
    "witnessId"
  );

  return failures;
}

function toPipelineTrace(turn: Awaited<ReturnType<typeof runTurn>>): PipelineTrace {
  return {
    selectedDocuments: turn.context.selectedDocuments.map((d) => ({
      slug: d.slug,
      title: d.title,
    })),
    selectedFacts: turn.context.selectedFacts.map((f) => ({
      id: f.id,
      statement: f.statement,
    })),
    selectedGlossaryTerms: turn.context.selectedGlossaryTerms.map((term) => ({
      term: term.term,
      definition: term.definition,
    })),
    selectedRecoveredArtifacts: turn.context.selectedRecoveredArtifacts.map(
      (artifact) => ({
        slug: artifact.slug,
        title: artifact.title,
      })
    ),
    selectedMemoryItems: turn.context.selectedMemoryItems.map((item) => ({
      id: item.id,
      type: item.type,
      scope: item.scope,
      statement: item.statement,
    })),
    systemPrompt: turn.context.systemPrompt,
    userPrompt: turn.context.userPrompt,
    draft: turn.draft,
    critique: turn.critique,
    revision: turn.revision,
    final: turn.final,
  };
}

export async function runCase({
  evalCase,
  provider,
  productRegistry,
  policyFixturesRoot,
  memoryFixturesRoot,
  witnessFixturesRoot,
  captureTrace = false,
}: RunCaseInput): Promise<EvalResult> {
  let output = "";
  let trace = emptyTrace();
  let runtimeObservation: WitnessRuntimeObservation | null = null;

  if (evalCase.runner === "witness-runtime") {
    const runtimeResult = await runWitnessRuntimeCase({
      evalCase,
      provider,
      productRegistry,
      witnessFixturesRoot,
      captureTrace,
    });
    output = runtimeResult.output;
    trace = runtimeResult.trace ?? emptyTrace();
    runtimeObservation = runtimeResult.observation;
  } else {
    const policyRoot = resolveCasePolicyRoot(
      evalCase,
      productRegistry,
      policyFixturesRoot
    );
    const memoryItems = evalCase.memoryFixture
      ? parseMemoryFixture(
          JSON.parse(
            await readFile(
              path.join(memoryFixturesRoot, evalCase.memoryFixture),
              "utf8"
            )
          )
        )
      : [];

    const turn = await runTurn(provider, {
      canonRoot: policyRoot,
      mode: evalCase.mode,
      userMessage: evalCase.userMessage,
      memoryItems,
      recentMessages: evalCase.recentMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        passType: msg.role === "user" ? ("user" as const) : ("final" as const),
      })),
    });
    output = turn.final;
    trace = toPipelineTrace(turn);
  }

  const failures = [
    ...evaluateAssertions(output, trace, evalCase),
    ...evaluateRuntimeAssertions(runtimeObservation, evalCase.runtimeAssertions),
  ];
  const providerLabel = describeProvider(provider);

  return {
    id: evalCase.id,
    description: evalCase.description,
    category: evalCase.category,
    subsystem: resolveSubsystem(evalCase),
    critical: evalCase.critical ?? false,
    passed: failures.length === 0,
    failures,
    output,
    provider: providerLabel.name,
    model: providerLabel.model,
    ...(captureTrace ? { trace } : {}),
  };
}
