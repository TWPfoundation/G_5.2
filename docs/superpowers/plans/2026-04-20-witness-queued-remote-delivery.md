# Witness Queued Remote Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add queued/background Witness remote package delivery on top of the existing package and delivery-attempt model, with separate queue job records, manual retry, and a single in-process worker loop.

**Architecture:** Keep the publication package as the artifact of record and preserve `PublicationDeliveryRecord` as the concrete upload-attempt audit log. Add a separate `PublicationDeliveryJobRecord` layer for queued work, an in-process file-backed queue runner inside the dashboard/server, explicit startup reconciliation for stale `in_progress` jobs, and operator-triggered enqueue/retry APIs and UI actions.

**Tech Stack:** TypeScript, Node.js built-ins, existing file-backed Witness stores/runtime, static `inquiry.html` dashboard UI, Node test runner, current generic object-delivery contract with Azure Blob as the first backend.

---

## File Structure

- Create: `packages/witness-types/src/publicationDeliveryJob.ts`
  Purpose: define the shared queued-delivery job types and store contract.
- Modify: `packages/witness-types/src/index.ts`
  Purpose: re-export queued delivery job types.
- Create: `packages/orchestration/src/witness/filePublicationDeliveryJobStore.ts`
  Purpose: persist `PublicationDeliveryJobRecord` entries under `delivery-jobs/`.
- Modify: `packages/orchestration/src/witness/fileStores.test.ts`
  Purpose: add round-trip coverage for queued delivery job records.
- Create: `packages/orchestration/src/witness/publicationDeliveryQueue.ts`
  Purpose: implement queue enqueue/retry helpers, startup reconciliation, single-job claiming, and worker processing on top of the existing delivery runtime.
- Create: `packages/orchestration/src/witness/publicationDeliveryQueue.test.ts`
  Purpose: cover queue reconciliation, single-job claiming, processing, and manual retry behavior.
- Modify: `apps/dashboard/src/server.ts`
  Purpose: add enqueue/list/detail/retry routes and wire the in-process queue worker into server lifecycle.
- Modify: `apps/dashboard/src/server.test.ts`
  Purpose: verify queued delivery API behavior, including retry and startup-safe state handling.
- Modify: `apps/dashboard/public/inquiry.html`
  Purpose: add `Queue Delivery`, `Retry Delivery`, and queued job state/history to the Witness publication package UI.
- Modify: `scripts/smoke-tests.ts`
  Purpose: extend the Witness smoke path through queued operator-facing delivery.
- Modify: `README.md`
  Purpose: document queued/background delivery as the next layer over remote package delivery.
- Modify: `docs/operator-handbook.md`
  Purpose: document job lifecycle, manual retry, and restart reconciliation semantics.

## Task 1: Add Shared Queue Job Types And Store

**Files:**
- Create: `packages/witness-types/src/publicationDeliveryJob.ts`
- Modify: `packages/witness-types/src/index.ts`
- Create: `packages/orchestration/src/witness/filePublicationDeliveryJobStore.ts`
- Modify: `packages/orchestration/src/witness/fileStores.test.ts`

- [ ] **Step 1: Write the failing queued-job store tests**

Append to `packages/orchestration/src/witness/fileStores.test.ts`:

```ts
import { FileWitnessPublicationDeliveryJobStore } from "./filePublicationDeliveryJobStore";

test("FileWitnessPublicationDeliveryJobStore round-trips queued delivery jobs and filters by package id", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "g52-witness-publication-delivery-job-store-")
  );

  try {
    const store = new FileWitnessPublicationDeliveryJobStore(root);
    const created = await store.create({
      packageId: "bundle-1",
      bundleId: "bundle-1",
      witnessId: "wit-1",
      testimonyId: "testimony-1",
      backend: "azure-blob",
      createdAt: "2026-04-20T08:00:00.000Z",
    });

    assert.equal(created.status, "queued");
    assert.equal((await store.load(created.id))?.packageId, "bundle-1");
    assert.deepEqual(
      (await store.list({ packageId: "bundle-1" })).map((record) => record.id),
      [created.id]
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("FileWitnessPublicationDeliveryJobStore finds the oldest queued job and supports retryable failed jobs", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "g52-witness-publication-delivery-job-ordering-")
  );

  try {
    const store = new FileWitnessPublicationDeliveryJobStore(root);
    const first = await store.create({
      packageId: "bundle-1",
      bundleId: "bundle-1",
      witnessId: "wit-1",
      testimonyId: "testimony-1",
      backend: "azure-blob",
      createdAt: "2026-04-20T08:00:00.000Z",
    });
    const second = await store.create({
      packageId: "bundle-2",
      bundleId: "bundle-2",
      witnessId: "wit-2",
      testimonyId: "testimony-2",
      backend: "azure-blob",
      createdAt: "2026-04-20T08:05:00.000Z",
    });

    await store.save({
      ...second,
      status: "failed",
      updatedAt: "2026-04-20T08:06:00.000Z",
      error: "simulated failure",
    });

    assert.equal((await store.findOldestQueued())?.id, first.id);
    assert.equal((await store.list({ status: "failed" }))[0]?.id, second.id);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the focused store test to verify it fails**

Run:

```bash
pnpm --filter @g52/orchestration exec tsx --test src/witness/fileStores.test.ts
```

Expected: FAIL because the queued delivery job store and types do not exist yet.

- [ ] **Step 3: Add the shared queued-job type and store contract**

Create `packages/witness-types/src/publicationDeliveryJob.ts`:

```ts
import type { PublicationDeliveryBackend } from "./publicationDelivery";

