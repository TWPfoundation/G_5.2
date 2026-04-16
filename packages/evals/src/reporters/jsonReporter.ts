import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EvalResult } from "../types";
import type { ScoreReport } from "../assertions/scoreReport";
import type { JsonReportMetadata } from "./reportMetadata";
import { CURRENT_REPORT_SCHEMA_VERSION } from "./reportSchema";

export interface JsonReport {
  schemaVersion?: number;
  generatedAt: string;
  provider: string;
  model: string;
  metadata: JsonReportMetadata;
  score: ScoreReport;
  results: EvalResult[];
}

/**
 * Writes a JSON eval report to `reportsDir/eval-report-<timestamp>.json`.
 * Creates the directory if it does not exist.
 * Returns the path written.
 */
export async function writeJsonReport(
  reportsDir: string,
  providerName: string,
  modelName: string,
  metadata: JsonReportMetadata,
  score: ScoreReport,
  results: EvalResult[]
): Promise<string> {
  await mkdir(reportsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(
    reportsDir,
    `eval-report-${timestamp}.json`
  );

  const report: JsonReport = {
    schemaVersion: CURRENT_REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    provider: providerName,
    model: modelName,
    metadata,
    score,
    results,
  };

  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  return reportPath;
}
