import type { EvalCategory, EvalResult } from "../types";
import type { ScoreReport } from "../assertions/scoreReport";

/**
 * Prints eval results to stdout in the standard format:
 *
 *   PASS canon-precedence-001
 *   FAIL speculation-labeling-001
 *     - Missing speculative language
 *     - Contained forbidden phrase: "this will become"
 */
export function printResult(result: EvalResult): void {
  if (result.passed) {
    console.log(`PASS ${result.id}`);
    return;
  }

  console.log(`FAIL ${result.id}`);
  for (const failure of result.failures) {
    console.log(`  - ${failure.message}`);
  }
}

export function printSummary(report: ScoreReport): void {
  console.log("");
  console.log(
    `Summary: ${report.passed}/${report.total} passed` +
      (report.failed > 0 ? ` — ${report.failed} failed` : " ✓")
  );
}

/**
 * Prints a category-grouped breakdown of results:
 *
 *   governance  3/3 ✓
 *   epistemics  4/5 — 1 failed: retrieval-precedence-001
 *   style       2/2 ✓
 */
export function printCategoryBreakdown(results: EvalResult[]): void {
  const categories = new Map<
    EvalCategory,
    { passed: number; total: number; failedIds: string[] }
  >();

  for (const r of results) {
    const cat = r.category;
    if (!categories.has(cat)) {
      categories.set(cat, { passed: 0, total: 0, failedIds: [] });
    }
    const entry = categories.get(cat)!;
    entry.total++;
    if (r.passed) {
      entry.passed++;
    } else {
      entry.failedIds.push(r.id);
    }
  }

  console.log("\nCategory breakdown:");
  for (const [cat, entry] of [...categories.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const padded = cat.padEnd(12);
    if (entry.failedIds.length === 0) {
      console.log(`  ${padded} ${entry.passed}/${entry.total} ✓`);
    } else {
      console.log(
        `  ${padded} ${entry.passed}/${entry.total} — ${entry.failedIds.length} failed: ${entry.failedIds.join(", ")}`
      );
    }
  }
}