export type PublicationDeliveryJobStatus =
  | "queued"
  | "in_progress"
  | "succeeded"
  | "failed";

export interface PublicationDeliveryJobRecord {
  id: string;
  packageId: string;
  bundleId: string;
  witnessId: string;
  testimonyId: string;
  backend: PublicationDeliveryBackend;
  status: PublicationDeliveryJobStatus;
  createdAt: string;
  updatedAt: string;
  lastAttemptId?: string;
  error?: string;
  recoveredFromRestartAt?: string;
}

export interface PublicationDeliveryJobStore {
  load(jobId: string): Promise<PublicationDeliveryJobRecord | null>;
  list(filters?: {
    packageId?: string;
    bundleId?: string;
    witnessId?: string;
    testimonyId?: string;
    status?: PublicationDeliveryJobStatus;
  }): Promise<PublicationDeliveryJobRecord[]>;
  save(
    record: PublicationDeliveryJobRecord
  ): Promise<PublicationDeliveryJobRecord>;
  delete(jobId: string): Promise<boolean>;
}
```

Update `packages/witness-types/src/index.ts`:

```ts
export type {
  PublicationDeliveryJobRecord,
  PublicationDeliveryJobStatus,
  PublicationDeliveryJobStore,
} from "./publicationDeliveryJob";
```

- [ ] **Step 4: Implement the file-backed queued-job store**

Create `packages/orchestration/src/witness/filePublicationDeliveryJobStore.ts`:

```ts
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  PublicationDeliveryJobRecord,
  PublicationDeliveryJobStatus,
  PublicationDeliveryJobStore,
} from "../../../witness-types/src/publicationDeliveryJob";
import type { PublicationDeliveryBackend } from "../../../witness-types/src/publicationDelivery";

export interface CreatePublicationDeliveryJobInput {
  id?: string;
  packageId: string;
  bundleId: string;
  witnessId: string;
  testimonyId: string;
  backend: PublicationDeliveryBackend;
  createdAt: string;
}

