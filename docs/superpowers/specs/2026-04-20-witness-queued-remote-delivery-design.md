# Witness Queued Remote Delivery Design

## Summary

Add the next Witness delivery slice as a **queued, in-process, file-backed remote delivery system** on top of the existing remote package delivery flow.

This slice should preserve the current architectural boundary:

- the publication package remains the artifact of record
- remote delivery still uploads the existing `.zip` unchanged
- `PublicationDeliveryRecord` remains the audit log for concrete upload attempts
- queue state is tracked separately through a new `PublicationDeliveryJobRecord`

The first queued version should stay narrow:

- queue jobs are created explicitly by the operator
- processing is handled by a small in-process worker loop inside the dashboard/server
- only one delivery job runs at a time
- failed jobs remain failed until the operator explicitly retries

## Goals

- add queued/background remote delivery without changing the package boundary
- keep queue state distinct from delivery-attempt audit state
- make restart/recovery behavior explicit
- preserve operator control over retries
- keep the transport adapter contract unchanged

## Non-Goals

- no distributed queue
- no separate worker process in this slice
- no automatic retry budget
- no package mutation, repacking, or content regeneration
- no backend-specific queue logic
- no cross-product queue surface for P-E-S

## Design Constraints

### 1. Package remains the artifact of record

Queued delivery must still resolve an already-created `PublicationPackageRecord` and upload that exact package file unchanged.

### 2. Queue state and delivery attempts are separate concepts

Queued work should not overload `PublicationDeliveryRecord`.

- `PublicationDeliveryJobRecord` tracks lifecycle of queued work
- `PublicationDeliveryRecord` tracks actual remote upload attempts/results

This keeps retries, history, and operator auditability clear.

### 3. Manual retry only

When a queued job fails, it stays failed until the operator explicitly retries it.

No automatic retry count, no backoff logic, and no transient-error classification should be introduced in this slice.

### 4. In-process single-node worker only

The queue runner should live inside the dashboard/server process and use the existing file-backed Witness roots.

This is intentionally scoped to the current operator-box model.

### 5. One active job at a time

Only one queued delivery job should execute at a time in the first version.

This keeps concurrency, locking, and restart recovery simple while the job model is new.

### 6. Restart behavior must be explicit

If the process restarts while a job is `in_progress`, the system must not assume success.

On startup, `in_progress` jobs should be reconciled into an explicit retryable non-terminal state or a failed state with a recovery note. This design recommends reconciliation to `failed`.

## Proposed Architecture

### Existing records remain

Keep the current delivery-attempt layer unchanged in role:

- `PublicationPackageRecord` identifies the package artifact
- `PublicationDeliveryRecord` records one concrete upload attempt/result

### New queue record

Add `PublicationDeliveryJobRecord` as the queue/state model.

Recommended fields:

- `id`
- `packageId`
- `bundleId`
- `witnessId`
- `testimonyId`
- `backend`
- `status`
- `createdAt`
- `updatedAt`
- `lastAttemptId?`
- `error?`
- `recoveredFromRestartAt?`

Recommended status values:

- `queued`
- `in_progress`
- `succeeded`
- `failed`

Recommended semantics:

- `queued`: waiting to be processed
- `in_progress`: actively owned by the in-process worker
- `succeeded`: completed successfully; points to `lastAttemptId`
- `failed`: most recent attempt failed or was recovered from interrupted in-progress state

### Storage layout

Extend the current Witness publication-bundles layout:

- `data/witness/publication-bundles/records/`
- `data/witness/publication-bundles/exports/`
- `data/witness/publication-bundles/packages/`
- `data/witness/publication-bundles/package-records/`
- `data/witness/publication-bundles/delivery-records/`
- `data/witness/publication-bundles/delivery-jobs/`

Queue records remain local and product-scoped, just like delivery records.

### Queue worker model

The dashboard/server owns a small in-process polling loop.

Recommended behavior:

- start on server boot
- reconcile stale `in_progress` jobs before polling
- poll at a small fixed interval
- if no job is active, claim the oldest `queued` job
- transition it to `in_progress`
- run the existing delivery runtime against the job’s `packageId` and `backend`
- write a `PublicationDeliveryRecord`
- update the job to `succeeded` or `failed`

### Claiming model

Because this is a single-node in-process queue, job claiming can remain file-backed and simple:

- list queued jobs ordered by `createdAt`
- attempt an atomic save/update of the chosen job to `in_progress`
- if another loop iteration or process state changed the job first, skip and poll again

