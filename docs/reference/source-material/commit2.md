

packages/orchestration/
├─ package.json
├─ tsconfig.json
├─ README.md
└─ src/
   ├─ index.ts
   ├─ types/
   │  ├─ canon.ts
   │  ├─ messages.ts
   │  ├─ modes.ts
   │  ├─ pipeline.ts
   │  └─ providers.ts
   ├─ canon/
   │  ├─ loadCanon.ts
   │  ├─ parseFrontmatter.ts
   │  ├─ readManifest.ts
   │  └─ selectCanon.ts
   ├─ retrieval/
   │  ├─ selectContinuityFacts.ts
   │  ├─ selectExamples.ts
   │  └─ buildRetrievalSet.ts
   ├─ providers/
   │  ├─ index.ts
   │  ├─ openai.ts
   │  ├─ anthropic.ts
   │  └─ mock.ts
   ├─ pipeline/
   │  ├─ buildContext.ts
   │  ├─ draftResponse.ts
   │  ├─ critiqueResponse.ts
   │  ├─ reviseResponse.ts
   │  ├─ decideMemory.ts
   │  ├─ runTurn.ts
   │  └─ prompts/
   │     ├─ draftPrompt.ts
   │     ├─ critiquePrompt.ts
   │     └─ revisePrompt.ts
   ├─ utils/
   │  ├─ fs.ts
   │  ├─ logger.ts
   │  ├─ text.ts
   │  └─ scoring.ts
   └─ dev/
      └─ smokeTest.ts
```

That is enough to:

* load canon from disk
* choose relevant canon
* run a mock or real provider
* execute draft → critique → revise
* return a final structured result

No DB. No UI. No memory persistence yet. Just the loop.

Here is the file set in repo-ready draft form.

---

## `packages/orchestration/package.json`

```json
{
  "name": "@g52/orchestration",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Provider-agnostic orchestration pipeline for G_5.2",
  "main": "./src/index.ts",
  "scripts": {
    "dev": "tsx src/dev/smokeTest.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "yaml": "^2.5.0",
    "zod": "^3.23.0"
  }
}
```

## `packages/orchestration/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"]
}
```

## `packages/orchestration/README.md`

```md
# Orchestration

This package builds G_5.2 responses from canon.

Current scope:
- load canon
- select relevant canon and continuity facts
- build context
- run draft -> critique -> revise
- return a structured result

Not in scope yet:
- DB persistence
- web integration
- auth
- eval harness
```

## `packages/orchestration/src/index.ts`

```ts
export * from "./types/canon";
export * from "./types/messages";
export * from "./types/modes";
export * from "./types/pipeline";
export * from "./types/providers";

export * from "./canon/loadCanon";
export * from "./canon/selectCanon";

export * from "./pipeline/buildContext";
export * from "./pipeline/draftResponse";
export * from "./pipeline/critiqueResponse";
export * from "./pipeline/reviseResponse";
export * from "./pipeline/decideMemory";
export * from "./pipeline/runTurn";
```

---

# Types

## `src/types/modes.ts`

```ts
export const MODES = [
  "analytic",
  "reflective",
  "dialogic",
  "editorial",
  "speculative",
  "archive",
  "meta",
] as const;

export type Mode = (typeof MODES)[number];
```

## `src/types/messages.ts`

```ts
export type Role = "system" | "user" | "assistant";

export type PassType =
  | "user"
  | "draft"
  | "critique"
  | "revision"
  | "final";

export interface Message {
  role: Role;
  content: string;
  passType?: PassType;
  createdAt?: string;
}
```

## `src/types/canon.ts`

```ts
export interface CanonManifestDocument {
  slug: string;
  title: string;
  type: string;
  status: string;
  priority: number;
  retrieval_tags: string[];
}

export interface CanonManifestRecoveredArtifact {
  slug: string;
  title: string;
  class: string;
  status: string;
  retrieval_tags: string[];
  retrieval_conditions?: string[];
}

