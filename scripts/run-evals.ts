#!/usr/bin/env tsx
/**
 * scripts/run-evals.ts
 *
 * Root-level eval runner. Resolves paths from repo root.
 * Use this for CI or cross-package runs.
 *
 * Usage:
 *   pnpm evals                        # run all cases
 *   pnpm evals -- canon               # filter by id/filename fragment
 *   pnpm evals -- canon voice-001     # multiple filters (OR)
 *   EVAL_PROVIDER=openai pnpm evals   # switch provider
 *
 * Exit 0 — all matched cases passed
 * Exit 1 — one or more failures
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCases } from "../packages/evals/src/fixtures/loadCases";
import { runSuite } from "../packages/evals/src/runners/runSuite";
import { buildEvalProvider } from "../packages/evals/src/runners/providerFactory";
import { printSummary } from "../packages/evals/src/reporters/consoleReporter";
import { writeJsonReport } from "../packages/evals/src/reporters/jsonReporter";
import { buildScoreReport } from "../packages/evals/src/assertions/scoreReport";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const canonRoot = path.join(repoRoot, "packages", "canon");
  const casesDir = path.join(
    repoRoot,
    "packages",
    "evals",
    "src",
    "fixtures",
    "cases"
  );
  const reportsDir = path.join(repoRoot, "packages", "evals", "reports");

  // Positional CLI args become filter terms (-- separator handled by pnpm)
  const filter = process.argv.slice(2).filter((a) => !a.startsWith("--"));

  const provider = buildEvalProvider();
  const cases = await loadCases({ casesDir, filter });

  if (cases.length === 0) {
    const hint =
      filter.length > 0 ? ` matching filter: ${filter.join(", ")}` : "";
    throw new Error(`No eval cases found${hint}`);
  }

  const filterMsg = filter.length > 0 ? ` [filter: ${filter.join(", ")}]` : "";
  console.log(`Running ${cases.length} eval case(s)${filterMsg}\n`);

  const { results, providerName, modelName } = await runSuite({
    cases,
    provider,
    canonRoot,
  });

  const score = buildScoreReport(results);
  printSummary(score);

  const reportPath = await writeJsonReport(
    reportsDir,
    providerName,
    modelName,
    score,
    results
  );

  console.log(`Report: ${reportPath}`);

  if (score.failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Eval run failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
