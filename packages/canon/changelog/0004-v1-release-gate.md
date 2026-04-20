# 0004 — V1 Release Gate

**Date:** 2026-04-20  
**Class:** Release Gate  
**Author:** Codex  
**Status:** Committed

---

## Summary

This entry records the formal `v1` release declaration for G_5.2 under the Azure-first operator scope.

Repo capability work through M8 is implemented on disk. The per-release-candidate gate for the in-scope provider set has now been satisfied on the Azure path, and the operator can run the system as designed end-to-end without repo surgery.

This is a release declaration, not a claim that every supported provider has already received a fresh same-day baseline on this branch.

---

## Release-gate basis

The declaration is grounded in:

- `docs/v1-release-checklist.md`
- `docs/release-candidate-baseline.md`
- `docs/release-notes/v1-rc-2026-04-20.md`
- `packages/evals/gold-baselines/azure-0.1.2.json`

For this declaration, the in-scope provider set is:

- `azure`

Explicitly out of scope for this declaration, pending live credentials and later RC capture:

- `anthropic`
- `openai`
- `gemini`

That scope is allowed by the release-gate docs. Section K is satisfied for the providers the operator considers in scope for the release candidate; it does not require same-day capture for providers that are explicitly out of scope.

---

## What was verified

On the release-candidate path leading to this declaration:

- `pnpm install`
- `pnpm validate:canon`
- `pnpm validate:witness`
- `pnpm typecheck`
- `pnpm test`
- `pnpm smoke`
- `EVAL_PROVIDER=azure pnpm evals -- --trace`

All passed on the clean Azure release-candidate commit recorded in `docs/release-notes/v1-rc-2026-04-20.md`.

The promoted Azure gold baseline for canon `0.1.2` is:

- `packages/evals/gold-baselines/azure-0.1.2.json`

---

## What v1 means here

For G_5.2, `v1` means:

- canon-governed inquiry runtime is implemented and operational
- Witness-first product split is real, not aspirational
- operator surfaces, persistence, memory governance, editorial workflow, reflection workflow, recovery docs, and smoke paths exist and are coherent
- the Azure-first release-candidate path is baseline-clean and promotable

It does **not** mean:

- public launch hardening is complete
- multi-user or hostile-user posture is solved
- every nominally supported provider has already been baseline-captured on this exact branch
- post-v1 roadmap items are pulled into the release gate

Those remain governed by `docs/post-v1-support-posture.md` and later RC capture work.

---

## Why this matters

The important transition here is from "implemented milestone stack" to "operator-declarable release."

Before this point, G_5.2 had the machinery but not the release-gate artifact chain. After this point, the repo has:

- the implemented runtime and governance surfaces
- the documented release criteria
- a clean Azure RC baseline and promoted gold anchor
- an explicit declaration tying those together

That is sufficient for a truthful `v1` declaration under the current Azure-first scope.

---

## Follow-up work

This declaration leaves intact the next portability tasks:

- capture Anthropic RC baseline once quota is available
- capture Gemini RC baseline once quota is available
- capture OpenAI-path RC baseline if it becomes part of the active operator scope
- continue normal post-v1 hardening without reopening the v1 threshold itself