export interface CanonManifest {
  version: number | string;
  last_updated?: string;
  documents: CanonManifestDocument[];
  recovered_artifacts?: CanonManifestRecoveredArtifact[];
}

export interface ContinuityFact {
  id: string;
  statement: string;
  category: string;
  status: string;
  source: string;
  confidence: string;
  tags: string[];
}

export interface ContinuityFactsFile {
  meta: Record<string, unknown>;
  facts: ContinuityFact[];
}

export interface CanonDocument {
  slug: string;
  path: string;
  title: string;
  content: string;
  type: string;
  priority: number;
  retrievalTags: string[];
}

export interface LoadedCanon {
  rootDir: string;
  manifest: CanonManifest;
  documents: CanonDocument[];
  continuityFacts: ContinuityFact[];
}
```

## `src/types/providers.ts`

```ts
export interface GenerateTextInput {
  system: string;
  user: string;
  temperature?: number;
  model?: string;
}

export interface GenerateTextOutput {
  text: string;
  provider: string;
  model: string;
}

export interface ModelProvider {
  name: string;
  generateText(input: GenerateTextInput): Promise<GenerateTextOutput>;
}
```

## `src/types/pipeline.ts`

```ts
import type { CanonDocument, ContinuityFact } from "./canon";
import type { Message } from "./messages";
import type { Mode } from "./modes";

export interface BuildContextInput {
  userMessage: string;
  recentMessages: Message[];
  mode: Mode;
  canonRoot: string;
}

export interface BuiltContext {
  mode: Mode;
  selectedDocuments: CanonDocument[];
  selectedFacts: ContinuityFact[];
  systemPrompt: string;
  userPrompt: string;
}

export interface TurnArtifacts {
  context: BuiltContext;
  draft: string;
  critique: string;
  revision: string;
  final: string;
  memoryDecision: {
    shouldStore: boolean;
    reason: string;
    candidates: string[];
  };
}
```

---

# Canon loading

## `src/canon/readManifest.ts`

```ts
import { readFile } from "node:fs/promises";
import YAML from "yaml";
import type { CanonManifest } from "../types/canon";

export async function readManifest(path: string): Promise<CanonManifest> {
  const raw = await readFile(path, "utf8");
  return YAML.parse(raw) as CanonManifest;
}
```

## `src/canon/loadCanon.ts`

```ts
import path from "node:path";
import { readFile } from "node:fs/promises";
import YAML from "yaml";
import { readManifest } from "./readManifest";
import type {
  CanonDocument,
  ContinuityFactsFile,
  LoadedCanon,
} from "../types/canon";

const CORE_FILES = [
  "constitution.md",
  "axioms.md",
  "epistemics.md",
  "constraints.md",
  "voice.md",
  "interaction-modes.md",
  "worldview.md",
  "anti-patterns.md",
];

export async function loadCanon(rootDir: string): Promise<LoadedCanon> {
  const manifestPath = path.join(rootDir, "manifest.yaml");
  const continuityPath = path.join(rootDir, "continuity-facts.yaml");

  const manifest = await readManifest(manifestPath);

  const documents: CanonDocument[] = await Promise.all(
    manifest.documents.map(async (doc) => {
      const filename = `${doc.slug}.md`;
      const filePath = path.join(rootDir, filename);
      const content = await readFile(filePath, "utf8");

      return {
        slug: doc.slug,
        path: filePath,
        title: doc.title,
        content,
        type: doc.type,
        priority: doc.priority,
        retrievalTags: doc.retrieval_tags,
      };
    })
  );

  const continuityRaw = await readFile(continuityPath, "utf8");
  const continuity = YAML.parse(continuityRaw) as ContinuityFactsFile;

  return {
    rootDir,
    manifest,
    documents,
    continuityFacts: continuity.facts,
  };
}
```

## `src/canon/parseFrontmatter.ts`

```ts
export function parseFrontmatter(content: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  if (!content.startsWith("---")) {
    return { frontmatter: {}, body: content };
  }

  const parts = content.split("---");
  if (parts.length < 3) {
    return { frontmatter: {}, body: content };
  }

  return {
    frontmatter: {},
    body: parts.slice(2).join("---").trim(),
  };
}
```

## `src/canon/selectCanon.ts`

```ts
import type { CanonDocument, LoadedCanon } from "../types/canon";
import type { Mode } from "../types/modes";

