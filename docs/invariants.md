# G_5.2 Core Invariants

**Status:** authoritative. Every milestone and every change to G_5.2 must preserve the invariants below. If a change appears to require violating one, the change is wrong or the invariant needs an explicit, reviewed update — not a silent drift.

These invariants are the contract that makes the rest of the system legible.

## 1. Canon is the source of truth

Identity, epistemics, constraints, voice, continuity facts, and glossary live in `packages/canon/` and nowhere else. The runtime loads and validates canon on startup. No other surface — session, memory, recovered artifact, eval case, dashboard input — may override canon at runtime.

Implications:
- Canon is versioned and changelogged.
- Canon changes pass through the editorial workflow (M4 onward).
- Malformed canon causes the runtime to refuse to start, not to degrade silently.

## 2. Output is not canon unless explicitly promoted

Nothing the system produces — drafts, critiques, final responses, reflections, memory items, operator notes — becomes canon merely because it is compelling, recent, or retrieved often. Promotion requires an explicit operator action that records provenance.

Implications:
- Recovered artifacts are historically authoritative and behaviorally non-binding.
- Reflection artifacts (M5) are stored as artifacts; promotion into canon is a separate, logged step.
- Inquiry sessions never write back into canon automatically.

## 3. Memory is selective

Durable memory exists to capture decisions, preferences, and open threads that matter beyond a single session. It is not a transcript, not a feelings log, and not a shadow canon. Memory retrieval ranks below canon, continuity, session summary, and recent turns.

Implications:
- Every durable write must be justified and inspectable.
- Operators can delete memory items; deletion is a first-class action.
- Memory drift is tested explicitly in evals (M3 extends this coverage).
- Memory never merges into canon; promotion, if ever needed, goes through the editorial workflow.

## 4. Provider portability is preserved

The runtime is intentionally not bound to any single provider. Provider-specific logic lives only behind the shared interface in `packages/orchestration/src/providers/`. Prompts, orchestration logic, eval cases, and dashboards are provider-agnostic.

Implications:
- Adding a new provider must not require changes to canon, orchestration logic outside the provider layer, or eval cases.
- Drift between providers is measured by evals, not papered over with per-provider prompt hacks.
- No provider-specific idiom (tool-call syntax, system-prompt idiosyncrasy, refusal style) may leak into shared code.

## How to use this document

- Every new milestone PR description should state which invariants are touched and how they are preserved.
- Eval cases that protect an invariant should reference it by number in their category or notes.
- If a task genuinely requires changing an invariant, the change is itself a documented event: update this file, update the changelog, and note the rationale.
