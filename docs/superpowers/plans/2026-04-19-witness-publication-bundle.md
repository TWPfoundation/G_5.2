# Witness Publication Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first operator-triggered Witness publication export workflow so a `publication_ready` archive candidate can produce a durable publication bundle without mutating the sealed testimony or any upstream Witness records.

**Architecture:** Keep the existing Witness governance chain intact and add one new downstream record type: `PublicationBundleRecord`. Publication export is read-only with respect to testimony, synthesis, annotations, and archive candidates. The server and dashboard get a small new publication panel and explicit endpoints, while orchestration owns bundle assembly, persistence, and file export.

**Tech Stack:** TypeScript, Node file-backed stores, existing `apps/dashboard` HTTP server, existing `packages/orchestration` Witness runtime, existing `packages/witness-types` domain package, Node test runner via `tsx --test`.

---

## File Structure

- Create: `packages/witness-types/src/publicationBundle.ts`
  Purpose: define the publication bundle record/status/store interfaces.
- Modify: `packages/witness-types/src/index.ts`
  Purpose: export the new publication bundle types.
- Modify: `packages/orchestration/src/products.ts`
  Purpose: add Witness `publicationBundleRoot`.
- Create: `packages/orchestration/src/witness/filePublicationBundleStore.ts`
  Purpose: file-backed store for publication bundle metadata records.
- Modify: `packages/orchestration/src/witness/fileDraftStores.ts`
  Purpose: re-export the publication bundle store next to the other Witness stores.
- Create: `packages/orchestration/src/witness/publicationRuntime.ts`
  Purpose: focused runtime helpers for create/list/load publication bundles and writing the exported JSON/Markdown artifacts.
- Modify: `packages/orchestration/src/witness/runtime.ts`
  Purpose: keep archive/runtime helpers available, but do not grow publication export logic inside this already-large file; only add minimal shared helpers if needed.
- Create: `packages/orchestration/src/witness/publicationRuntime.test.ts`
  Purpose: test bundle creation invariants, candidate gating, immutability, and output paths.
- Modify: `packages/orchestration/src/witness/fileStores.test.ts`
  Purpose: round-trip the new publication bundle store.
- Modify: `apps/dashboard/src/witnessRuntime.ts`
  Purpose: re-export publication runtime helpers for dashboard/smoke use.
- Modify: `apps/dashboard/src/server.ts`
  Purpose: add publication bundle endpoints and root resolution.
- Modify: `apps/dashboard/src/server.test.ts`
  Purpose: cover API semantics and Witness-root-only persistence.
- Modify: `apps/dashboard/public/inquiry.html`
  Purpose: add a publication/export panel scoped to the selected testimony/archive candidate.
- Modify: `scripts/smoke-tests.ts`
  Purpose: extend the Witness path through publication bundle creation.
- Modify: `README.md`
  Purpose: document the new Witness publication bundle root and operator capability.
- Modify: `docs/operator-handbook.md`
  Purpose: document publication bundle semantics and endpoints.

## Data Model Decision

Use one new record:

```ts
export type PublicationBundleStatus = "created";

export interface PublicationBundleRecord {
  id: string;
  witnessId: string;
  testimonyId: string;
  archiveCandidateId: string;
  sourceTestimonyUpdatedAt: string;
  sourceSynthesisId: string;
  sourceAnnotationId: string;
  createdAt: string;
  updatedAt: string;
  status: "created";
  bundleJsonPath: string;
  bundleMarkdownPath?: string;
}
```

Keep status simple in this slice. The archive candidate already carries governance state; the publication bundle is just the emitted artifact record.

## Export Shape Decision

Export two files per bundle:

- required JSON bundle
- optional Markdown companion

JSON bundle payload:

