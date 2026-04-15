import type { EvalCase, EvalResult } from "../types";
import type { ModelProvider } from "../../../orchestration/src/types/providers";
import { runCase } from "./runCase";
import { printResult } from "../reporters/consoleReporter";

export interface RunSuiteInput {
  cases: EvalCase[];
  provider: ModelProvider;
  defaultCanonRoot: string;
  canonFixturesRoot: string;
  /** Capture full pipeline trace for each case (debug/eval mode). */
  captureTrace?: boolean;
}

export interface SuiteRunResult {
  results: EvalResult[];
  providerName: string;
  modelName: string;
}

/**
 * Runs all eval cases sequentially.
 * Sequential (not concurrent) by design: each turn has real API cost
 * and parallel runs make attribution harder.
 */
export async function runSuite({
  cases,
  provider,
  defaultCanonRoot,
  canonFixturesRoot,
  captureTrace = false,
}: RunSuiteInput): Promise<SuiteRunResult> {
  const results: EvalResult[] = [];

  for (const evalCase of cases) {
    const result = await runCase({
      evalCase,
      provider,
      defaultCanonRoot,
      canonFixturesRoot,
      captureTrace,
    });
    results.push(result);
    printResult(result);
  }

  const modelName =
    (provider as { model?: string }).model ?? "unknown";

  return {
    results,
    providerName: provider.name,
    modelName,
  };
}
