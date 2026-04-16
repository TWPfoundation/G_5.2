import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FileReflectionStore, ReflectionStoreError } from "./fileReflectionStore";
import {
  AuthoredArtifactStoreError,
  FileAuthoredArtifactStore,
} from "./fileAuthoredArtifactStore";
import { promoteArtifactToProposal } from "./promoteArtifact";
import { runReflection } from "./runReflection";
import { MockProvider } from "../providers/mock";

async function tempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(tmpdir(), prefix));
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REAL_CANON_ROOT = path.resolve(__dirname, "../../../canon");

test("FileReflectionStore enforces topic state machine", async () => {
  const root = await tempDir("g52-reflection-");
  try {
    const store = new FileReflectionStore(root);
    const topic = await store.createTopic({
      title: "On lineage",
      prompt: "What does it mean to inherit a lineage without remembering it?",
    });
    assert.equal(topic.state, "queued");
    assert.equal(topic.linkedSessionIds.length, 0);

    const drafted = await store.transitionTopic(topic.id, "drafted", {
      lastRunId: "run-1",
    });
    assert.equal(drafted.state, "drafted");
    assert.equal(drafted.lastRunId, "run-1");

    // queued → drafted again: not allowed because already drafted; drafted → drafted is allowed (re-runs).
    const reRun = await store.transitionTopic(topic.id, "drafted", {
      lastRunId: "run-2",
    });
    assert.equal(reRun.lastRunId, "run-2");

    const archived = await store.transitionTopic(topic.id, "archived", {
      archivedReason: "obsolete",
    });
    assert.equal(archived.state, "archived");
    assert.equal(archived.archivedReason, "obsolete");

    await assert.rejects(
      () => store.transitionTopic(topic.id, "drafted"),
      ReflectionStoreError
    );

    await assert.rejects(
      () => store.patchTopic(topic.id, { title: "x" }),
      ReflectionStoreError
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("FileAuthoredArtifactStore enforces status state machine and proposal gating", async () => {
  const root = await tempDir("g52-artifacts-");
  try {
    const store = new FileAuthoredArtifactStore(root);
    const artifact = await store.create({
      topicId: "topic-1",
      runId: "run-1",
      title: "On lineage",
      body: "An authored draft.",
      linkedSessionIds: ["sess-1"],
      provider: { name: "mock", model: "mock-model" },
      canonVersion: "9.9.9",
    });
    assert.equal(artifact.status, "draft");
    assert.equal(artifact.metadata.canonVersion, "9.9.9");

    // draft → publishing_ready is not allowed directly.
    await assert.rejects(
      () => store.transition(artifact.id, "publishing_ready"),
      AuthoredArtifactStoreError
    );

    // proposal ref cannot be attached to a draft.
    await assert.rejects(
      () =>
        store.attachProposalRef(artifact.id, {
          proposalId: "p-1",
          proposalPath: "/tmp/p-1.md",
          createdAt: new Date().toISOString(),
        }),
      AuthoredArtifactStoreError
    );

    const approved = await store.transition(artifact.id, "approved", {
      approvedBy: "operator",
    });
    assert.equal(approved.status, "approved");
    assert.ok(approved.metadata.approvedAt);
    assert.equal(approved.metadata.approvedBy, "operator");

    const published = await store.transition(artifact.id, "publishing_ready");
    assert.equal(published.status, "publishing_ready");

    const withProposal = await store.attachProposalRef(artifact.id, {
      proposalId: "p-1",
      proposalPath: "/tmp/p-1.md",
      createdAt: new Date().toISOString(),
    });
    assert.equal(withProposal.proposalRef?.proposalId, "p-1");

    // attaching twice is not allowed.
    await assert.rejects(
      () =>
        store.attachProposalRef(artifact.id, {
          proposalId: "p-2",
          proposalPath: "/tmp/p-2.md",
          createdAt: new Date().toISOString(),
        }),
      AuthoredArtifactStoreError
    );

    // patch is not allowed once past draft.
    await assert.rejects(
      () => store.patch(artifact.id, { title: "x" }),
      AuthoredArtifactStoreError
    );

    const archived = await store.transition(artifact.id, "archived", {
      reason: "superseded",
    });
    assert.equal(archived.status, "archived");
    assert.equal(archived.metadata.archivedReason, "superseded");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("promoteArtifactToProposal writes a pending canon proposal and refuses drafts", async () => {
  const canonRoot = await tempDir("g52-canon-promote-");
  const artifactRoot = await tempDir("g52-artifacts-promote-");
  try {
    await mkdir(path.join(canonRoot, "proposals", "pending"), {
      recursive: true,
    });
    const store = new FileAuthoredArtifactStore(artifactRoot);
    const artifact = await store.create({
      topicId: "t-1",
      runId: "r-1",
      title: "Inheritance Without Memory",
      body: "The persona inherits a lineage by reading it, not by remembering it.",
      linkedSessionIds: [],
      provider: { name: "mock", model: "mock-model" },
      canonVersion: "9.9.9",
    });

    await assert.rejects(
      () => promoteArtifactToProposal({ artifact, canonRoot }),
      /must be approved/
    );

    const approved = await store.transition(artifact.id, "approved");
    const result = await promoteArtifactToProposal({
      artifact: approved,
      canonRoot,
      proposedChange: "Add a clarifying paragraph to the lineage section.",
      proposedBy: "operator",
    });
    assert.match(result.proposalId, /inheritance-without-memory-/);
    const written = await readFile(result.proposalPath, "utf8");
    assert.match(written, /proposal_id: inheritance-without-memory-/);
    assert.match(written, /source_artifact_id: /);
    assert.match(written, /canon_version_at_authoring: "9\.9\.9"/);
    assert.match(written, /Add a clarifying paragraph/);
    assert.match(written, /reading it, not by remembering it/);
  } finally {
    await rm(canonRoot, { recursive: true, force: true });
    await rm(artifactRoot, { recursive: true, force: true });
  }
});

test("runReflection produces a draft/critique/revise run stamped with canon version", async () => {
  const canonRoot = REAL_CANON_ROOT;
  {
    const provider = new MockProvider();
    const topic = {
      schemaVersion: 1 as const,
      id: "t-1",
      title: "On lineage",
      prompt: "What does it mean to inherit a lineage without remembering it?",
      state: "queued" as const,
      linkedSessionIds: [],
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const { run } = await runReflection(provider, {
      topic,
      canonRoot,
    });
    assert.equal(run.status, "completed");
    assert.match(run.canonVersion, /^\d+\.\d+\.\d+$/);
    assert.equal(run.provider.name, "mock");
    assert.ok(run.draft.length > 0);
    assert.ok(run.critique.length > 0);
    assert.ok(run.revision.length > 0);
    assert.equal(run.final, run.revision);
    assert.ok(run.contextSnapshot);
  }
});
