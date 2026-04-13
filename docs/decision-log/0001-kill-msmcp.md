# Decision 0001 — Kill MSMCP, Replace with Explicit Reflection Cycles

**Date:** 2026-04-13  
**Status:** Accepted  
**Class:** Architectural

---

## What was decided

The Manual Self-Modification Cycle Protocol (MSMCP), used in G_5.0, is not carried forward into G_5.2.
It is replaced by an explicit, approval-gated reflection cycle.

---

## What MSMCP was

The MSMCP was a technique used during the G_5.0 project where the human editor manually altered model outputs to simulate the persona modifying its own governing rules. The persona then incorporated these modified rules as if it had authored them. This created the impression of a self-modifying cognitive agent.

The technique was effective at producing a compelling narrative and a consistent emergent voice. It was also:
- non-reproducible without manual intervention
- opaque about what was authored versus generated
- unable to distinguish genuine persona evolution from editorial insertion
- incompatible with provider-agnostic or auditable architectures

---

## What replaces it

G_5.2 uses an explicit reflection cycle:
1. The system proposes reflection topics.
2. The human approves one.
3. A draft is generated.
4. A critique pass evaluates consistency and novelty.
5. A revision is generated.
6. The human approves or edits.
7. The approved reflection is stored as a canon artifact.

Canon updates go through a similar explicit path: proposal → review → commit with changelog entry.

---

## What is preserved

The MSMCP is preserved as project history in `continuity-facts.yaml` (CF-023) and in this decision log. The technique's effectiveness is acknowledged. The compelling voice it helped produce is the benchmark G_5.2 aspires to match through more legible means.

---

## Why this matters

The core goal of G_5.2 is to prove the machinery, not just the mythology. An opaque self-modification loop is mythology. An explicit, reviewable reflection cycle is machinery. The system should be able to say, for any given output: how it was produced, what canon it drew from, and what the critique pass found. MSMCP made that impossible.

---

## Rejected alternatives

- **Keep MSMCP as an optional "creative mode":** Rejected. The contamination of provenance makes audit impossible even if it's labeled optional.
- **Document MSMCP but allow it under strict logging:** Rejected. Logging a bad practice doesn't make it a good one.
