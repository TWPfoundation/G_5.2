/**
 * Operator dashboard server.
 *
 * Serves a single-page HTML dashboard + a JSON API for eval reports.
 * Zero external dependencies — uses Node's built-in http module.
 *
 * API:
 *   GET /                              → HTML dashboard
 *   GET /api/reports                   → list of report filenames (newest first)
 *   GET /api/reports/:name             → full report JSON
 *   GET /api/diff?a=:name&b=:name      → computed diff between two reports
 *
 * Usage:
 *   pnpm dashboard    (or: pnpm --filter @g52/dashboard dev)
 */

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeDiff, type JsonReport } from "./reportUtils";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.resolve(
  __dirname,
  "../../..",
  "packages/evals/reports"
);
const STATIC_DIR = path.resolve(__dirname, "../public");
const PORT = parseInt(process.env.DASHBOARD_PORT ?? "4400", 10);

// ─── Request handler ──────────────────────────────────────────────────────────

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
) {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // API: list reports
  if (url.pathname === "/api/reports") {
    try {
      const files = await fs.readdir(REPORTS_DIR);
      const reports = files
        .filter((f) => f.endsWith(".json"))
        .sort()
        .reverse();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(reports));
    } catch {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("[]");
    }
    return;
  }

  // API: report diff
  if (url.pathname === "/api/diff") {
    const nameA = url.searchParams.get("a");
    const nameB = url.searchParams.get("b");
    if (!nameA || !nameB) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Both ?a= and ?b= are required" }));
      return;
    }
    try {
      const [rawA, rawB] = await Promise.all([
        fs.readFile(path.join(REPORTS_DIR, nameA), "utf8"),
        fs.readFile(path.join(REPORTS_DIR, nameB), "utf8"),
      ]);
      const reportA: JsonReport = JSON.parse(rawA);
      const reportB: JsonReport = JSON.parse(rawB);
      const diff = computeDiff(reportA, reportB);
      diff.a.name = nameA;
      diff.b.name = nameB;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(diff));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
    return;
  }

  // API: single report
  const reportMatch = url.pathname.match(/^\/api\/reports\/(.+\.json)$/);
  if (reportMatch) {
    const reportPath = path.join(REPORTS_DIR, reportMatch[1]);
    try {
      const data = await fs.readFile(reportPath, "utf8");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(data);
    } catch {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Report not found" }));
    }
    return;
  }

  // Static files
  if (url.pathname === "/" || url.pathname === "/index.html") {
    const html = await fs.readFile(
      path.join(STATIC_DIR, "index.html"),
      "utf8"
    );
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
}

const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`\n  G_5.2 Operator Dashboard`);
  console.log(`  http://localhost:${PORT}\n`);
});