```ts
export interface WitnessPublicationBundle {
  schemaVersion: "0.1.0";
  witnessId: string;
  testimony: {
    id: string;
    updatedAt: string;
    title?: string;
    segments: Array<{
      id: string;
      role: "witness" | "inquisitor";
      text: string;
      createdAt: string;
    }>;
  };
  synthesis: {
    id: string;
    text: string;
    reviewNote?: string;
  };
  annotations: {
    id: string;
    entries: Array<{
      id: string;
      labelId: string;
      labelName: string;
      segmentId: string;
      startOffset: number;
      endOffset: number;
      quote: string;
      rationale?: string;
    }>;
  };
  archiveCandidate: {
    id: string;
    status: "publication_ready";
    testimonyUpdatedAt: string;
  };
}
```

Do not add website/export-target integration in this slice.

### Task 1: Add Publication Bundle Domain Types And Roots

**Files:**
- Create: `packages/witness-types/src/publicationBundle.ts`
- Modify: `packages/witness-types/src/index.ts`
- Modify: `packages/orchestration/src/products.ts`
- Test: `packages/orchestration/src/products.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these assertions to `packages/orchestration/src/products.test.ts`:

```ts
  assert.equal(
    registry.witness.publicationBundleRoot,
    path.join(repoRoot, "data", "witness", "publication-bundles")
  );
```

Add a new type-level import expectation by referencing the new export in a small compile-time test shape inside an existing test file:

```ts
import type { PublicationBundleRecord } from "../../../witness-types/src/publicationBundle";

const bundleShape: PublicationBundleRecord = {
  id: "bundle-1",
  witnessId: "wit-1",
  testimonyId: "testimony-1",
  archiveCandidateId: "candidate-1",
  sourceTestimonyUpdatedAt: "2026-04-19T09:00:00.000Z",
  sourceSynthesisId: "synth-1",
  sourceAnnotationId: "annotation-1",
  createdAt: "2026-04-19T09:01:00.000Z",
  updatedAt: "2026-04-19T09:01:00.000Z",
  status: "created",
  bundleJsonPath: "data/witness/publication-bundles/bundle-1.json",
};
assert.equal(bundleShape.status, "created");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @g52/orchestration test`

Expected: FAIL because `publicationBundleRoot` and `PublicationBundleRecord` do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

Create `packages/witness-types/src/publicationBundle.ts`:

```ts
export type PublicationBundleStatus = "created";

export interface PublicationBundleRecord {
  id: string;
  witnessId: string;
  testimonyId: string;
  archiveCandidateId: string;
  sourceTestimonyUpdatedAt: string;
  sourceSynthesisId: string;
  sourceAnnotationId: string;
  createdAt: string;
  updatedAt: string;
  status: PublicationBundleStatus;
  bundleJsonPath: string;
  bundleMarkdownPath?: string;
}

export interface PublicationBundleStore {
  load(bundleId: string): Promise<PublicationBundleRecord | null>;
  list(): Promise<PublicationBundleRecord[]>;
  save(record: PublicationBundleRecord): Promise<PublicationBundleRecord>;
  delete(bundleId: string): Promise<boolean>;
}
```

Export it from `packages/witness-types/src/index.ts`:

```ts
export type {
  PublicationBundleRecord,
  PublicationBundleStatus,
  PublicationBundleStore,
} from "./publicationBundle";
```

Add the product root in `packages/orchestration/src/products.ts`:

```ts
  publicationBundleRoot?: string;
```

and:

```ts
      publicationBundleRoot: path.join(
        repoRoot,
        "data",
        "witness",
        "publication-bundles"
      ),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @g52/orchestration test`

Expected: PASS for the root/type additions.

- [ ] **Step 5: Commit**

```bash
git add packages/witness-types/src/publicationBundle.ts packages/witness-types/src/index.ts packages/orchestration/src/products.ts packages/orchestration/src/products.test.ts
git commit -m "feat: add witness publication bundle domain types"
```

### Task 2: Add File-Backed Publication Bundle Store

**Files:**
- Create: `packages/orchestration/src/witness/filePublicationBundleStore.ts`
- Modify: `packages/orchestration/src/witness/fileDraftStores.ts`
- Modify: `packages/orchestration/src/witness/fileStores.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test to `packages/orchestration/src/witness/fileStores.test.ts`:

