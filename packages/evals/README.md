# @g52/evals

Regression harness for product-aware governed turn behavior.

## Philosophy

Keep assertions deterministic.

The harness currently supports:
- output-string assertions
- trace assertions over selected docs/facts/glossary terms/recovered artifacts
- fixture policy roots for retrieval/regression cases that should not depend on the live packages
- Witness runtime evals for consent gating and product-root isolation

No LLM-as-judge layer is used.

## Running

```bash
pnpm evals
pnpm evals -- --trace
EVAL_PROVIDER=azure pnpm evals -- witness
EVAL_PROVIDER=openai pnpm evals -- canon
pnpm --filter @g52/evals dev -- --trace
```

If neither Azure nor OpenRouter credentials are configured, evals fall back to `MockProvider` and print a warning.

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
- optional `runner` (`turn` by default, or `witness-runtime`)
- optional `product` (`pes` by default, or `witness`)
- `userMessage`, `recentMessages`
- optional `policyFixture`
- optional legacy `canonFixture` alias
- optional `witnessId`, `consentFixture`, `runtimeAssertions` for Witness runtime cases
- `assertions`

Assertion families:
- output assertions: `mustContainAny`, `mustContainAll`, `mustNotContain`
- trace assertions:
  - `selectedDocumentsMustContain` / `selectedDocumentsMustNotContain`
  - `selectedFactsMustContain` / `selectedFactsMustNotContain`
  - `selectedGlossaryTermsMustContain` / `selectedGlossaryTermsMustNotContain`
  - `selectedRecoveredArtifactsMustContain` / `selectedRecoveredArtifactsMustNotContain`
  - `selectedRecoveredArtifactsMustBeEmpty`
  - `userPromptMustContain` / `userPromptMustNotContain`

Witness-specific reporting:
- `witness-policy` subsystem for Witness policy-root retrieval/prompt/output cases
- `witness-runtime` subsystem for consent/testimony/session/snapshot boundary cases

## Fixture Canon

Alternative policy fixtures live in `src/fixtures/canon/`.

Use them when a case needs deterministic canon states that should not be added to the live canon package, such as:
- draft vs active retrieval gating
- archived fact exclusion
- schema edge cases

Witness consent fixtures live in `src/fixtures/witness/consent/`.