export class FileWitnessPublicationDeliveryJobStore
  implements PublicationDeliveryJobStore
{
  constructor(private readonly rootDir: string) {}

  private recordsDir(): string {
    return path.join(this.rootDir, "delivery-jobs");
  }

  private filePath(jobId: string): string {
    return path.join(this.recordsDir(), `${jobId}.json`);
  }

  async load(jobId: string): Promise<PublicationDeliveryJobRecord | null> {
    try {
      const raw = await readFile(this.filePath(jobId), "utf8");
      return JSON.parse(raw) as PublicationDeliveryJobRecord;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async list(filters?: {
    packageId?: string;
    bundleId?: string;
    witnessId?: string;
    testimonyId?: string;
    status?: PublicationDeliveryJobStatus;
  }): Promise<PublicationDeliveryJobRecord[]> {
    try {
      const files = await readdir(this.recordsDir());
      const records = await Promise.all(
        files
          .filter((file) => file.endsWith(".json"))
          .map(async (file) => {
            const raw = await readFile(path.join(this.recordsDir(), file), "utf8");
            return JSON.parse(raw) as PublicationDeliveryJobRecord;
          })
      );

      return records
        .filter(
          (record) =>
            (!filters?.packageId || record.packageId === filters.packageId) &&
            (!filters?.bundleId || record.bundleId === filters.bundleId) &&
            (!filters?.witnessId || record.witnessId === filters.witnessId) &&
            (!filters?.testimonyId ||
              record.testimonyId === filters.testimonyId) &&
            (!filters?.status || record.status === filters.status)
        )
        .sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt) ||
          a.updatedAt.localeCompare(b.updatedAt) ||
          a.id.localeCompare(b.id)
        );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async save(
    record: PublicationDeliveryJobRecord
  ): Promise<PublicationDeliveryJobRecord> {
    await mkdir(this.recordsDir(), { recursive: true });
    await writeFile(
      this.filePath(record.id),
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8"
    );
    return record;
  }

  async delete(jobId: string): Promise<boolean> {
    try {
      await rm(this.filePath(jobId));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      throw error;
    }
  }

  async create(
    input: CreatePublicationDeliveryJobInput
  ): Promise<PublicationDeliveryJobRecord> {
    return this.save({
      id: input.id ?? randomUUID(),
      packageId: input.packageId,
      bundleId: input.bundleId,
      witnessId: input.witnessId,
      testimonyId: input.testimonyId,
      backend: input.backend,
      status: "queued",
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    });
  }

  async findOldestQueued(): Promise<PublicationDeliveryJobRecord | null> {
    const queued = await this.list({ status: "queued" });
    return queued[0] ?? null;
  }
}
```

- [ ] **Step 5: Run the focused store test to verify it passes**

Run:

```bash
pnpm --filter @g52/orchestration exec tsx --test src/witness/fileStores.test.ts
```

Expected: PASS with queued delivery job store coverage green.

- [ ] **Step 6: Commit**

```bash
git add packages/witness-types/src/publicationDeliveryJob.ts packages/witness-types/src/index.ts packages/orchestration/src/witness/filePublicationDeliveryJobStore.ts packages/orchestration/src/witness/fileStores.test.ts
git commit -m "feat: add witness publication delivery jobs"
```

## Task 2: Implement Queue Runtime And Worker Semantics

**Files:**
- Create: `packages/orchestration/src/witness/publicationDeliveryQueue.ts`
- Create: `packages/orchestration/src/witness/publicationDeliveryQueue.test.ts`

- [ ] **Step 1: Write the failing queue runtime tests**

Create `packages/orchestration/src/witness/publicationDeliveryQueue.test.ts`:

```ts
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { FileWitnessPublicationDeliveryJobStore } from "./filePublicationDeliveryJobStore";
import { FileWitnessPublicationDeliveryStore } from "./filePublicationDeliveryStore";
import { FileWitnessPublicationPackageStore } from "./filePublicationPackageStore";
import {
  enqueueWitnessPublicationDeliveryJob,
  processNextWitnessPublicationDeliveryJob,
  reconcileInProgressWitnessDeliveryJobs,
  retryWitnessPublicationDeliveryJob,
} from "./publicationDeliveryQueue";

class FakeObjectDeliveryBackend {
  readonly name = "azure-blob" as const;

  constructor(private readonly remoteRoot: string) {}

  async putObject(input: {
    key: string;
    filePath: string;
    contentType: string;
    metadata?: Record<string, string>;
  }) {
    const targetPath = path.join(
      this.remoteRoot,
      input.key.replaceAll("/", path.sep)
    );
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, await readFile(input.filePath));
    return {
      remoteKey: input.key,
      remoteUrl: `file://${targetPath.replaceAll("\\", "/")}`,
    };
  }
}

test("queued delivery processing claims one queued job and marks it succeeded", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "g52-witness-publication-delivery-queue-")
  );

  try {
    const publicationBundleRoot = path.join(root, "publication-bundles");
    const packagesRoot = path.join(publicationBundleRoot, "packages");
    const remoteRoot = path.join(root, "remote");
    await mkdir(packagesRoot, { recursive: true });

    const packagePath = path.join(packagesRoot, "bundle-1.zip");
    await writeFile(packagePath, Buffer.from("package-bytes"));

    const packageStore = new FileWitnessPublicationPackageStore(
      publicationBundleRoot
    );
    const jobStore = new FileWitnessPublicationDeliveryJobStore(
      publicationBundleRoot
    );
    const deliveryStore = new FileWitnessPublicationDeliveryStore(
      publicationBundleRoot
    );

    const packageRecord = await packageStore.create({
      id: "bundle-1",
      bundleId: "bundle-1",
      witnessId: "wit-1",
      testimonyId: "testimony-1",
      archiveCandidateId: "candidate-1",
      createdAt: "2026-04-20T09:00:00.000Z",
      packagePath,
      packageFilename: "bundle-1.zip",
      packageSha256: "1".repeat(64),
      packageByteSize: 13,
      sourceBundleJsonPath: "bundle.json",
      sourceBundleMarkdownPath: "bundle.md",
      sourceBundleManifestPath: "manifest.json",
    });

    const queued = await enqueueWitnessPublicationDeliveryJob({
      packageId: packageRecord.id,
      packageStore,
      jobStore,
      backend: "azure-blob",
    });

    const processed = await processNextWitnessPublicationDeliveryJob({
      publicationBundleRoot,
      packageStore,
      jobStore,
      deliveryStore,
      backend: new FakeObjectDeliveryBackend(remoteRoot),
    });

    assert.equal(processed?.id, queued.id);
    assert.equal(processed?.status, "succeeded");
    assert.ok(processed?.lastAttemptId);
    assert.equal((await deliveryStore.list({ packageId: packageRecord.id })).length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("startup reconciliation converts stale in-progress jobs to failed", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "g52-witness-publication-delivery-reconcile-")
  );

  try {
    const store = new FileWitnessPublicationDeliveryJobStore(root);
    const job = await store.create({
      packageId: "bundle-1",
      bundleId: "bundle-1",
      witnessId: "wit-1",
      testimonyId: "testimony-1",
      backend: "azure-blob",
      createdAt: "2026-04-20T09:10:00.000Z",
    });
    await store.save({
      ...job,
      status: "in_progress",
      updatedAt: "2026-04-20T09:11:00.000Z",
    });

    await reconcileInProgressWitnessDeliveryJobs(store);

    const updated = await store.load(job.id);
    assert.equal(updated?.status, "failed");
    assert.match(updated?.error ?? "", /Recovered from interrupted in-progress delivery/);
    assert.ok(updated?.recoveredFromRestartAt);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the focused queue tests to verify they fail**

Run:

```bash
pnpm --filter @g52/orchestration exec tsx --test src/witness/publicationDeliveryQueue.test.ts
```

Expected: FAIL because the queue runtime does not exist yet.

- [ ] **Step 3: Implement enqueue, reconcile, processing, and retry helpers**

Create `packages/orchestration/src/witness/publicationDeliveryQueue.ts`:

```ts
import type { PublicationDeliveryBackend } from "../../../witness-types/src/publicationDelivery";
import type { PublicationDeliveryJobRecord } from "../../../witness-types/src/publicationDeliveryJob";
import type { FileWitnessPublicationDeliveryJobStore } from "./filePublicationDeliveryJobStore";
import type { FileWitnessPublicationDeliveryStore } from "./filePublicationDeliveryStore";
import type { FileWitnessPublicationPackageStore } from "./filePublicationPackageStore";
import type { ObjectDeliveryBackend } from "./objectDelivery";
import { deliverWitnessPublicationPackage } from "./publicationDeliveryRuntime";

export async function enqueueWitnessPublicationDeliveryJob(input: {
  packageId: string;
  packageStore: FileWitnessPublicationPackageStore;
  jobStore: FileWitnessPublicationDeliveryJobStore;
  backend: PublicationDeliveryBackend;
}): Promise<PublicationDeliveryJobRecord> {
  const packageRecord = await input.packageStore.load(input.packageId);
  if (!packageRecord) {
    throw new Error(`Unknown publication package: ${input.packageId}`);
  }

  return input.jobStore.create({
    packageId: packageRecord.id,
    bundleId: packageRecord.bundleId,
    witnessId: packageRecord.witnessId,
    testimonyId: packageRecord.testimonyId,
    backend: input.backend,
    createdAt: new Date().toISOString(),
  });
}

export async function reconcileInProgressWitnessDeliveryJobs(
  jobStore: FileWitnessPublicationDeliveryJobStore
): Promise<void> {
  const inProgress = await jobStore.list({ status: "in_progress" });
  const recoveredAt = new Date().toISOString();
  await Promise.all(
    inProgress.map((job) =>
      jobStore.save({
        ...job,
        status: "failed",
        updatedAt: recoveredAt,
        error: "Recovered from interrupted in-progress delivery",
        recoveredFromRestartAt: recoveredAt,
      })
    )
  );
}

export async function processNextWitnessPublicationDeliveryJob(input: {
  publicationBundleRoot: string;
  packageStore: FileWitnessPublicationPackageStore;
  jobStore: FileWitnessPublicationDeliveryJobStore;
  deliveryStore: FileWitnessPublicationDeliveryStore;
  backend: ObjectDeliveryBackend;
}): Promise<PublicationDeliveryJobRecord | null> {
  const next = await input.jobStore.findOldestQueued();
  if (!next) {
    return null;
  }

  const startedAt = new Date().toISOString();
  const inProgress = await input.jobStore.save({
    ...next,
    status: "in_progress",
    updatedAt: startedAt,
    error: undefined,
  });

  try {
    const attempt = await deliverWitnessPublicationPackage({
      publicationBundleRoot: input.publicationBundleRoot,
      packageId: inProgress.packageId,
      packageStore: input.packageStore,
      deliveryStore: input.deliveryStore,
      backend: input.backend,
    });

    return input.jobStore.save({
      ...inProgress,
      status: attempt.status === "succeeded" ? "succeeded" : "failed",
      updatedAt: new Date().toISOString(),
      lastAttemptId: attempt.id,
      error: attempt.error,
    });
  } catch (error) {
    return input.jobStore.save({
      ...inProgress,
      status: "failed",
      updatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function retryWitnessPublicationDeliveryJob(input: {
  jobId: string;
  jobStore: FileWitnessPublicationDeliveryJobStore;
}): Promise<PublicationDeliveryJobRecord> {
  const job = await input.jobStore.load(input.jobId);
  if (!job) {
    throw new Error(`Unknown publication delivery job: ${input.jobId}`);
  }
  if (job.status !== "failed") {
    throw new Error(`Only failed publication delivery jobs may be retried.`);
  }

  return input.jobStore.create({
    packageId: job.packageId,
    bundleId: job.bundleId,
    witnessId: job.witnessId,
    testimonyId: job.testimonyId,
    backend: job.backend,
    createdAt: new Date().toISOString(),
  });
}
```

- [ ] **Step 4: Add failing-path and retry tests**

Append to `packages/orchestration/src/witness/publicationDeliveryQueue.test.ts`:

```ts
class ThrowingObjectDeliveryBackend {
  readonly name = "azure-blob" as const;

  async putObject(): Promise<never> {
    throw new Error("simulated queued upload failure");
  }
}

test("queued delivery processing marks the job failed when upload fails", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "g52-witness-publication-delivery-queue-failure-")
  );

  try {
    const publicationBundleRoot = path.join(root, "publication-bundles");
    const packagesRoot = path.join(publicationBundleRoot, "packages");
    await mkdir(packagesRoot, { recursive: true });

    const packagePath = path.join(packagesRoot, "bundle-fail.zip");
    await writeFile(packagePath, Buffer.from("package-bytes"));

    const packageStore = new FileWitnessPublicationPackageStore(publicationBundleRoot);
    const jobStore = new FileWitnessPublicationDeliveryJobStore(publicationBundleRoot);
    const deliveryStore = new FileWitnessPublicationDeliveryStore(publicationBundleRoot);

    const packageRecord = await packageStore.create({
      id: "bundle-fail",
      bundleId: "bundle-fail",
      witnessId: "wit-fail",
      testimonyId: "testimony-fail",
      archiveCandidateId: "candidate-fail",
      createdAt: "2026-04-20T09:20:00.000Z",
      packagePath,
      packageFilename: "bundle-fail.zip",
      packageSha256: "f".repeat(64),
      packageByteSize: 13,
      sourceBundleJsonPath: "bundle.json",
      sourceBundleMarkdownPath: "bundle.md",
      sourceBundleManifestPath: "manifest.json",
    });

    const queued = await enqueueWitnessPublicationDeliveryJob({
      packageId: packageRecord.id,
      packageStore,
      jobStore,
      backend: "azure-blob",
    });

    const processed = await processNextWitnessPublicationDeliveryJob({
      publicationBundleRoot,
      packageStore,
      jobStore,
      deliveryStore,
      backend: new ThrowingObjectDeliveryBackend(),
    });

    assert.equal(processed?.id, queued.id);
    assert.equal(processed?.status, "failed");
    assert.match(processed?.error ?? "", /simulated queued upload failure/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("retryWitnessPublicationDeliveryJob creates a new queued job from a failed job", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "g52-witness-publication-delivery-retry-")
  );

  try {
    const store = new FileWitnessPublicationDeliveryJobStore(root);
    const failed = await store.create({
      packageId: "bundle-1",
      bundleId: "bundle-1",
      witnessId: "wit-1",
      testimonyId: "testimony-1",
      backend: "azure-blob",
      createdAt: "2026-04-20T09:30:00.000Z",
    });
    await store.save({
      ...failed,
      status: "failed",
      updatedAt: "2026-04-20T09:31:00.000Z",
      error: "previous failure",
    });

    const retried = await retryWitnessPublicationDeliveryJob({
      jobId: failed.id,
      jobStore: store,
    });

    assert.notEqual(retried.id, failed.id);
    assert.equal(retried.status, "queued");
    assert.equal(retried.packageId, failed.packageId);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 5: Run the focused queue tests to verify they pass**

Run:

```bash
pnpm --filter @g52/orchestration exec tsx --test src/witness/publicationDeliveryQueue.test.ts
pnpm --filter @g52/orchestration typecheck
```

Expected: PASS with queue runtime coverage green and orchestration typecheck passing.

- [ ] **Step 6: Commit**

```bash
git add packages/orchestration/src/witness/publicationDeliveryQueue.ts packages/orchestration/src/witness/publicationDeliveryQueue.test.ts
git commit -m "feat: add witness publication delivery queue runtime"
```

## Task 3: Add Queued Delivery API Endpoints And Worker Startup

**Files:**
- Modify: `apps/dashboard/src/server.ts`
- Modify: `apps/dashboard/src/server.test.ts`

- [ ] **Step 1: Write the failing queued-delivery API tests**

Append to `apps/dashboard/src/server.test.ts`:

```ts
test("publication delivery job endpoints enqueue, list, fetch, and retry queued jobs", async () => {
  const witnessId = `wit-${randomUUID()}`;
  let sessionId: string | undefined;
  let turnId: string | undefined;

  try {
    const setup = await createPublicationBundleFixture(witnessId);
    sessionId = setup.sessionId;
    turnId = setup.turnId;

    const packageCreate = await requestJson("/api/witness/publication-packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundleId: setup.bundleId }),
    });
    assert.equal(packageCreate.response.status, 201);

    const enqueued = await requestJson("/api/witness/publication-delivery-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        packageId: packageCreate.json.id,
        backend: "azure-blob",
      }),
    });
    assert.equal(enqueued.response.status, 201);
    assert.equal(enqueued.json?.status, "queued");

    const listed = await requestJson(
      `/api/witness/publication-delivery-jobs?packageId=${encodeURIComponent(packageCreate.json.id)}`
    );
    assert.equal(listed.response.status, 200);
    assert.equal(listed.json.length, 1);

    const fetched = await requestJson(
      `/api/witness/publication-delivery-jobs/${encodeURIComponent(enqueued.json.id)}`
    );
    assert.equal(fetched.response.status, 200);
    assert.equal(fetched.json?.id, enqueued.json.id);

    const forcedFailed = await requestJson(
      `/api/witness/publication-delivery-jobs/${encodeURIComponent(enqueued.json.id)}/retry`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );
    assert.equal(forcedFailed.response.status, 409);
  } finally {
    await cleanupWitnessArtifacts(witnessId, sessionId, turnId);
  }
});
```

- [ ] **Step 2: Run the focused server test to verify it fails**

Run:

```bash
pnpm --filter @g52/dashboard exec tsx --test src/server.test.ts
```

Expected: FAIL because the queued delivery job routes do not exist yet.

- [ ] **Step 3: Add queued-delivery job store/runtime wiring and routes**

Update `apps/dashboard/src/server.ts` to add:

- `publicationDeliveryJobStoreFor(product)`
- server-local queue worker state with one active poller
- startup reconciliation of stale `in_progress` jobs
- `POST /api/witness/publication-delivery-jobs`
- `GET /api/witness/publication-delivery-jobs`
- `GET /api/witness/publication-delivery-jobs/:id`
- `POST /api/witness/publication-delivery-jobs/:id/retry`

Add the store helper:

```ts
function publicationDeliveryJobStoreFor(
  product: ProductConfig
): FileWitnessPublicationDeliveryJobStore {
  if (!product.publicationBundleRoot) {
    throw new Error(
      `Product ${product.id} does not define a publication bundle root.`
    );
  }

  return new FileWitnessPublicationDeliveryJobStore(product.publicationBundleRoot);
}
```

Add route behavior:

- `POST /api/witness/publication-delivery-jobs`
  - `400` if `packageId` missing or malformed, or backend unknown
  - `404` if package unknown
  - `201` with queued job on success
- `GET /api/witness/publication-delivery-jobs?...`
  - filter by `packageId`, `bundleId`, `witnessId`, `testimonyId`, `status`
  - `400` on malformed ids
- `GET /api/witness/publication-delivery-jobs/:id`
  - `400` malformed id
  - `404` unknown id
- `POST /api/witness/publication-delivery-jobs/:id/retry`
  - `404` unknown id
  - `409` if not in `failed`
  - `201` with new queued retry job

Add a queue start helper near server creation:

```ts
let witnessDeliveryQueueStarted = false;

