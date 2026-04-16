# G_5.2 System Map

**Status:** authoritative. This document names the official subsystems of G_5.2 and which are implemented today versus planned. The README and roadmap defer to this map for subsystem naming.

## Subsystems

| Subsystem | On disk | Status | Purpose |
|---|---|---|---|
| **Canon** | `packages/canon/` | Implemented | Source-of-truth identity layer: constitution, axioms, epistemics, constraints, voice, interaction modes, worldview, continuity facts, glossary, anti-patterns, recovered-artifacts governance, changelog. |
| **Orchestration** | `packages/orchestration/` | Implemented | Provider-agnostic turn pipeline: active-canon retrieval, `draft → critique → revise → memory decision`, provider abstraction. |
| **Evals** | `packages/evals/` | Implemented | Regression harness, structured eval cases, trace capture, report generation, cross-provider drift coverage. |
| **Persistence** | `packages/orchestration/` (session + memory stores) | Implemented (minimal, file-backed) | Inquiry session records, rolling summaries, recent-turn carryover, durable memory items. Planned hardening is tracked under M1. |
| **Memory** | `packages/orchestration/` (memory module) | Implemented v1 | Selective durable memory with global/session scope, confirmation-based dedupe, operator delete. v2 discipline is tracked under M3. |
| **Dashboard / Operator surface** | `apps/dashboard/` | Implemented | Report viewer, diff UI, inquiry inspection (session search, turn drawer, retrieved-context drawer), memory inspection and delete. |
| **Inquiry surface** | `apps/dashboard/` (`/inquiry.html`) | Implemented v1 | Minimal operator-grade inquiry UI backed by persisted sessions. v1.5 expansion is tracked under M2. |
| **Editorial workflow** | *not yet on disk* | Planned (M4) | Canon / continuity-fact proposal → review → promotion flow. No code today. |
| **Reflection workflow** | *not yet on disk* | Planned (M5) | Authored-artifact generation loop (draft → critique → revise) with explicit promotion path into canon. No code today. |
| **Operator studio integration** | *not yet on disk* | Planned (M7) | Unified studio bringing inquiry, editorial, reflection, memory, and eval surfaces into one operator experience. |

## Scripts and supporting layout

- `scripts/run-evals.ts` — eval runner entry point.
- `scripts/validate-canon.ts` — canon boundary validation.
- `docs/` — authoritative project documentation (this file, `release-criteria.md`, `invariants.md`, `product-brief.md`, `LINEAGE_AND_BOUNDARIES.md`, `Memory Discipline V1.md`, `decision-log/`).
- `AGENTS.md` — agent-role and pipeline rules.

## Repo structure reality check

The on-disk structure matches the tree shown in `README.md` today:

```
G_5.2/
├─ apps/dashboard/           ✓ exists
├─ packages/
│  ├─ canon/                 ✓ exists
│  ├─ orchestration/         ✓ exists
│  └─ evals/                 ✓ exists
├─ docs/                     ✓ exists
├─ scripts/                  ✓ exists
├─ AGENTS.md                 ✓ exists
└─ g_52_project_overview_and_roadmap.md   ✓ exists
```

No separate `packages/persistence`, `packages/memory`, `packages/editorial`, or `packages/reflection` packages exist yet. Persistence and memory live inside `packages/orchestration/`. The editorial and reflection subsystems are roadmap items with no code yet; they must not be referred to as present capabilities in user-facing docs.

## Naming rules

- Use the subsystem names above in every doc, commit message, and eval category.
- Do not invent synonyms (e.g. "studio", "editor", "reflection engine") without updating this map first.
- When a subsystem is referenced as "planned", it must link back to the milestone that will introduce it.
