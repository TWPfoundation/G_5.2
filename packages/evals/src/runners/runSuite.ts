import type { EvalCase, EvalResult } from "../types";
import type { ModelProvider } from "../../../orchestration/src/types/providers";
import type { ProductRegistry } from "../../../orchestration/src/products";
import { describeProvider } from "../../../orchestration/src/providers/label";
import { runCase } from "./runCase";
import { printResult } from "../reporters/consoleReporter";

export interface RunSuiteInput {
  cases: EvalCase[];
  provider: ModelProvider;
  productRegistry: ProductRegistry;
  policyFixturesRoot: string;
  memoryFixturesRoot: string;
  witnessFixturesRoot: string;
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
  productRegistry,
  policyFixturesRoot,
  memoryFixturesRoot,
  witnessFixturesRoot,
  captureTrace = false,
}: RunSuiteInput): Promise<SuiteRunResult> {
  const results: EvalResult[] = [];

  for (const evalCase of cases) {
    const result = await runCase({
      evalCase,
      provider,
      productRegistry,
      policyFixturesRoot,
      memoryFixturesRoot,
      witnessFixturesRoot,
      captureTrace,
    });
    results.push(result);
    printResult(result);
  }

  const providerLabel = describeProvider(provider);

  return {
    results,
    providerName: providerLabel.name,
    modelName: providerLabel.model,
  };
}