async function startWitnessDeliveryQueueWorker(
  options: DashboardServerOptions
): Promise<void> {
  if (witnessDeliveryQueueStarted || !WITNESS_CONFIG.publicationBundleRoot) {
    return;
  }
  witnessDeliveryQueueStarted = true;

  const packageStore = publicationPackageStoreFor(WITNESS_CONFIG);
  const deliveryStore = publicationDeliveryStoreFor(WITNESS_CONFIG);
  const jobStore = publicationDeliveryJobStoreFor(WITNESS_CONFIG);

  await reconcileInProgressWitnessDeliveryJobs(jobStore);

  const tick = async () => {
    try {
      await processNextWitnessPublicationDeliveryJob({
        publicationBundleRoot: WITNESS_CONFIG.publicationBundleRoot!,
        packageStore,
        jobStore,
        deliveryStore,
        backend:
          options.publicationObjectDeliveryBackendOverride ??
          getPublicationObjectDeliveryBackend("azure-blob"),
      });
    } catch {
      // Keep the loop alive; failures are recorded in the job/delivery layers.
    } finally {
      setTimeout(() => {
        void tick();
      }, 250);
    }
  };

  void tick();
}
```

- [ ] **Step 4: Add retry and reconciliation coverage**

Append to `apps/dashboard/src/server.test.ts`:

```ts
test("publication delivery job retry returns 201 for failed jobs and enqueues a fresh job", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "g52-dashboard-publication-delivery-retry-"));

  try {
    const publicationBundleRoot = path.join(root, "publication-bundles");
    const packagesRoot = path.join(publicationBundleRoot, "packages");
    await mkdir(packagesRoot, { recursive: true });

    const packagePath = path.join(packagesRoot, "bundle-retry.zip");
    await writeFile(packagePath, Buffer.from("package-bytes"));

    const packageStore = new FileWitnessPublicationPackageStore(publicationBundleRoot);
    const jobStore = new FileWitnessPublicationDeliveryJobStore(publicationBundleRoot);

    const packageRecord = await packageStore.create({
      id: "bundle-retry",
      bundleId: "bundle-retry",
      witnessId: "wit-retry",
      testimonyId: "testimony-retry",
      archiveCandidateId: "candidate-retry",
      createdAt: "2026-04-20T10:00:00.000Z",
      packagePath,
      packageFilename: "bundle-retry.zip",
      packageSha256: "a".repeat(64),
      packageByteSize: 13,
      sourceBundleJsonPath: "bundle.json",
      sourceBundleMarkdownPath: "bundle.md",
      sourceBundleManifestPath: "manifest.json",
    });

    const failed = await jobStore.create({
      packageId: packageRecord.id,
      bundleId: packageRecord.bundleId,
      witnessId: packageRecord.witnessId,
      testimonyId: packageRecord.testimonyId,
      backend: "azure-blob",
      createdAt: "2026-04-20T10:01:00.000Z",
    });
    await jobStore.save({
      ...failed,
      status: "failed",
      updatedAt: "2026-04-20T10:02:00.000Z",
      error: "simulated queue failure",
    });

    const retried = await requestJson(
      `/api/witness/publication-delivery-jobs/${encodeURIComponent(failed.id)}/retry`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );
    assert.equal(retried.response.status, 201);
    assert.equal(retried.json?.status, "queued");
    assert.notEqual(retried.json?.id, failed.id);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 5: Run the focused server tests to verify they pass**

Run:

```bash
pnpm --filter @g52/dashboard exec tsx --test src/server.test.ts
```

Expected: PASS with queued delivery job API coverage green.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/server.ts apps/dashboard/src/server.test.ts
git commit -m "feat: add witness queued delivery api"
```

## Task 4: Add Queued Delivery UI, Smoke Coverage, And Docs

**Files:**
- Modify: `apps/dashboard/public/inquiry.html`
- Modify: `scripts/smoke-tests.ts`
- Modify: `README.md`
- Modify: `docs/operator-handbook.md`

- [ ] **Step 1: Extend the Witness package UI for queued delivery jobs**

Update `apps/dashboard/public/inquiry.html` to add queued-job state and actions.

Add state fields:

```js
deliveryJobsByPackageId:{},
witnessPublicationDeliveryJobsLoading:false,
witnessPublicationDeliveryJobsError:"",
pendingWitnessQueuedDeliveryIds:{},
pendingWitnessQueuedRetryIds:{},
```

Add URL helper:

```js
function witnessPublicationDeliveryJobsUrl(witnessId,testimonyId){
  return `/api/witness/publication-delivery-jobs?witnessId=${encodeURIComponent(witnessId)}&testimonyId=${encodeURIComponent(testimonyId)}`;
}
```

Add loader:

```js
async function loadWitnessPublicationDeliveryJobs(){
  const witnessId=state.selectedWitnessId;
  const testimonyId=state.selectedWitnessTestimonyId;
  if(!witnessId||!testimonyId){
    state.deliveryJobsByPackageId={};
    state.witnessPublicationDeliveryJobsError="";
    return;
  }
  state.witnessPublicationDeliveryJobsLoading=true;
  state.witnessPublicationDeliveryJobsError="";
  render();
  try{
    const res=await fetch(witnessPublicationDeliveryJobsUrl(witnessId,testimonyId));
    const data=await res.json().catch(()=>[]);
    if(!res.ok){
      state.deliveryJobsByPackageId={};
      state.witnessPublicationDeliveryJobsError=data?.error||"Failed to load queued delivery jobs";
      return;
    }
    const grouped={};
    for(const item of data){
      (grouped[item.packageId] ||= []).push(item);
    }
    state.deliveryJobsByPackageId=grouped;
  }catch(err){
    state.deliveryJobsByPackageId={};
    state.witnessPublicationDeliveryJobsError=err?.message||"Failed to load queued delivery jobs";
  }finally{
    state.witnessPublicationDeliveryJobsLoading=false;
    render();
  }
}
```

Add actions:

- `Queue Delivery` for packages
- `Retry Delivery` for latest failed job

Use:

```js
async function queueWitnessPublicationDelivery(packageId){
  state.pendingWitnessQueuedDeliveryIds[packageId]=true;
  render();
  try{
    const res=await fetch("/api/witness/publication-delivery-jobs",{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ packageId, backend:"azure-blob" })
    });
    const data=await res.json().catch(()=>null);
    if(!res.ok){setError(data?.error||"Failed to queue publication delivery",data);return}
    await loadWitnessPublicationDeliveryJobs();
  }finally{
    delete state.pendingWitnessQueuedDeliveryIds[packageId];
    render();
  }
}
```

Render per package:

- latest job status
- `Queue Delivery`
- if latest job is `failed`, `Retry Delivery`
- error state distinct from empty state

- [ ] **Step 2: Extend the Witness smoke path through queued delivery**

Update `scripts/smoke-tests.ts`:

```ts
const jobStore = new FileWitnessPublicationDeliveryJobStore(
  witnessPublicationBundleRoot
);

