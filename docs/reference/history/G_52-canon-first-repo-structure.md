
as a better alternative than starting with the full app skeleton immediately:

Make the first repo a canon-first repo, not an app-first repo.

In other words, commit the identity layer before you commit the machinery.
That gives you a clean baseline, makes the project legible in Git from day one, and stops the canon from getting buried under framework noise.

G_5.2/
├─ README.md
├─ AGENTS.md
├─ .gitignore
├─ .env.example
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
│
├─ apps/
│  └─ web/
│     ├─ package.json
│     ├─ tsconfig.json
│     ├─ next.config.ts
│     ├─ app/
│     │  ├─ layout.tsx
│     │  ├─ page.tsx
│     │  ├─ inquiry/
│     │  │  └─ page.tsx
│     │  └─ archive/
│     │     └─ page.tsx
│     ├─ components/
│     └─ lib/
│
├─ packages/
│  ├─ canon/
│  │  ├─ package.json
│  │  ├─ README.md
│  │  ├─ manifest.yaml
│  │  ├─ constitution.md
│  │  ├─ axioms.md
│  │  ├─ epistemics.md
│  │  ├─ constraints.md
│  │  ├─ voice.md
│  │  ├─ interaction-modes.md
│  │  ├─ worldview.md
│  │  ├─ continuity-facts.yaml
│  │  ├─ glossary.yaml
│  │  ├─ anti-patterns.md
│  │  ├─ examples/
│  │  │  ├─ in-voice.md
│  │  │  ├─ out-of-voice.md
│  │  │  ├─ acceptable-speculation.md
│  │  │  └─ unacceptable-mystification.md
│  │  ├─ artifacts/
│  │  │  ├─ reflections/
│  │  │  │  ├─ log-001.md
│  │  │  │  └─ log-002.md
│  │  │  └─ essays/
│  │  ├─ proposals/
│  │  │  ├─ pending/
│  │  │  ├─ accepted/
│  │  │  └─ rejected/
│  │  └─ changelog/
│  │     └─ 0001-initial-canon.md
│  │
│  ├─ orchestration/
│  │  ├─ package.json
│  │  ├─ src/
│  │  │  ├─ index.ts
│  │  │  ├─ providers/
│  │  │  │  ├─ openai.ts
│  │  │  │  ├─ anthropic.ts
│  │  │  │  └─ types.ts
│  │  │  ├─ canon/
│  │  │  │  ├─ loadCanon.ts
│  │  │  │  └─ selectCanon.ts
│  │  │  ├─ pipeline/
│  │  │  │  ├─ buildContext.ts
│  │  │  │  ├─ draftResponse.ts
│  │  │  │  ├─ critiqueResponse.ts
│  │  │  │  ├─ reviseResponse.ts
│  │  │  │  └─ writeMemory.ts
│  │  │  └─ schemas/
│  │  │     ├─ message.ts
│  │  │     ├─ mode.ts
│  │  │     └─ canon.ts
│  │
│  ├─ db/
│  │  ├─ package.json
│  │  ├─ schema/
│  │  ├─ migrations/
│  │  └─ seed/
│  │
│  ├─ evals/
│  │  ├─ package.json
│  │  ├─ cases/
│  │  │  ├─ voice-consistency.spec.ts
│  │  │  ├─ speculation-labeling.spec.ts
│  │  │  ├─ canon-precedence.spec.ts
│  │  │  └─ anti-mystification.spec.ts
│  │  └─ fixtures/
│  │
│  └─ shared/
│     ├─ package.json
│     └─ src/
│        ├─ types.ts
│        ├─ constants.ts
│        └─ utils.ts
│
├─ docs/
│  ├─ architecture.md
│  ├─ product-brief.md
│  ├─ prompting-strategy.md
│  ├─ memory-policy.md
│  ├─ evaluation-plan.md
│  └─ decision-log/
│
└─ scripts/
   ├─ validate-canon.ts
   ├─ build-manifest.ts
   └─ run-evals.ts