import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";

import {
  FileWitnessAnnotationStore,
  FileWitnessArchiveCandidateStore,
  FileWitnessPublicationBundleStore,
  FileWitnessSynthesisStore,
} from "./fileDraftStores";
import { FileWitnessTestimonyStore } from "./fileTestimonyStore";
import { createWitnessPublicationBundle } from "./publicationRuntime";

test("PublicationBundle createWitnessPublicationBundle requires publication_ready candidate and writes immutable export files", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "g52-witness-publication-runtime-")
  );

  try {
    const testimonyStore = new FileWitnessTestimonyStore(path.join(root, "testimony"));
    const synthesisStore = new FileWitnessSynthesisStore(path.join(root, "synthesis"));
    const annotationStore = new FileWitnessAnnotationStore(path.join(root, "annotations"));
    const archiveCandidateStore = new FileWitnessArchiveCandidateStore(path.join(root, "archive"));
    const publicationBundleStore = new FileWitnessPublicationBundleStore(
      path.join(root, "bundle-records")
    );
    const publicationBundleRoot = path.join(root, "bundle-exports");

    const testimony = await testimonyStore.save({
      id: "testimony-publication",
      witnessId: "wit-publication",
      sessionId: "session-publication",
      state: "sealed",
      createdAt: "2026-04-19T09:00:00.000Z",
      updatedAt: "2026-04-19T09:05:00.000Z",
      title: "Publication testimony",
      segments: [
        {
          id: "seg-publication-1",
          role: "witness",
          text: "I arrived before dawn and saw the lights go out.",
          createdAt: "2026-04-19T09:00:00.000Z",
        },
        {
          id: "seg-publication-2",
          role: "inquisitor",
          text: "What happened next?",
          createdAt: "2026-04-19T09:01:00.000Z",
        },
      ],
    });
    const synthesis = await synthesisStore.save({
      id: "synth-publication",
      witnessId: testimony.witnessId,
      testimonyId: testimony.id,
      createdAt: "2026-04-19T09:06:00.000Z",
      updatedAt: "2026-04-19T09:06:00.000Z",
      status: "approved",
      source: "operator",
      text: "The witness reports arriving before dawn and observing a power loss.",
    });
    const annotation = await annotationStore.save({
      id: "annot-publication",
      witnessId: testimony.witnessId,
      testimonyId: testimony.id,
      createdAt: "2026-04-19T09:07:00.000Z",
      updatedAt: "2026-04-19T09:07:00.000Z",
      status: "approved",
      source: "operator",
      entries: [
        {
          id: "entry-publication-1",
          labelId: "STR-chronology",
          labelName: "chronology",
          segmentId: "seg-publication-1",
          startOffset: 10,
          endOffset: 22,
          quote: testimony.segments[0].text.slice(10, 22),
          rationale: "Marks the timing reference.",
        },
      ],
    });
    const archiveCandidate = await archiveCandidateStore.save({
      id: "candidate-publication",
      witnessId: testimony.witnessId,
      testimonyId: testimony.id,
      testimonyUpdatedAt: "2026-04-19T09:04:30.000Z",
      approvedSynthesisId: synthesis.id,
      approvedAnnotationId: annotation.id,
      createdAt: "2026-04-19T09:08:00.000Z",
      updatedAt: "2026-04-19T09:09:00.000Z",
      status: "publication_ready",
      reviewNote: "Archive review approved.",
      publicationNote: "Ready to export.",
    });

    const beforeTestimony = await testimonyStore.load(testimony.id);
    const beforeSynthesis = await synthesisStore.load(synthesis.id);
    const beforeAnnotation = await annotationStore.load(annotation.id);
    const beforeCandidate = await archiveCandidateStore.load(archiveCandidate.id);

    const bundle = await createWitnessPublicationBundle({
      publicationBundleRoot,
      archiveCandidateId: archiveCandidate.id,
      testimonyStore,
      synthesisStore,
      annotationStore,
      archiveCandidateStore,
      publicationBundleStore,
    });

    assert.equal(bundle.archiveCandidateId, archiveCandidate.id);
    assert.equal(
      bundle.sourceTestimonyUpdatedAt,
      archiveCandidate.testimonyUpdatedAt
    );
    assert.equal(bundle.sourceSynthesisId, synthesis.id);
    assert.equal(bundle.sourceAnnotationId, annotation.id);
    assert.match(bundle.bundleJsonPath, /\.json$/);
    assert.match(bundle.bundleMarkdownPath ?? "", /\.md$/);

    const bundlePayload = JSON.parse(
      await readFile(bundle.bundleJsonPath, "utf8")
    ) as {
      schemaVersion: string;
      witnessId: string;
      testimony: unknown;
      synthesis: unknown;
      annotations: unknown;
      archiveCandidate: { testimonyUpdatedAt: string };
    };
    assert.equal(bundlePayload.schemaVersion, "0.1.0");
    assert.equal(bundlePayload.witnessId, testimony.witnessId);
    assert.deepEqual(bundlePayload.testimony, testimony);
    assert.deepEqual(bundlePayload.synthesis, synthesis);
    assert.deepEqual(bundlePayload.annotations, annotation.entries);
    assert.equal(
      bundlePayload.archiveCandidate.testimonyUpdatedAt,
      archiveCandidate.testimonyUpdatedAt
    );

    const markdown = await readFile(bundle.bundleMarkdownPath as string, "utf8");
    assert.match(markdown, /Publication Bundle/);
    assert.match(markdown, new RegExp(testimony.witnessId));

    assert.deepEqual(await testimonyStore.load(testimony.id), beforeTestimony);
    assert.deepEqual(await synthesisStore.load(synthesis.id), beforeSynthesis);
    assert.deepEqual(await annotationStore.load(annotation.id), beforeAnnotation);
    assert.deepEqual(
      await archiveCandidateStore.load(archiveCandidate.id),
      beforeCandidate
    );

    const storedBundle = await publicationBundleStore.load(bundle.id);
    assert.deepEqual(storedBundle, bundle);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("PublicationBundle createWitnessPublicationBundle rejects non-publication-ready candidates", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "g52-witness-publication-runtime-reject-")
  );

  try {
    const testimonyStore = new FileWitnessTestimonyStore(path.join(root, "testimony"));
    const synthesisStore = new FileWitnessSynthesisStore(path.join(root, "synthesis"));
    const annotationStore = new FileWitnessAnnotationStore(path.join(root, "annotations"));
    const archiveCandidateStore = new FileWitnessArchiveCandidateStore(path.join(root, "archive"));
    const publicationBundleStore = new FileWitnessPublicationBundleStore(
      path.join(root, "bundle-records")
    );

    await testimonyStore.save({
      id: "testimony-not-ready",
      witnessId: "wit-not-ready",
      sessionId: "session-not-ready",
      state: "sealed",
      createdAt: "2026-04-19T10:00:00.000Z",
      updatedAt: "2026-04-19T10:01:00.000Z",
      segments: [],
    });
    await synthesisStore.save({
      id: "synth-not-ready",
      witnessId: "wit-not-ready",
      testimonyId: "testimony-not-ready",
      createdAt: "2026-04-19T10:02:00.000Z",
      updatedAt: "2026-04-19T10:02:00.000Z",
      status: "approved",
      source: "operator",
      text: "Approved synthesis",
    });
    await annotationStore.save({
      id: "annot-not-ready",
      witnessId: "wit-not-ready",
      testimonyId: "testimony-not-ready",
      createdAt: "2026-04-19T10:03:00.000Z",
      updatedAt: "2026-04-19T10:03:00.000Z",
      status: "approved",
      source: "operator",
      entries: [],
    });
    const archiveCandidate = await archiveCandidateStore.save({
      id: "candidate-not-ready",
      witnessId: "wit-not-ready",
      testimonyId: "testimony-not-ready",
      testimonyUpdatedAt: "2026-04-19T10:01:00.000Z",
      approvedSynthesisId: "synth-not-ready",
      approvedAnnotationId: "annot-not-ready",
      createdAt: "2026-04-19T10:04:00.000Z",
      updatedAt: "2026-04-19T10:04:00.000Z",
      status: "archive_review_approved",
    });

    await assert.rejects(
      () =>
        createWitnessPublicationBundle({
          publicationBundleRoot: path.join(root, "bundle-exports"),
          archiveCandidateId: archiveCandidate.id,
          testimonyStore,
          synthesisStore,
          annotationStore,
          archiveCandidateStore,
          publicationBundleStore,
        }),
      /publication_ready/i
    );

    await assert.rejects(
      () =>
        createWitnessPublicationBundle({
          publicationBundleRoot: path.join(root, "bundle-exports"),
          archiveCandidateId: "missing-candidate",
          testimonyStore,
          synthesisStore,
          annotationStore,
          archiveCandidateStore,
          publicationBundleStore,
        }),
      /unknown archive candidate/i
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("PublicationBundle createWitnessPublicationBundle rejects source records that are not sealed and approved", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "g52-witness-publication-runtime-source-state-")
  );

  try {
    const testimonyStore = new FileWitnessTestimonyStore(path.join(root, "testimony"));
    const synthesisStore = new FileWitnessSynthesisStore(path.join(root, "synthesis"));
    const annotationStore = new FileWitnessAnnotationStore(path.join(root, "annotations"));
    const archiveCandidateStore = new FileWitnessArchiveCandidateStore(path.join(root, "archive"));
    const publicationBundleStore = new FileWitnessPublicationBundleStore(
      path.join(root, "bundle-records")
    );

    const testimony = await testimonyStore.save({
      id: "testimony-source-state",
      witnessId: "wit-source-state",
      sessionId: "session-source-state",
      state: "retained",
      createdAt: "2026-04-19T11:00:00.000Z",
      updatedAt: "2026-04-19T11:01:00.000Z",
      segments: [],
    });
    const synthesis = await synthesisStore.save({
      id: "synth-source-state",
      witnessId: testimony.witnessId,
      testimonyId: testimony.id,
      createdAt: "2026-04-19T11:02:00.000Z",
      updatedAt: "2026-04-19T11:02:00.000Z",
      status: "approved",
      source: "operator",
      text: "Approved synthesis",
    });
    const annotation = await annotationStore.save({
      id: "annot-source-state",
      witnessId: testimony.witnessId,
      testimonyId: testimony.id,
      createdAt: "2026-04-19T11:03:00.000Z",
      updatedAt: "2026-04-19T11:03:00.000Z",
      status: "approved",
      source: "operator",
      entries: [],
    });
    const archiveCandidate = await archiveCandidateStore.save({
      id: "candidate-source-state",
      witnessId: testimony.witnessId,
      testimonyId: testimony.id,
      testimonyUpdatedAt: "2026-04-19T11:01:00.000Z",
      approvedSynthesisId: synthesis.id,
      approvedAnnotationId: annotation.id,
      createdAt: "2026-04-19T11:04:00.000Z",
      updatedAt: "2026-04-19T11:04:00.000Z",
      status: "publication_ready",
    });

    await assert.rejects(
      () =>
        createWitnessPublicationBundle({
          publicationBundleRoot: path.join(root, "bundle-exports"),
          archiveCandidateId: archiveCandidate.id,
          testimonyStore,
          synthesisStore,
          annotationStore,
          archiveCandidateStore,
          publicationBundleStore,
        }),
      /sealed/i
    );

    await testimonyStore.save({
      ...testimony,
      state: "sealed",
    });
    await synthesisStore.save({
      ...synthesis,
      status: "draft",
    });

    await assert.rejects(
      () =>
        createWitnessPublicationBundle({
          publicationBundleRoot: path.join(root, "bundle-exports"),
          archiveCandidateId: archiveCandidate.id,
          testimonyStore,
          synthesisStore,
          annotationStore,
          archiveCandidateStore,
          publicationBundleStore,
        }),
      /approved synthesis/i
    );

    await synthesisStore.save({
      ...synthesis,
      status: "approved",
    });
    await annotationStore.save({
      ...annotation,
      status: "draft",
    });

    await assert.rejects(
      () =>
        createWitnessPublicationBundle({
          publicationBundleRoot: path.join(root, "bundle-exports"),
          archiveCandidateId: archiveCandidate.id,
          testimonyStore,
          synthesisStore,
          annotationStore,
          archiveCandidateStore,
          publicationBundleStore,
        }),
      /approved annotation/i
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
