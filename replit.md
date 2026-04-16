# G_5.2 — Structured Inquiry Runtime

## Overview

G_5.2 is a canon-first structured inquiry runtime for a versioned authored persona. It is a governed system where identity, rules, and memory are explicitly defined and enforced through a multi-pass orchestration pipeline — designed to resist "assistant mush" and maintain epistemic integrity.

## Architecture

This is a **pnpm monorepo** using **Turborepo** for task orchestration.

### Apps
- `apps/dashboard/` — Operator-facing web dashboard (Node.js HTTP server, no external deps)

### Packages
- `packages/canon/` — Source-of-truth identity layer (markdown/YAML persona definitions)
- `packages/orchestration/` — Core runtime pipeline (loadCanon → retrieval → draft → critique → revise → memory decision)
- `packages/evals/` — Regression testing harness

### Scripts
- `scripts/validate-canon.ts` — Validates canon files against Zod schemas
- `scripts/run-evals.ts` — Runs evaluation suite and generates reports

## Technology Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript
- **Package Manager:** pnpm 9+ (workspaces)
- **Build Tool:** Turborepo
- **Execution:** tsx (TypeScript runner)
- **Validation:** Zod
- **AI Providers:** OpenRouter (Anthropic, OpenAI, Gemini)

## Running the Project

The **"Start application"** workflow runs the operator dashboard:
```
tsx apps/dashboard/src/server.ts
```

The dashboard runs on port **5000** (bound to `0.0.0.0` for Replit preview).

### Dashboard Endpoints
- `GET /` — Eval dashboard HTML
- `GET /inquiry.html` — Inquiry UI
- `GET /api/reports` — List eval reports
- `GET /api/reports/:name` — Full report JSON
- `GET /api/diff?a=:name&b=:name` — Diff between two reports
- `GET /api/inquiry/sessions` — List inquiry sessions
- `GET /api/inquiry/sessions/:id` — Full session JSON
- `POST /api/inquiry/turn` — Run a new inquiry turn
- `GET /api/memory` — List durable memory items
- `DELETE /api/memory/:id` — Delete a memory item

## Data Directories

- `data/inquiry-sessions/` — Persisted session JSON files
- `data/memory-items/` — Durable memory store
- `packages/evals/reports/` — Evaluation report outputs

## Environment Variables

- `DASHBOARD_PORT` — Port for the dashboard server (default: 5000)
- `DASHBOARD_HOST` — Host to bind to (default: 0.0.0.0)
- `OPENROUTER_API_KEY` — API key for OpenRouter (required for inquiry turns)
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` — Direct provider keys (optional)

## Key Scripts

```bash
pnpm validate:canon   # Validate canon files
pnpm evals            # Run evaluation suite
pnpm dashboard        # Start operator dashboard
```

## Dependencies Note

In the Replit environment, dependencies are installed via npm at the root level:
- `yaml`, `zod` — runtime dependencies from orchestration package
- `tsx` — installed globally for TypeScript execution
