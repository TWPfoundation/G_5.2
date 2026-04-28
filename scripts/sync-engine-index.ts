/**
 * sync-engine-index.ts
 * ─────────────────────────────────────────────────────────
 * Reads G_5.2 eval reports, canon manifest, and changelog;
 * produces a single engine-index.json and uploads it to the
 * witness-publications S3 bucket under _meta/engine-index.json.
 *
 * Usage:
 *   pnpm tsx scripts/sync-engine-index.ts
 *
 * Required env (matches .env):
 *   S3_ENDPOINT, S3_REGION, S3_BUCKET,
 *   S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_FORCE_PATH_STYLE
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import * as fs from "node:fs";
import * as path from "node:path";
import { parse as parseYaml } from "yaml";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EvalReportScore {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  failedIds: string[];
  criticalFailedIds: string[];
  subsystems?: Array<{
    subsystem: string;
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  }>;
}

interface EvalReport {
  schemaVersion: number;
  generatedAt: string;
  provider: string;
  model: string;
  metadata: {
    gitCommit?: string;
    canonVersion?: string;
    promptRevision?: string;
    git?: { commit: string; shortCommit: string; dirty: boolean };
    canon?: { version: string; lastUpdated: string };
  };
  score: EvalReportScore;
}

interface CanonDocument {
  slug: string;
  title: string;
  type: string;
  status: string;
  priority: number;
}

interface CanonManifest {
  version: string;
  last_updated: string;
  documents: CanonDocument[];
  recovered_artifacts?: CanonDocument[];
}

export interface EvalSummary {
  generatedAt: string;
  provider: string;
  model: string;
  passRate: number;
  total: number;
  passed: number;
  failed: number;
  gitCommit: string;
  shortCommit: string;
  dirty: boolean;
  canonVersion: string;
  subsystems: Array<{
    subsystem: string;
    passRate: number;
    total: number;
    passed: number;
    failed: number;
  }>;
}

export interface EngineIndex {
  generatedAt: string;
  canon: {
    version: string;
    lastUpdated: string;
    documentCount: number;
    recoveredArtifactCount: number;
    documents: Array<{ slug: string; title: string; type: string; status: string }>;
  };
  changelog: Array<{
    filename: string;
    title: string;
    date: string;
  }>;
  evals: EvalSummary[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, "..");

function readEvalReports(): EvalSummary[] {
  const reportsDir = path.join(REPO_ROOT, "packages", "evals", "reports");
  if (!fs.existsSync(reportsDir)) return [];

  const files = fs
    .readdirSync(reportsDir)
    .filter((f) => f.endsWith(".json"))
    .sort(); // chronological by ISO filename

  const summaries: EvalSummary[] = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(reportsDir, file), "utf-8");
      const report: EvalReport = JSON.parse(raw);

      summaries.push({
        generatedAt: report.generatedAt,
        provider: report.provider,
        model: report.model,
        passRate: report.score.passRate,
        total: report.score.total,
        passed: report.score.passed,
        failed: report.score.failed,
        gitCommit: report.metadata?.git?.commit ?? report.metadata?.gitCommit ?? "unknown",
        shortCommit: report.metadata?.git?.shortCommit ?? "unknown",
        dirty: report.metadata?.git?.dirty ?? false,
        canonVersion: report.metadata?.canon?.version ?? report.metadata?.canonVersion ?? "unknown",
        subsystems: (report.score.subsystems ?? []).map((s) => ({
          subsystem: s.subsystem,
          passRate: s.passRate,
          total: s.total,
          passed: s.passed,
          failed: s.failed,
        })),
      });
    } catch (err) {
      console.warn(`[sync] Skipping malformed report: ${file}`, err);
    }
  }

  return summaries;
}

function readCanonManifest(): EngineIndex["canon"] {
  const manifestPath = path.join(REPO_ROOT, "packages", "canon", "manifest.yaml");
  const raw = fs.readFileSync(manifestPath, "utf-8");
  const manifest: CanonManifest = parseYaml(raw);

  return {
    version: manifest.version,
    lastUpdated: manifest.last_updated,
    documentCount: manifest.documents?.length ?? 0,
    recoveredArtifactCount: manifest.recovered_artifacts?.length ?? 0,
    documents: (manifest.documents ?? []).map((d) => ({
      slug: d.slug,
      title: d.title,
      type: d.type,
      status: d.status,
    })),
  };
}

function readChangelog(): EngineIndex["changelog"] {
  const changelogDir = path.join(REPO_ROOT, "packages", "canon", "changelog");
  if (!fs.existsSync(changelogDir)) return [];

  const files = fs
    .readdirSync(changelogDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse(); // newest first

  return files.map((filename) => {
    const raw = fs.readFileSync(path.join(changelogDir, filename), "utf-8");
    const lines = raw.split("\n");
    // Extract first H1
    const titleLine = lines.find((l) => l.startsWith("# ")) ?? "";
    const title = titleLine.replace(/^# /, "").trim() || filename;
    // Extract date from **Date:** line
    const dateLine = lines.find((l) => l.startsWith("**Date:**")) ?? "";
    const date = dateLine.replace("**Date:**", "").trim() || "";
    return { filename, title, date };
  });
}

// ── Upload ────────────────────────────────────────────────────────────────────

async function uploadIndex(index: EngineIndex): Promise<void> {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const region = process.env.S3_REGION?.trim() ?? "eu-west-1";
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const forcePathStyle =
    (process.env.S3_FORCE_PATH_STYLE?.trim()?.toLowerCase() ?? "true") === "true";

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing required S3 env vars: S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY"
    );
  }

  const client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle,
  });

  const body = JSON.stringify(index, null, 2);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: "_meta/engine-index.json",
      Body: body,
      ContentType: "application/json",
      Metadata: {
        "generated-at": index.generatedAt,
        "canon-version": index.canon.version,
        "eval-count": String(index.evals.length),
      },
    })
  );

  console.log(
    `[sync] Uploaded engine-index.json → s3://${bucket}/_meta/engine-index.json`
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("[sync] Building engine index…");

  const evals = readEvalReports();
  console.log(`[sync]   Eval reports: ${evals.length}`);

  const canon = readCanonManifest();
  console.log(`[sync]   Canon: v${canon.version} (${canon.documentCount} docs)`);

  const changelog = readChangelog();
  console.log(`[sync]   Changelog entries: ${changelog.length}`);

  const index: EngineIndex = {
    generatedAt: new Date().toISOString(),
    canon,
    changelog,
    evals,
  };

  await uploadIndex(index);
  console.log("[sync] Done.");
}

main().catch((err) => {
  console.error("[sync] Fatal error:", err);
  process.exit(1);
});
