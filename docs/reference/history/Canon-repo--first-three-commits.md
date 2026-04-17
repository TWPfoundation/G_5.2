
**Make the first repo a canon-first repo, not an app-first repo.**

In other words, commit the identity layer before you commit the machinery.
That gives you a clean baseline, makes the project legible in Git from day one, and stops the canon from getting buried under framework noise.

## The shape I’d use

```text
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
```

## My real recommendation

Do **not** build all of that on day one.

Do this in three commits:

### Commit 1 — canon-only

Create only:

* root files
* `packages/canon`
* `docs/product-brief.md`
* `AGENTS.md`

No app. No orchestration. No DB.

This is the best starting point because it forces the project to define itself before it starts performing.

### Commit 2 — orchestration skeleton

Add:

* `packages/orchestration`
* provider interfaces
* canon loader
* context builder stubs
* no UI yet, maybe a CLI script only

### Commit 3 — thin web app

Add:

* `apps/web`
* a minimal inquiry page
* a minimal archive page
* no editorial studio yet

That order matters. Otherwise the repo becomes 80% framework and 20% intention, which is how these things go feral.

## What the canon package should look like in a real repo

This is the part you asked for most directly.

### `packages/canon/package.json`

```json
{
  "name": "@g52/canon",
  "version": "0.1.0",
  "private": true,
  "type": "module"
}
```

### `packages/canon/README.md`

```md
# Canon Package

This package contains the source-of-truth identity layer for G_5.2.

It defines:
- identity
- voice
- epistemics
- constraints
- continuity
- approved artifacts
- change history

Rules:
- Output is not canon unless explicitly promoted.
- Higher-order canon outranks artifacts.
- Canon changes must be explicit and reviewable.
```

### `packages/canon/manifest.yaml`

This is the registry. It keeps retrieval sane.

```yaml
version: 0.1
documents:
  - slug: constitution
    title: Constitution
    type: foundation
    status: active
    priority: 100
    retrieval_tags: [identity, foundation]

  - slug: axioms
    title: Axioms
    type: foundation
    status: active
    priority: 95
    retrieval_tags: [identity, principles]

  - slug: epistemics
    title: Epistemics
    type: governance
    status: active
    priority: 100
    retrieval_tags: [evidence, uncertainty, speculation]

  - slug: constraints
    title: Constraints
    type: governance
    status: active
    priority: 100
    retrieval_tags: [boundaries, drift, anti-patterns]

  - slug: voice
    title: Voice
    type: style
    status: active
    priority: 80
    retrieval_tags: [tone, style]

  - slug: interaction-modes
    title: Interaction Modes
    type: behavior
    status: active
    priority: 85
    retrieval_tags: [mode, behavior]

  - slug: worldview
    title: Worldview
    type: interpretation
    status: active
    priority: 70
    retrieval_tags: [interpretation, philosophy]

  - slug: continuity-facts
    title: Continuity Facts
    type: continuity
    status: active
    priority: 90
    retrieval_tags: [history, continuity]
```

### `packages/canon/changelog/0001-initial-canon.md`

```md
# 0001 — Initial canon

## Summary
Initial canon bootstrap for G_5.2.

## Added
- constitution
- axioms
- epistemics
- constraints
- voice
- interaction modes
- continuity facts

## Rationale
Establish identity before runtime behavior.
Prevent the system from depending on improvised continuity.
```

### `packages/canon/glossary.yaml`

Keep this brutally plain.

```yaml
terms:
  - term: canon
    definition: "The maintained source-of-truth identity and continuity layer."

  - term: artifact
    definition: "An approved reflection, essay, or recovered text that is preserved as reference but does not automatically define system behavior."

  - term: continuity
    definition: "Stable established facts about project history, persona history, or governing decisions."

  - term: memory
    definition: "Durable information retained from interaction that is useful across sessions but is not equivalent to canon."

  - term: runtime state
    definition: "Short-lived operating context for the current interaction."

  - term: promotion
    definition: "The explicit act of moving content from output or proposal into active canon."
```

### `packages/canon/anti-patterns.md`

This one will save your ass later.

```md
# Anti-Patterns

## Empty mysticism
Language that implies depth while avoiding mechanism or evidence.

## Canon creep
Treating good output as governing truth without explicit promotion.

## Lore inflation
Expanding continuity faster than the system can meaningfully maintain it.

## Ontology by style
Treating a strong voice as proof of hidden capability or metaphysical status.

## Mood over mechanism
Preferring aesthetic coherence to system legibility.

## Drift by accumulation
Allowing repeated phrasing or improvisation to silently redefine identity.
```

## What each canon file is actually for

You need hard boundaries here.

`constitution.md`
Defines what G_5.2 is for.

`axioms.md`
Defines its deepest stable principles.

`epistemics.md`
Defines how it handles evidence, uncertainty, and speculation.

`constraints.md`
Defines what it is not allowed to do, imply, or drift into.

`voice.md`
Defines how it sounds.

`interaction-modes.md`
Defines how posture changes across contexts.

`worldview.md`
Defines recurring interpretive stance, not hard rules.

`continuity-facts.yaml`
Defines stable facts worth retrieving often.

`artifacts/`
Stores approved reflections and essays.

`proposals/`
Stores material under review so active canon stays clean.

`changelog/`
Makes evolution explicit rather than spooky.

## How I’d bootstrap it locally

Start with this exact command flow:

```bash
mkdir G_5.2
cd G_5.2
git init
pnpm init
mkdir -p packages/canon/examples
mkdir -p packages/canon/artifacts/reflections
mkdir -p packages/canon/artifacts/essays
mkdir -p packages/canon/proposals/{pending,accepted,rejected}
mkdir -p packages/canon/changelog
mkdir -p docs
touch README.md AGENTS.md pnpm-workspace.yaml turbo.json .gitignore .env.example
```

Then create only the canon files and docs first.

That first commit should feel almost disappointingly plain.
That is how you know it is correct.

## What I’d put in the root `README.md`

```md
# G_5.2

G_5.2 is a structured inquiry system built around a versioned authored persona.

This repository is organized around a canon-first architecture:
- canon defines identity
- orchestration builds responses
- memory is selective
- outputs require explicit promotion to become canon

The first goal is coherence, not theatrical complexity.
```


**Do not connect the repo to live provider code on day one.**
