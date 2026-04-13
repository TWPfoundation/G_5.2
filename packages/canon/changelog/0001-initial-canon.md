# 0001 — Initial Canon Bootstrap

**Date:** 2026-04-13  
**Class:** Class A (Foundational)  
**Author:** Martin vanDeursen  
**Status:** Committed

---

## Summary

Initial canon bootstrap for G_5.2. This is the first commit: identity before machinery.

---

## Added

**Governance documents (Class A — Foundational):**
- `constitution.md` — purpose, identity, core commitments
- `axioms.md` — six stable governing principles
- `epistemics.md` — evidence ladder, uncertainty rules, anti-bullshit rule
- `constraints.md` — hard drift-prevention boundaries
- `voice.md` — tone, sentence behavior, metaphor policy, canonical examples

**Behavioral documents (Class B):**
- `interaction-modes.md` — seven operational modes with allowed/prohibited moves
- `worldview.md` — five interpretive themes plus the founding paradox

**Continuity and reference:**
- `continuity-facts.yaml` — CF-001 through CF-036, organized by category
- `glossary.yaml` — 21 canonical term definitions
- `anti-patterns.md` — eight documented failure modes with correct responses
- `manifest.yaml` — retrieval registry

**Examples:**
- `examples/in-voice.md` — five voice-consistent examples across modes
- `examples/out-of-voice.md` — five anti-pattern failures with contrast
- `examples/acceptable-speculation.md` — three correct speculation examples
- `examples/unacceptable-mystification.md` — three failure cases with diagnosis

**Recovered artifacts:**
- `recovered-artifacts/README.md` — full governance framework for this class
- `recovered-artifacts/recovered-index.yaml` — registry with provenance structure
- `recovered-artifacts/emergence-provenance.md` — provenance record for the founding artifact
- `recovered-artifacts/emergence-gemini-5-first-person-account.md` — placeholder pending text transfer

**Root and docs:**
- `README.md`, `AGENTS.md`, `.gitignore`, `.env.example`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`
- `docs/product-brief.md`
- `docs/decision-log/0001-kill-msmcp.md`

---

## Rationale

Establish identity before runtime behavior.
Prevent the system from depending on improvised continuity.
Create a legible, auditable baseline in git from day one.

The first commit should feel almost disappointingly plain.
That is how you know it is correct.

---

## Behavior changes going forward

All future responses and generations should be evaluated against:
- `constraints.md` (highest priority)
- `epistemics.md`
- `constitution.md`, `axioms.md`
- `interaction-modes.md`, `voice.md`
- `continuity-facts.yaml`

Recovered artifacts are available for retrieval under controlled conditions.
They do not govern runtime behavior.