Even though only one active job is expected, the claim path should still be explicit rather than relying on implicit memory-only state.

### Restart reconciliation

On server startup:

- list all `in_progress` jobs
- mark each one as `failed`
- record:
  - `updatedAt`
  - `error: "Recovered from interrupted in-progress delivery"`
  - `recoveredFromRestartAt`

This keeps auditability explicit and avoids any silent assumption that a remote upload completed successfully.

### Retry model

Retry is explicit and operator-triggered.

Recommended behavior:

- `POST /api/witness/publication-delivery-jobs/:id/retry`
- allowed only for `failed` jobs
- retry creates a **new queued job**
- original failed job remains unchanged for audit history

This keeps job history append-only in practice, like delivery attempts.

## Operator Flow

### Enqueue

From the existing Witness package section, the operator should be able to:

- select an existing package
- choose `Queue Delivery`

The request should:

1. load the existing package record
2. create a queued delivery job
3. return that job immediately
4. allow the in-process worker to pick it up asynchronously

### Observe status

The dashboard should show per-package delivery job state in a minimal form:

- latest queued job status
- backend
- createdAt / updatedAt
- error when failed
- linked last delivery attempt when available

### Retry

For a failed job, the operator can choose `Retry Delivery`.

That action should enqueue a new job rather than mutating the existing failed job back to `queued`.

## API Surface

Keep this within the existing dashboard server.

Recommended endpoints:

- `POST /api/witness/publication-delivery-jobs`
  - body: `{ packageId, backend? }`
- `GET /api/witness/publication-delivery-jobs?packageId=...&bundleId=...&witnessId=...&testimonyId=...`
- `GET /api/witness/publication-delivery-jobs/:id`
- `POST /api/witness/publication-delivery-jobs/:id/retry`

Behavior:

- unknown package or job ids return `404`
- malformed ids or missing required body fields return `400`
- broken local package state during processing results in a failed job plus failed delivery semantics as appropriate
- enqueue itself should be local and synchronous
- actual remote upload happens in the worker loop, not in the request path

## Error Handling

Queue creation should fail if:

- the package record does not exist
- the backend is unknown
- the request body is malformed

Queued processing should fail if:

- the package path is missing or invalid
- the resolved package path escapes the canonical packages root
- the package file is missing
- the backend is misconfigured
- the remote upload fails

Failure handling rules:

- failed processing should write a `failed` `PublicationDeliveryRecord` when the upload attempt meaningfully started, consistent with the current synchronous design
- the job itself should move to `failed`
- package records and package files must remain unchanged

## Testing Strategy

### Runtime/store tests

- `PublicationDeliveryJobRecord` store round-trips queued/in-progress/succeeded/failed
- queue runner claims only one job at a time
- startup reconciliation converts stale `in_progress` jobs to `failed`
- queued processing creates a delivery attempt and updates the job correctly
- failed processing leaves package file and package record unchanged
- retry creates a new queued job from a failed job

### Server tests

- enqueue/list/detail/retry routes behave as documented
- malformed ids return `400`
- unknown ids return `404`
- retry on non-failed job returns `409`
- queue creation is synchronous while actual upload is asynchronous

### UI tests

- Witness package UI exposes `Queue Delivery`
- failed jobs expose `Retry Delivery`
- queued/in-progress/failed/succeeded state renders distinctly
- job-load failures render as errors, not as an empty state

### Smoke

Extend the Witness smoke path:

1. create publication bundle
2. create packaged export
3. enqueue a delivery job through the operator-facing route
4. allow the in-process worker path to process it with a fake backend
5. verify the package file is unchanged
6. verify a queued job reaches `succeeded`
7. verify a `PublicationDeliveryRecord` is written

## Recommended Follow-On

If this slice works well, the next layer should be:

- automatic bounded retry policy
- or a separate worker process, if operational complexity actually demands it

Neither should change the package boundary or replace the delivery-record audit model.

## Recommendation

Build the next delivery slice as a **file-backed in-process queued delivery system** with:

- separate `PublicationDeliveryJobRecord`
- manual retry only
- one active job at a time
- explicit restart reconciliation of stale `in_progress` jobs

This is the cleanest next step because:

- it extends the current architecture instead of replacing it
- it preserves package-as-artifact-of-record
- it keeps queue state and upload audit state separate
- it adds operational robustness without prematurely introducing a distributed worker model
