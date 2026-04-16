# 0003 — Memory Discipline V1

**Date:** 2026-04-16  
**Class:** Class A/B (Governance + Runtime Alignment)  
**Author:** Codex  
**Status:** Committed

---

## Summary

Implements the first governed durable-memory layer for G_5.2 and aligns canon reference material with that reality.

This change does four things:
- records that durable memory now exists as a selective file-backed runtime layer
- clarifies its precedence relative to canon, continuity, session summaries, and recent turns
- records the hybrid scope design for global preferences/decisions and session-scoped open threads
- refreshes provider-default language to match the current Gemini-first default

---

## Canon changes

- Bumped canon package version to `0.1.2`
- Updated `continuity-facts.yaml`:
  - `CF-010` now reflects the implemented inquiry runtime, including session persistence and durable-memory persistence
  - `CF-033` now reflects Gemini as the default provider preference when unset
  - added `CF-037` for durable-memory precedence
  - added `CF-038` for hybrid memory scope
- Updated `glossary.yaml`:
  - `memory` now describes the actual file-backed V1 implementation
  - `inquiry` now reflects persisted session context plus durable memory
  - `orchestration` now reflects durable-memory retrieval responsibilities
- Refreshed canon registry timestamps (`manifest.yaml`, `continuity-facts.yaml`, `glossary.yaml`, `recovered-index.yaml`)

---

## Why this matters

Memory is one of the easiest places for a canon-first system to become dishonest.

Once the runtime can retain information across turns, the canon should say plainly:
- what kind of memory exists
- what it is allowed to remember
- where it sits in the precedence order
- and what it is not allowed to silently become

---

## Runtime implications

This changelog entry accompanies a runtime change that:
- adds selective durable-memory writes after revision
- deduplicates repeated confirmations instead of duplicating memory
- retrieves memory as lowest-priority non-canonical context
- exposes operator inspection and hard delete in the inquiry surface