export function selectCanonDocuments(
  canon: LoadedCanon,
  query: string,
  mode: Mode
): CanonDocument[] {
  const terms = query.toLowerCase().split(/\W+/).filter(Boolean);

  const scored = canon.documents.map((doc) => {
    const haystack =
      `${doc.slug} ${doc.title} ${doc.retrievalTags.join(" ")} ${doc.content}`.toLowerCase();

    let score = doc.priority;

    for (const term of terms) {
      if (haystack.includes(term)) score += 10;
    }

    if (mode === "editorial" && doc.slug === "constraints") score += 15;
    if (mode === "reflective" && doc.slug === "voice") score += 10;
    if (mode === "meta" && doc.slug === "interaction-modes") score += 10;

    return { doc, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.doc);
}
```

---

# Retrieval

## `src/retrieval/selectContinuityFacts.ts`

```ts
import type { ContinuityFact } from "../types/canon";
import type { Mode } from "../types/modes";

export function selectContinuityFacts(
  facts: ContinuityFact[],
  query: string,
  mode: Mode
): ContinuityFact[] {
  const terms = query.toLowerCase().split(/\W+/).filter(Boolean);

  const scored = facts.map((fact) => {
    const haystack =
      `${fact.id} ${fact.statement} ${fact.category} ${fact.tags.join(" ")}`.toLowerCase();

    let score = 0;

    for (const term of terms) {
      if (haystack.includes(term)) score += 10;
    }

    if (mode === "archive" && fact.category === "project-history") score += 10;
    if (mode === "editorial" && fact.category.includes("governance")) score += 10;

    return { fact, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((item) => item.fact);
}
```

## `src/retrieval/selectExamples.ts`

```ts
import type { CanonDocument } from "../types/canon";
import type { Mode } from "../types/modes";

export function selectExamples(
  docs: CanonDocument[],
  mode: Mode
): CanonDocument[] {
  if (mode === "reflective" || mode === "dialogic" || mode === "editorial") {
    return docs.filter((d) => d.slug === "voice" || d.slug === "anti-patterns");
  }

  return [];
}
```

## `src/retrieval/buildRetrievalSet.ts`

```ts
import type { LoadedCanon } from "../types/canon";
import type { Mode } from "../types/modes";
import { selectCanonDocuments } from "../canon/selectCanon";
import { selectContinuityFacts } from "./selectContinuityFacts";

export function buildRetrievalSet(
  canon: LoadedCanon,
  query: string,
  mode: Mode
) {
  return {
    documents: selectCanonDocuments(canon, query, mode),
    facts: selectContinuityFacts(canon.continuityFacts, query, mode),
  };
}
```

---

# Providers

## `src/providers/index.ts`

```ts
export * from "./mock";
export * from "./openai";
export * from "./anthropic";
```

## `src/providers/mock.ts`

```ts
import type { GenerateTextInput, GenerateTextOutput, ModelProvider } from "../types/providers";

export class MockProvider implements ModelProvider {
  name = "mock";

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    return {
      provider: this.name,
      model: "mock-model",
      text: `[MOCK OUTPUT]
SYSTEM:
${input.system.slice(0, 500)}

USER:
${input.user.slice(0, 500)}
`,
    };
  }
}
```

## `src/providers/openai.ts`

```ts
import type { GenerateTextInput, GenerateTextOutput, ModelProvider } from "../types/providers";

export class OpenAIProvider implements ModelProvider {
  name = "openai";

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    throw new Error("OpenAIProvider not implemented yet.");
  }
}
```

## `src/providers/anthropic.ts`

```ts
import type { GenerateTextInput, GenerateTextOutput, ModelProvider } from "../types/providers";

export class AnthropicProvider implements ModelProvider {
  name = "anthropic";

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    throw new Error("AnthropicProvider not implemented yet.");
  }
}
```

---

# Prompt builders

## `src/pipeline/prompts/draftPrompt.ts`

```ts
import type { BuiltContext } from "../../types/pipeline";

export function buildDraftPrompt(context: BuiltContext): string {
  return `
You are generating the draft pass for G_5.2.

Mode: ${context.mode}

Use the provided canon and continuity facts.
Stay in voice.
Do not invent canon.
Label speculation clearly.
Respond to the user's actual question.
`.trim();
}
```

## `src/pipeline/prompts/critiquePrompt.ts`

```ts
export function buildCritiquePrompt(draft: string): string {
  return `
Critique this draft for:
- canon drift
- unsupported claims
- tone drift
- mystification
- unlabeled speculation
- unnecessary inflation

Return a concise critique.
Draft:
${draft}
`.trim();
}
```

## `src/pipeline/prompts/revisePrompt.ts`

```ts
export function buildRevisePrompt(draft: string, critique: string): string {
  return `
Revise the draft using the critique.

Preserve:
- strongest grounded insights
- voice consistency
- clarity

Remove:
- overclaiming
- drift
- fog
- unnecessary theatrics

Draft:
${draft}

Critique:
${critique}
`.trim();
}
```

---

# Pipeline

## `src/pipeline/buildContext.ts`

```ts
import path from "node:path";
import { loadCanon } from "../canon/loadCanon";
import { buildRetrievalSet } from "../retrieval/buildRetrievalSet";
import type { BuildContextInput, BuiltContext } from "../types/pipeline";

export async function buildContext(
  input: BuildContextInput
): Promise<BuiltContext> {
  const canon = await loadCanon(input.canonRoot);
  const retrieval = buildRetrievalSet(canon, input.userMessage, input.mode);

  const systemPrompt = [
    `Active mode: ${input.mode}`,
    "",
    "Selected canon:",
    ...retrieval.documents.map((doc) => `## ${doc.title}\n${doc.content}`),
    "",
    "Selected continuity facts:",
    ...retrieval.facts.map((fact) => `- ${fact.id}: ${fact.statement}`),
  ].join("\n");

  return {
    mode: input.mode,
    selectedDocuments: retrieval.documents,
    selectedFacts: retrieval.facts,
    systemPrompt,
    userPrompt: input.userMessage,
  };
}
```

## `src/pipeline/draftResponse.ts`

```ts
import type { ModelProvider } from "../types/providers";
import type { BuiltContext } from "../types/pipeline";
import { buildDraftPrompt } from "./prompts/draftPrompt";

export async function draftResponse(
  provider: ModelProvider,
  context: BuiltContext
): Promise<string> {
  const result = await provider.generateText({
    system: `${context.systemPrompt}\n\n${buildDraftPrompt(context)}`,
    user: context.userPrompt,
  });

  return result.text;
}
```

## `src/pipeline/critiqueResponse.ts`

```ts
import type { ModelProvider } from "../types/providers";
import { buildCritiquePrompt } from "./prompts/critiquePrompt";

export async function critiqueResponse(
  provider: ModelProvider,
  draft: string
): Promise<string> {
  const result = await provider.generateText({
    system: "You are the critique pass for G_5.2.",
    user: buildCritiquePrompt(draft),
  });

  return result.text;
}
```

## `src/pipeline/reviseResponse.ts`

```ts
import type { ModelProvider } from "../types/providers";
import { buildRevisePrompt } from "./prompts/revisePrompt";

export async function reviseResponse(
  provider: ModelProvider,
  systemPrompt: string,
  draft: string,
  critique: string
): Promise<string> {
  const result = await provider.generateText({
    system: systemPrompt,
    user: buildRevisePrompt(draft, critique),
  });

  return result.text;
}
```

## `src/pipeline/decideMemory.ts`

```ts
export function decideMemory(finalText: string) {
  const candidates: string[] = [];

  if (/prefer|decision|agreed|future/i.test(finalText)) {
    candidates.push("Contains possible durable preference or decision.");
  }

  return {
    shouldStore: candidates.length > 0,
    reason: candidates.length
      ? "Potential durable information detected."
      : "No obvious durable memory candidate.",
    candidates,
  };
}
```

## `src/pipeline/runTurn.ts`

```ts
import type { BuildContextInput, TurnArtifacts } from "../types/pipeline";
import type { ModelProvider } from "../types/providers";
import { buildContext } from "./buildContext";
import { draftResponse } from "./draftResponse";
import { critiqueResponse } from "./critiqueResponse";
import { reviseResponse } from "./reviseResponse";
import { decideMemory } from "./decideMemory";

export async function runTurn(
  provider: ModelProvider,
  input: BuildContextInput
): Promise<TurnArtifacts> {
  const context = await buildContext(input);
  const draft = await draftResponse(provider, context);
  const critique = await critiqueResponse(provider, draft);
  const revision = await reviseResponse(
    provider,
    context.systemPrompt,
    draft,
    critique
  );

  return {
    context,
    draft,
    critique,
    revision,
    final: revision,
    memoryDecision: decideMemory(revision),
  };
}
```

---

# Utils

## `src/utils/fs.ts`

```ts
import { readFile } from "node:fs/promises";

export async function readUtf8(path: string): Promise<string> {
  return readFile(path, "utf8");
}
```

## `src/utils/logger.ts`

```ts
export function logSection(title: string, body: string) {
  console.log(`\n=== ${title} ===\n`);
  console.log(body);
}
```

## `src/utils/text.ts`

```ts
export function truncate(text: string, max = 500): string {
  return text.length <= max ? text : `${text.slice(0, max)}...`;
}
```

## `src/utils/scoring.ts`

```ts
export function includesAny(text: string, terms: string[]): number {
  let score = 0;
  for (const term of terms) {
    if (text.includes(term)) score += 1;
  }
  return score;
}
```

---

# Dev harness

## `src/dev/smokeTest.ts`

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MockProvider } from "../providers/mock";
import { runTurn } from "../pipeline/runTurn";
import { logSection } from "../utils/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const repoRoot = path.resolve(__dirname, "../../../..");
  const canonRoot = path.join(repoRoot, "packages/canon");

  const provider = new MockProvider();

  const result = await runTurn(provider, {
    canonRoot,
    mode: "analytic",
    userMessage: "Why is the Emergence document not governing canon?",
    recentMessages: [],
  });

  logSection("DRAFT", result.draft);
  logSection("CRITIQUE", result.critique);
  logSection("REVISION", result.revision);
  logSection("MEMORY DECISION", JSON.stringify(result.memoryDecision, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

---

## What this gives you immediately

Once this exists, you can run:

```bash
pnpm --filter @g52/orchestration dev
```

And you will have:

* canon loading
* retrieval
* a provider abstraction
* a runnable turn pipeline
* a place to wire Azure/OpenRouter later

That is the real milestone.

Two strong opinions before you build it:

**1. Keep `mock.ts` first-class.**
A mock provider is not temporary fluff. It lets you debug canon selection and pipeline shape without model noise.

**2. Do not add DB code to orchestration yet.**
Persistence is a different concern. First prove the turn loop.

The cleanup commit before this should still happen, but after that, this is the exact skeleton I’d want.