```ts
test("FileWitnessPublicationBundleStore round-trips bundle records", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "g52-witness-publication-bundle-"));

  try {
    const store = new FileWitnessPublicationBundleStore(root);
    const created = await store.create({
      witnessId: "wit-pub",
      testimonyId: "testimony-pub",
      archiveCandidateId: "candidate-pub",
      sourceTestimonyUpdatedAt: "2026-04-19T09:10:00.000Z",
      sourceSynthesisId: "synth-pub",
      sourceAnnotationId: "annotation-pub",
      createdAt: "2026-04-19T09:11:00.000Z",
      bundleJsonPath: "data/witness/publication-bundles/bundle-pub.json",
      bundleMarkdownPath: "data/witness/publication-bundles/bundle-pub.md",
    });

    assert.equal(created.status, "created");

    const loaded = await store.load(created.id);
    assert.equal(loaded?.archiveCandidateId, "candidate-pub");
    assert.equal(loaded?.sourceTestimonyUpdatedAt, "2026-04-19T09:10:00.000Z");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @g52/orchestration test -- --test-name-pattern "PublicationBundleStore"`

Expected: FAIL because the store class does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `packages/orchestration/src/witness/filePublicationBundleStore.ts` using the same pattern as the other Witness JSON stores:

```ts
export interface CreatePublicationBundleInput {
  witnessId: string;
  testimonyId: string;
  archiveCandidateId: string;
  sourceTestimonyUpdatedAt: string;
  sourceSynthesisId: string;
  sourceAnnotationId: string;
  createdAt: string;
  bundleJsonPath: string;
  bundleMarkdownPath?: string;
}
```

and:

```ts
  async create(input: CreatePublicationBundleInput): Promise<PublicationBundleRecord> {
    return this.save({
      id: randomUUID(),
      witnessId: input.witnessId,
      testimonyId: input.testimonyId,
      archiveCandidateId: input.archiveCandidateId,
      sourceTestimonyUpdatedAt: input.sourceTestimonyUpdatedAt,
      sourceSynthesisId: input.sourceSynthesisId,
      sourceAnnotationId: input.sourceAnnotationId,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      status: "created",
      bundleJsonPath: input.bundleJsonPath,
      ...(input.bundleMarkdownPath
        ? { bundleMarkdownPath: input.bundleMarkdownPath }
        : {}),
    });
  }
```

Re-export in `packages/orchestration/src/witness/fileDraftStores.ts`:

```ts
export { FileWitnessPublicationBundleStore } from "./filePublicationBundleStore";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @g52/orchestration test`

Expected: PASS for the new store round-trip.

- [ ] **Step 5: Commit**

```bash
git add packages/orchestration/src/witness/filePublicationBundleStore.ts packages/orchestration/src/witness/fileDraftStores.ts packages/orchestration/src/witness/fileStores.test.ts
git commit -m "feat: add witness publication bundle store"
```

### Task 3: Add Publication Runtime And Export Files

**Files:**
- Create: `packages/orchestration/src/witness/publicationRuntime.ts`
- Create: `packages/orchestration/src/witness/publicationRuntime.test.ts`
- Modify: `apps/dashboard/src/witnessRuntime.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/orchestration/src/witness/publicationRuntime.test.ts`:

```ts
test("createWitnessPublicationBundle requires publication_ready candidate and writes immutable export files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "g52-witness-publication-runtime-"));

  try {
    const testimonyStore = new FileWitnessTestimonyStore(path.join(root, "testimony"));
    const synthesisStore = new FileWitnessSynthesisStore(path.join(root, "synthesis"));
    const annotationStore = new FileWitnessAnnotationStore(path.join(root, "annotations"));
    const archiveCandidateStore = new FileWitnessArchiveCandidateStore(path.join(root, "archive"));
    const publicationBundleStore = new FileWitnessPublicationBundleStore(path.join(root, "publication"));

    await testimonyStore.save({
      id: "testimony-1",
      witnessId: "wit-1",
      sessionId: "session-1",
      state: "sealed",
      createdAt: "2026-04-19T09:20:00.000Z",
      updatedAt: "2026-04-19T09:21:00.000Z",
      segments: [
        { id: "segment-1", role: "witness", text: "I remember the sequence clearly.", createdAt: "2026-04-19T09:20:00.000Z" },
      ],
    });

    await synthesisStore.save({
      id: "synth-1",
      witnessId: "wit-1",
      testimonyId: "testimony-1",
      createdAt: "2026-04-19T09:22:00.000Z",
      updatedAt: "2026-04-19T09:22:00.000Z",
      status: "approved",
      source: "model",
      text: "Approved synthesis",
    });

    await annotationStore.save({
      id: "annotation-1",
      witnessId: "wit-1",
      testimonyId: "testimony-1",
      createdAt: "2026-04-19T09:23:00.000Z",
      updatedAt: "2026-04-19T09:23:00.000Z",
      status: "approved",
      source: "model",
      entries: [
        {
          id: "entry-1",
          labelId: "STR-chronology",
          labelName: "chronology",
          segmentId: "segment-1",
          startOffset: 2,
          endOffset: 10,
          quote: "remember",
        },
      ],
    });

    await archiveCandidateStore.save({
      id: "candidate-1",
      witnessId: "wit-1",
      testimonyId: "testimony-1",
      testimonyUpdatedAt: "2026-04-19T09:21:00.000Z",
      approvedSynthesisId: "synth-1",
      approvedAnnotationId: "annotation-1",
      createdAt: "2026-04-19T09:24:00.000Z",
      updatedAt: "2026-04-19T09:24:00.000Z",
      status: "publication_ready",
    });

    const created = await createWitnessPublicationBundle({
      publicationBundleRoot: path.join(root, "publication-files"),
      archiveCandidateId: "candidate-1",
      testimonyStore,
      synthesisStore,
      annotationStore,
      archiveCandidateStore,
      publicationBundleStore,
    });

    assert.equal(created.archiveCandidateId, "candidate-1");
    assert.equal(created.sourceTestimonyUpdatedAt, "2026-04-19T09:21:00.000Z");
    assert.match(await readFile(created.bundleJsonPath, "utf8"), /publication_ready/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

Add a second failure-path test:

```ts
test("createWitnessPublicationBundle rejects non-publication-ready candidates", async () => {
  // save a draft candidate and expect /publication_ready/i
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @g52/orchestration test -- --test-name-pattern "PublicationBundle"`

Expected: FAIL because `createWitnessPublicationBundle` and the store do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `packages/orchestration/src/witness/publicationRuntime.ts` with:

```ts
export interface CreateWitnessPublicationBundleInput {
  publicationBundleRoot: string;
  archiveCandidateId: string;
  testimonyStore: FileWitnessTestimonyStore;
  synthesisStore: FileWitnessSynthesisStore;
  annotationStore: FileWitnessAnnotationStore;
  archiveCandidateStore: FileWitnessArchiveCandidateStore;
  publicationBundleStore: FileWitnessPublicationBundleStore;
}
```

and:

```ts
export async function createWitnessPublicationBundle(
  input: CreateWitnessPublicationBundleInput
) {
  const candidate = await input.archiveCandidateStore.load(input.archiveCandidateId);
  if (!candidate) {
    throw new Error(`Unknown archive candidate: ${input.archiveCandidateId}`);
  }
  if (candidate.status !== "publication_ready") {
    throw new Error("Publication bundle creation requires a publication_ready archive candidate.");
  }

  const testimony = await input.testimonyStore.load(candidate.testimonyId);
  const synthesis = await input.synthesisStore.load(candidate.approvedSynthesisId);
  const annotation = await input.annotationStore.load(candidate.approvedAnnotationId);
  if (!testimony || !synthesis || !annotation) {
    throw new Error("Publication bundle source records are missing.");
  }

  const bundleId = randomUUID();
  const bundleJsonPath = path.join(input.publicationBundleRoot, `${bundleId}.json`);
  const bundleMarkdownPath = path.join(input.publicationBundleRoot, `${bundleId}.md`);
  const payload = {
    schemaVersion: "0.1.0",
    witnessId: testimony.witnessId,
    testimony,
    synthesis: {
      id: synthesis.id,
      text: synthesis.text,
      ...(synthesis.reviewNote ? { reviewNote: synthesis.reviewNote } : {}),
    },
    annotations: {
      id: annotation.id,
      entries: annotation.entries,
    },
    archiveCandidate: {
      id: candidate.id,
      status: candidate.status,
      testimonyUpdatedAt: candidate.testimonyUpdatedAt,
    },
  };

  await mkdir(input.publicationBundleRoot, { recursive: true });
  await writeFile(bundleJsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(
    bundleMarkdownPath,
    `# Witness Publication Bundle\\n\\n- Witness: ${testimony.witnessId}\\n- Testimony: ${testimony.id}\\n- Archive Candidate: ${candidate.id}\\n`,
    "utf8"
  );

  return input.publicationBundleStore.create({
    witnessId: testimony.witnessId,
    testimonyId: testimony.id,
    archiveCandidateId: candidate.id,
    sourceTestimonyUpdatedAt: candidate.testimonyUpdatedAt,
    sourceSynthesisId: synthesis.id,
    sourceAnnotationId: annotation.id,
    createdAt: new Date().toISOString(),
    bundleJsonPath,
    bundleMarkdownPath,
  });
}
```

Re-export from `apps/dashboard/src/witnessRuntime.ts`:

```ts
export {
  createWitnessPublicationBundle,
  type CreateWitnessPublicationBundleInput,
} from "../../../packages/orchestration/src/witness/publicationRuntime";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @g52/orchestration test`

Expected: PASS for publication runtime creation and rejection cases.

- [ ] **Step 5: Commit**

```bash
git add packages/orchestration/src/witness/publicationRuntime.ts packages/orchestration/src/witness/publicationRuntime.test.ts apps/dashboard/src/witnessRuntime.ts
git commit -m "feat: add witness publication bundle runtime"
```

### Task 4: Add Dashboard API Endpoints

**Files:**
- Modify: `apps/dashboard/src/server.ts`
- Modify: `apps/dashboard/src/server.test.ts`

- [ ] **Step 1: Write the failing API tests**

Add this test to `apps/dashboard/src/server.test.ts`:

```ts
test("publication bundle endpoints create and list witness export bundles", async () => {
  const witnessId = `wit-${randomUUID()}`;

  // Reuse the existing Witness flow:
  // create testimony -> grant synthesis/annotation/archive_review/publication
  // draft+approve synthesis -> draft+approve annotations
  // seal testimony -> create archive candidate -> approve archive review -> mark publication ready

  const createBundle = await requestJson("/api/witness/publication-bundles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ archiveCandidateId: candidateId }),
  });
  assert.equal(createBundle.response.status, 201);
  assert.equal(createBundle.json.status, "created");
  assert.equal(createBundle.json.archiveCandidateId, candidateId);

  const list = await requestJson(
    `/api/witness/publication-bundles?witnessId=${encodeURIComponent(witnessId)}&testimonyId=${encodeURIComponent(testimonyId)}`
  );
  assert.equal(list.response.status, 200);
  assert.equal(list.json.length, 1);
});
```

Add one failure test:

```ts
test("publication bundle creation returns 409 until archive candidate is publication ready", async () => {
  // create candidate in archive_review_approved and expect 409
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @g52/dashboard test -- --test-name-pattern "publication bundle"`

Expected: FAIL because the endpoints do not exist.

- [ ] **Step 3: Write minimal server implementation**

In `apps/dashboard/src/server.ts`, add:

```ts
function publicationBundleStoreFor(product: ProductConfig): FileWitnessPublicationBundleStore {
  if (!product.publicationBundleRoot) {
    throw new Error(`Product ${product.id} does not define a publication bundle root.`);
  }
  return new FileWitnessPublicationBundleStore(product.publicationBundleRoot);
}
```

Add endpoints:

```ts
if (url.pathname === "/api/witness/publication-bundles" && req.method === "GET") {
  // require witnessId + testimonyId, filter list, send 200
}

if (url.pathname === "/api/witness/publication-bundles" && req.method === "POST") {
  // require archiveCandidateId
  // call createWitnessPublicationBundle(...)
  // 201 on success
  // 404 on unknown candidate
  // 409 on non-publication_ready candidate
}

const publicationBundleMatch = url.pathname.match(
  /^\\/api\\/witness\\/publication-bundles\\/([^/]+)$/
);
if (publicationBundleMatch && req.method === "GET") {
  // load single bundle or 404
}
```

Use the same error-shaping style already present in the Witness routes:

```ts
const status =
  /Unknown archive candidate|Publication bundle not found/.test(message)
    ? 404
    : /publication_ready/.test(message)
      ? 409
      : 500;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @g52/dashboard test`

Expected: PASS for the new publication endpoints and no regression in existing Witness tests.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/server.ts apps/dashboard/src/server.test.ts
git commit -m "feat: add witness publication bundle api"
```

### Task 5: Add Inquiry UI Publication Panel

**Files:**
- Modify: `apps/dashboard/public/inquiry.html`

- [ ] **Step 1: Write the failing browser-facing behavior test as a server/UI contract assertion**

Because `inquiry.html` is inline JS without a browser test harness in-repo, add a focused API-backed assertion in `apps/dashboard/src/server.test.ts` that the created bundle record includes:

```ts
assert.ok(createBundle.json.bundleJsonPath.endsWith(".json"));
assert.ok(createBundle.json.bundleMarkdownPath.endsWith(".md"));
```

This gives the UI concrete data to render before editing the HTML.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @g52/dashboard test -- --test-name-pattern "publication bundle endpoints"`

Expected: FAIL until the API returns the bundle paths.

- [ ] **Step 3: Write minimal UI implementation**

Extend Witness state in `apps/dashboard/public/inquiry.html`:

```js
publicationBundles:[]
```

Load them in `loadWitnessData()`:

```js
const publicationResponses = await Promise.all(state.witnessTestimony.map(item =>
  fetch(`/api/witness/publication-bundles?witnessId=${encodeURIComponent(witnessId)}&testimonyId=${encodeURIComponent(item.id)}`)
    .then(async r => r.ok ? await r.json() : [])
    .catch(() => [])
));
state.witnessPublicationBundles = publicationResponses.flat();
```

Render a new section below archive candidates:

```js
const publicationBundles = active
  ? state.witnessPublicationBundles.filter(item => item.testimonyId === active.id)
  : [];
```

and:

```js
<div class="meta" id="witnessPublicationMeta">No publication bundle state loaded.</div>
<div class="drawer-list" id="witnessPublicationList"></div>
```

Render:

```js
${active ? `
  <div class="context">
    <div class="label">Publication export</div>
    <div class="rerun-row" style="margin-top:8px">
      ${archiveCandidates.filter(item => item.status === "publication_ready").map(item => `
        <button class="btn quiet" data-witness-publication-bundle-create="${esc(item.id)}">
          Create publication bundle
        </button>`).join("") || '<span class="meta">No publication_ready candidate yet.</span>'}
    </div>
  </div>
  ${publicationBundles.length ? publicationBundles.map(item => `
    <div class="context">
      <div class="label">${esc(item.id.slice(0, 8))} · ${esc(item.status)}</div>
      <div class="meta">${esc(item.bundleJsonPath)}${item.bundleMarkdownPath ? ` · ${esc(item.bundleMarkdownPath)}` : ""}</div>
    </div>`).join("") : '<div class="meta">No publication bundles yet for this testimony.</div>'}
` : '<div class="meta">Select a testimony before exporting publication bundles.</div>'}
```

Add the action:

```js
async function createWitnessPublicationBundleRecord(archiveCandidateId){
  const res = await fetch("/api/witness/publication-bundles", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ archiveCandidateId })
  });
  const data = await res.json();
  if(!res.ok){setError(data.error || "Failed to create publication bundle", data);return}
  setError("");
  await loadWitnessData();
}
```

- [ ] **Step 4: Run tests and parse check**

Run:

```bash
pnpm --filter @g52/dashboard test
@'
const fs = require("fs");
const html = fs.readFileSync("F:/ProcessoErgoSum/G_5.2/apps/dashboard/public/inquiry.html", "utf8");
const scripts = [...html.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)];
for (const match of scripts) new Function(match[1]);
console.log("inquiry.html inline script parsed successfully");
'@ | node -
```

Expected:
- dashboard tests PASS
- `inquiry.html inline script parsed successfully`

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/public/inquiry.html apps/dashboard/src/server.test.ts
git commit -m "feat: add witness publication bundle ui"
```