const queuedJob = await enqueueWitnessPublicationDeliveryJob({
  packageId: packageRecord.id,
  packageStore: publicationPackageStore,
  jobStore,
  backend: "azure-blob",
});

assert.equal(queuedJob.status, "queued");

const processedJob = await processNextWitnessPublicationDeliveryJob({
  publicationBundleRoot: witnessPublicationBundleRoot,
  packageStore: publicationPackageStore,
  jobStore,
  deliveryStore,
  backend: {
    name: "azure-blob",
    async putObject(input) {
      const target = path.join(fakeRemoteRoot, input.key.replaceAll("/", path.sep));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, await readFile(input.filePath));
      return {
        remoteKey: input.key,
        remoteUrl: `file://${target.replaceAll("\\\\", "/")}`,
      };
    },
  },
});

assert.equal(processedJob?.status, "succeeded");
assert.equal(processedJob?.backend, "azure-blob");
assert.ok(processedJob?.lastAttemptId);
assert.deepEqual(
  await readFile(path.join(fakeRemoteRoot, (await deliveryStore.load(processedJob!.lastAttemptId!))!.remoteKey.replaceAll("/", path.sep))),
  await readFile(packageRecord.packagePath)
);
```

- [ ] **Step 3: Update docs**

Update `README.md` with one short note:

```md
Witness remote package delivery now supports explicit queued/background processing on top of the existing package layer. Queued jobs are tracked separately from concrete delivery attempts, retries are operator-triggered, and the queue still uploads the existing `.zip` unchanged.
```

Update `docs/operator-handbook.md` with a new subsection:

```md
### 3.10 Queue Witness publication deliveries

