/**
 * loadCases.ts — shared eval case loader.
 *
 * Single source of truth for reading, validating, and filtering
 * eval case JSON files. Previously duplicated between
 * packages/evals/src/index.ts and scripts/run-evals.ts.
 *
 * Validation:
 *   Each file is parsed with Zod before being returned.
 *   A schema error in any file aborts the load with a clear message
 *   identifying which file and what field failed.
 *
 * Filtering:
 *   filter terms are matched against case id and filename stem.
 *   Partial matches are supported: "canon" matches "canon-precedence-001".
 *   If filter is empty or omitted, all cases are returned.
 */

import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import type { EvalCase } from "../types";
import { EvalCaseSchema } from "../schemas/case";

export interface LoadCasesOptions {
  casesDir: string;
  /**
   * Optional filter terms. A case is included if its id or filename stem
   * contains any of the given terms (case-insensitive).
   * If empty or omitted, all cases are returned.
   */
  filter?: string[];
}

export async function loadCases(
  options: LoadCasesOptions
): Promise<EvalCase[]> {
  const { casesDir, filter = [] } = options;

  const entries = await readdir(casesDir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith(".json"))
    .map((e) => e.name)
    .sort();

  const cases: EvalCase[] = [];

  for (const file of files) {
    const filePath = path.join(casesDir, file);

    // Parse JSON
    let raw: string;
    let parsed: unknown;
    try {
      raw = await readFile(filePath, "utf8");
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `loadCases: failed to read/parse ${file} — ` +
          (err instanceof Error ? err.message : String(err))
      );
    }

    // Validate with Zod (strips unknown fields like _notes)
    const result = EvalCaseSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `  [${i.path.join(".")}] ${i.message}`)
        .join("\n");
      throw new Error(
        `loadCases: ${file} failed schema validation:\n${issues}`
      );
    }

    const evalCase = result.data as EvalCase;

    // Apply filter
    if (filter.length > 0) {
      const stem = file.replace(/\.json$/, "").toLowerCase();
      const id = evalCase.id.toLowerCase();
      const matches = filter.some((term) => {
        const t = term.toLowerCase();
        return id.includes(t) || stem.includes(t);
      });
      if (!matches) continue;
    }

    cases.push(evalCase);
  }

  return cases;
}