### Task 6: Extend Smoke Coverage And Docs

**Files:**
- Modify: `scripts/smoke-tests.ts`
- Modify: `README.md`
- Modify: `docs/operator-handbook.md`

- [ ] **Step 1: Write the failing smoke extension**

Extend the Witness path in `scripts/smoke-tests.ts` after `publication_ready`:

```ts
    const publicationBundleStore = new FileWitnessPublicationBundleStore(
      witnessPublicationBundleRoot
    );

    const bundle = await createWitnessPublicationBundle({
      publicationBundleRoot: witnessPublicationBundleRoot,
      archiveCandidateId: publicationReady.id,
      testimonyStore,
      synthesisStore,
      annotationStore,
      archiveCandidateStore,
      publicationBundleStore,
    });

    assert.equal(bundle.status, "created");
    assert.ok((await readFile(bundle.bundleJsonPath, "utf8")).includes('"schemaVersion": "0.1.0"'));
```

- [ ] **Step 2: Run smoke to verify it fails**

Run: `pnpm smoke`

Expected: FAIL until the publication bundle runtime is wired into smoke.

- [ ] **Step 3: Write minimal implementation and docs**

In `README.md`, extend Witness data roots:

```md
- `data/witness/synthesis/`, `data/witness/annotations/`, `data/witness/archive-candidates/`, `data/witness/publication-bundles/` for downstream Witness review and export state
```