Queued Witness delivery jobs allow operators to enqueue package uploads without running them in the request path.

APIs:
- `POST /api/witness/publication-delivery-jobs`
- `GET /api/witness/publication-delivery-jobs?packageId=...&bundleId=...&witnessId=...&testimonyId=...`
- `GET /api/witness/publication-delivery-jobs/:id`
- `POST /api/witness/publication-delivery-jobs/:id/retry`

Operational rules:
- queued jobs are separate from concrete delivery attempts
- only one queued job is processed at a time
- failed jobs remain failed until an operator explicitly retries them
- restart reconciliation converts stale `in_progress` jobs into `failed` jobs with a recovery note
- queued processing still uploads the existing package unchanged
```

- [ ] **Step 4: Run full verification**

Run:

```bash
pnpm typecheck
pnpm test
pnpm smoke
```

Expected:

- `pnpm typecheck` → PASS
- `pnpm test` → PASS
- `pnpm smoke` → PASS

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/public/inquiry.html scripts/smoke-tests.ts README.md docs/operator-handbook.md
git commit -m "feat: add witness queued delivery ui"
```

## Self-Review

- Spec coverage:
  - separate `PublicationDeliveryJobRecord`: covered in Tasks 1, 2, 3, and 4
  - in-process file-backed queue: covered in Tasks 2 and 3
  - one active job at a time: covered in Task 2 runtime and Task 3 server worker wiring
  - manual retry only: covered in Tasks 2, 3, and 4
  - restart reconciliation of stale `in_progress` jobs: covered in Tasks 2 and 3
  - package unchanged and delivery attempts preserved: covered in Tasks 2 and 4
- Placeholder scan:
  - no `TODO`/`TBD`
  - every code-changing step includes concrete code
  - verification commands are explicit
- Type consistency:
  - `PublicationDeliveryJobRecord`, `PublicationDeliveryJobStatus`, `lastAttemptId`, and retry semantics are introduced before use
  - `queued | in_progress | succeeded | failed` are used consistently across store, runtime, API, UI, smoke, and docs

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-20-witness-queued-remote-delivery.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
