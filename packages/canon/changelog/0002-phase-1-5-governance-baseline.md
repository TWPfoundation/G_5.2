# 0002 — Phase 1.5 Governance Baseline Hardening

**Date:** 2026-04-15  
**Class:** Class A/B (Governance + Runtime Alignment)  
**Author:** Codex  
**Status:** Committed

---

## Summary

Hardens the canon/runtime contract before persistence work begins.

This change does three things:
- clarifies current provider reality in canon reference material
- records the current runtime pipeline accurately
- aligns retrieval language with the implemented governed baseline

---

## Canon changes

- Bumped canon package version to `0.1.1`
- Updated `continuity-facts.yaml`:
  - `CF-010` now reflects the currently implemented turn pipeline
  - `CF-033` now reflects the OpenRouter-backed provider layer in the repo
- Updated `glossary.yaml` provider definition to match the actual runtime
- Updated `examples/out-of-voice.md` retrieval wording so it matches the current governed retrieval stack
- Refreshed canon registry timestamps (`manifest.yaml`, `continuity-facts.yaml`, `glossary.yaml`, `recovered-index.yaml`)

---

## Why this matters

The repo had reached the point where the code was more current than several reference statements.
That is the wrong direction for a canon-first system.

Before adding persistence and operator workflow, the baseline needs to be truthful about:
- what currently governs runtime behavior
- which provider paths actually exist
- what the live retrieval stack does and does not include

---

## Runtime implications

This changelog entry accompanies a runtime hardening pass that:
- restricts governing retrieval to active canon and active continuity facts
- loads glossary terms and recovered artifacts as first-class runtime inputs
- keeps recovered artifacts explicitly historical and non-binding
- improves observability and report metadata for the baseline