In `docs/operator-handbook.md`, add:

```md
- publication bundle creation requires a `publication_ready` archive candidate
- publication bundle creation is operator-triggered and read-only with respect to testimony, synthesis, annotations, and archive candidates
- `POST /api/witness/publication-bundles`
- `GET /api/witness/publication-bundles?witnessId=...&testimonyId=...`
- `GET /api/witness/publication-bundles/:id`
```

- [ ] **Step 4: Run full verification**

Run:

```bash
pnpm typecheck
pnpm test
pnpm smoke
```

Expected:
- all commands PASS
- Witness smoke path now includes publication bundle creation

- [ ] **Step 5: Commit**

```bash
git add scripts/smoke-tests.ts README.md docs/operator-handbook.md
git commit -m "test: cover witness publication bundle export path"
```

## Self-Review

- Spec coverage:
  - operator-triggered publication export: covered in Tasks 3-5
  - only from `publication_ready` candidates: covered in Tasks 3-4
  - simple JSON bundle plus Markdown companion: covered in Task 3
  - dashboard inspection flow: covered in Task 5
  - Witness-root-only persistence and smoke coverage: covered in Task 6
- Placeholder scan:
  - no `TODO`/`TBD`
  - every task includes explicit file paths, code, commands, and expected outcomes
- Type consistency:
  - `PublicationBundleRecord`, `FileWitnessPublicationBundleStore`, and `createWitnessPublicationBundle` are named consistently across tasks
  - source fields consistently use `sourceTestimonyUpdatedAt`, `sourceSynthesisId`, `sourceAnnotationId`

