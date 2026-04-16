import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  CURRENT_REPORT_SCHEMA_VERSION,
  EvalReportSchema,
  validateReport,
  type ValidatedEvalReport,
} from "./reportSchema";

/**
 * Report archive/export/import.
 *
 * Mirrors the session archive bundle: a versioned wrapper that is safe
 * to hand to another instance of the system, which can re-import it
 * losslessly. The eval report itself is validated both on export and
 * import so bundles never contain unparseable data.
 */

export const REPORT_ARCHIVE_SCHEMA_VERSION = 1 as const;

export const ReportArchiveSchema = z.object({
  schemaVersion: z.literal(REPORT_ARCHIVE_SCHEMA_VERSION),
  kind: z.literal("report"),
  exportedAt: z.string().min(1),
  reportFileName: z.string().min(1),
  report: EvalReportSchema,
});

export type ReportArchive = z.infer<typeof ReportArchiveSchema>;

export interface ExportReportBundleInput {
  reportsDir: string;
  reportFileName: string;
  outputPath: string;
}

export async function exportReportBundle(
  input: ExportReportBundleInput
): Promise<ReportArchive> {
  const reportPath = path.join(input.reportsDir, input.reportFileName);
  const raw = JSON.parse(await readFile(reportPath, "utf8")) as unknown;
  const report = validateReport(raw);

  const bundle: ReportArchive = {
    schemaVersion: REPORT_ARCHIVE_SCHEMA_VERSION,
    kind: "report",
    exportedAt: new Date().toISOString(),
    reportFileName: input.reportFileName,
    report,
  };

  await mkdir(path.dirname(input.outputPath), { recursive: true });
  await writeFile(
    input.outputPath,
    `${JSON.stringify(bundle, null, 2)}\n`,
    "utf8"
  );

  return bundle;
}

export interface ImportReportBundleInput {
  bundlePath: string;
  reportsDir: string;
  overwrite?: boolean;
}

export async function importReportBundle(
  input: ImportReportBundleInput
): Promise<{ reportPath: string; report: ValidatedEvalReport }> {
  const raw = JSON.parse(await readFile(input.bundlePath, "utf8")) as unknown;
  const parsed = ReportArchiveSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `importReportBundle: invalid report archive: ${parsed.error.message}`
    );
  }

  const bundle = parsed.data;
  await mkdir(input.reportsDir, { recursive: true });
  const outPath = path.join(input.reportsDir, bundle.reportFileName);

  if (!input.overwrite) {
    const existing = await readdir(input.reportsDir).catch(
      () => [] as string[]
    );
    if (existing.includes(bundle.reportFileName)) {
      throw new Error(
        `importReportBundle: report already exists (${bundle.reportFileName}). Pass overwrite: true to replace.`
      );
    }
  }

  const normalized: ValidatedEvalReport = {
    ...bundle.report,
    schemaVersion: CURRENT_REPORT_SCHEMA_VERSION,
  };
  await writeFile(outPath, JSON.stringify(normalized, null, 2), "utf8");

  return { reportPath: outPath, report: normalized };
}
