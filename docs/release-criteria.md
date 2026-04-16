# G_5.2 Release Criteria

**Status:** authoritative. This document defines the release ladder for G_5.2 and the v1 threshold. The README and roadmap defer to this document for release terminology.

## Release ladder

G_5.2 advances through four named rungs. Each rung is cumulative: later rungs inherit the invariants and capabilities of earlier rungs.

### 1. Operator-grade governed runtime *(current state)*
The runtime is usable by the project operator for real inquiry sessions.

Required:
- Canon loads and validates on startup.
- `draft → critique → revise → memory decision` pipeline runs end-to-end against at least one provider.
- Eval harness produces inspectable JSON reports with trace capture.
- Dashboard supports report inspection, diffing, session inspection, and memory inspection.
- Inquiry sessions persist with rolling summaries and recent-turn carryover.
- Durable memory is selective, inspectable, and deletable.

This is where G_5.2 sits today.

### 2. Editorial-grade governed runtime
The runtime supports governed evolution of canon and memory through explicit operator workflows.

Required on top of rung 1:
- Canon / continuity-fact proposal flow with review, acceptance, and rejection (M4).
- Memory discipline v2: triage for proposed-but-skipped items, resolution of open threads, anti-pollution coverage (M3).
- Persistence and trace hardening sufficient for long-lived sessions (M1).
- Inquiry surface v1.5 that exposes the editorial loop to the operator (M2).

### 3. Reflection-grade authored system
The runtime can generate new authored artifacts under the same governance it applies to inquiry, and promote them into canon only through explicit review.

Required on top of rung 2:
- Reflection authoring workflow: draft → critique → revise → store as artifact (M5).
- Explicit promotion path from reflection artifact to canon, with changelog entry.
- Eval coverage for reflection discipline and for drift introduced by authoring (M6).

### 4. G_5.2 v1
The first release the operator considers "usable without repo surgery".

Required on top of rung 3:
- Release hardening: stable config, reproducible setup, documented upgrade paths (M8).
- Operator studio integration that unifies inquiry, editorial, reflection, memory, and eval surfaces (M7).
- Eval matrix healthy across providers; drift-control expansion in place (M6).

## v1 scope

**In v1:**
- Canon package stable and versioned.
- Inquiry sessions persist reliably across restarts.
- Operator can inspect full turn traces on demand.
- Memory promotion is governed and inspectable.
- Canon change workflow exists and is usable.
- Reflection workflow exists and is usable.
- Multi-provider eval matrix is healthy enough to compare drift.
- Dashboard supports report diffing and live inquiry inspection.
- Operator studio integrates the above into one coherent surface.
- The system can be used regularly without ad-hoc repo edits.

**Explicitly not in v1 (post-v1):**
- Public launch or consumer-facing product surface.
- Autonomous behavior beyond the governed turn pipeline.
- Broad tool use or function-calling ecosystems.
- Multi-user architecture, auth, rate limits, monitoring at product scale.
- Final theory of memory, selfhood, or reflection.
- Downstream protocol / institutional integrations.
- Automatic writeback from sessions or reflections into canon.

## Milestone-to-rung mapping

| Milestone | Rung it advances |
|---|---|
| M0 — Baseline lock & source-of-truth cleanup | Rung 1 (lock the baseline) |
| M1 — Persistence & trace hardening | Rung 2 prerequisite |
| M2 — Inquiry surface v1.5 | Rung 2 |
| M3 — Memory discipline v2 | Rung 2 |
| M4 — Canon editorial workflow | Rung 2 |
| M5 — Reflection & authored artifact workflow | Rung 3 |
| M6 — Eval & drift-control expansion | Rung 3 / Rung 4 |
| M7 — Operator studio integration | Rung 4 |
| M8 — Release hardening & v1 threshold | Rung 4 |

## Rule

A rung is not reached until every item in its "required" list is implemented, tested by evals where applicable, and documented. The operator decides when a rung is crossed; the milestones are the path, not the certification.
