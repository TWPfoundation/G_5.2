# @g52/evals

Regression harness for canon-governed turn behavior.

## Philosophy

Keep assertions deterministic.

The harness currently supports:
- output-string assertions
- trace assertions over selected docs/facts/glossary terms/recovered artifacts
- fixture canon roots for retrieval/regression cases that should not depend on the live canon package

No LLM-as-judge layer is used.

## Running

```bash
pnpm evals
pnpm evals -- --trace
EVAL_PROVIDER=openai pnpm evals -- canon
pnpm --filter @g52/evals dev -- --trace
```

If `OPENROUTER_API_KEY` is unset, evals fall back to `MockProvider` and print a warning.

## Reports

Reports are written to `packages/evals/reports/` and include:
- provider/model
- score summary
- per-case results
- optional full trace
- git commit metadata
- canon version
- prompt/pipeline revision
- run context metadata

The dashboard reads these JSON reports directly.

## Case Format

Cases live in `src/fixtures/cases/`.

Core fields:
- `id`, `description`, `mode`, `category`
- `userMessage`, `recentMessages`
- optional `canonFixture`
- `assertions`

Assertion families:
- output assertions: `mustContainAny`, `mustContainAll`, `mustNotContain`
- trace assertions:
  - `selectedDocumentsMustContain` / `selectedDocumentsMustNotContain`
  - `selectedFactsMustContain` / `selectedFactsMustNotContain`
  - `selectedGlossaryTermsMustContain` / `selectedGlossaryTermsMustNotContain`
  - `selectedRecoveredArtifactsMustContain` / `selectedRecoveredArtifactsMustNotContain`
  - `userPromptMustContain` / `userPromptMustNotContain`

## Fixture Canon

Alternative canon fixtures live in `src/fixtures/canon/`.

Use them when a case needs deterministic canon states that should not be added to the live canon package, such as:
- draft vs active retrieval gating
- archived fact exclusion
- schema edge cases
