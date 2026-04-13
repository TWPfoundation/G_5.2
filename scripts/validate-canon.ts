#!/usr/bin/env tsx
/**
 * scripts/validate-canon.ts
 *
 * Run the full three-phase canon boundary validation from the repo root.
 * Delegates to validateCanonBoundary in packages/orchestration.
 *
 * Usage:
 *   pnpm validate:canon
 *   pnpm validate-canon      (legacy alias, same script)
 *
 * Exit 0 — all checks pass (warnings are printed but not failures)
 * Exit 1 — one or more errors, with details
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCanonBoundary } from "../packages/orchestration/src/canon/validateCanon.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const canonRoot = path.join(repoRoot, "packages", "canon");

  console.log(`validate:canon — checking ${canonRoot}\n`);

  const result = await validateCanonBoundary(canonRoot);

  // Report manifest summary
  const docCount = result.manifest.documents.length;
  const artifactCount = result.manifest.recovered_artifacts?.length ?? 0;
  const factCount = result.continuity.facts.length;
  const indexedCount = result.recoveredIndex.artifacts.length;

  console.log(`  ✓ manifest.yaml            — ${docCount} documents`);
  console.log(`  ✓ continuity-facts.yaml    — ${factCount} facts`);
  console.log(
    `  ✓ recovered-index.yaml     — ${indexedCount} artifact(s) indexed`
  );
  console.log(
    `  ✓ manifest recovered list  — ${artifactCount} artifact(s) registered`
  );
  console.log();

  if (result.warnings.length > 0) {
    console.log(`Warnings (${result.warnings.length}):`);
    for (const warning of result.warnings) {
      const ctx = warning.context ? ` [${warning.context}]` : "";
      console.warn(`  ⚠ ${warning.message}${ctx}`);
    }
    console.log();
  }

  console.log("validate:canon passed ✓\n");
}

main().catch((error) => {
  console.error("\nvalidate:canon failed ✗\n");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
