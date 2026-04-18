import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AnnotationRecord } from "../../../witness-types/src/annotation";
import type { ArchiveCandidateRecord } from "../../../witness-types/src/archiveCandidate";
import type { SynthesisRecord } from "../../../witness-types/src/synthesis";
import type { TestimonyRecord } from "../../../witness-types/src/testimony";
import type { FileWitnessAnnotationStore, FileWitnessArchiveCandidateStore, FileWitnessPublicationBundleStore, FileWitnessSynthesisStore } from "./fileDraftStores";
import type { FileWitnessTestimonyStore } from "./fileTestimonyStore";

export interface CreateWitnessPublicationBundleInput {
  publicationBundleRoot: string;
  archiveCandidateId: string;
  testimonyStore: FileWitnessTestimonyStore;
  synthesisStore: FileWitnessSynthesisStore;
  annotationStore: FileWitnessAnnotationStore;
  archiveCandidateStore: FileWitnessArchiveCandidateStore;
  publicationBundleStore: FileWitnessPublicationBundleStore;
}

interface WitnessPublicationBundlePayload {
  schemaVersion: "0.1.0";
  witnessId: string;
  testimony: TestimonyRecord;
  synthesis: SynthesisRecord;
  annotations: AnnotationRecord["entries"];
  archiveCandidate: {
    id: string;
    testimonyId: string;
    testimonyUpdatedAt: string;
    status: ArchiveCandidateRecord["status"];
    reviewNote?: string;
    publicationNote?: string;
    approvedSynthesisId: string;
    approvedAnnotationId: string;
    createdAt: string;
    updatedAt: string;
  };
}

async function loadArchiveCandidateOrThrow(
  archiveCandidateStore: FileWitnessArchiveCandidateStore,
  archiveCandidateId: string
) {
  const archiveCandidate = await archiveCandidateStore.load(archiveCandidateId);
  if (!archiveCandidate) {
    throw new Error(`Unknown archive candidate: ${archiveCandidateId}`);
  }
  if (archiveCandidate.status !== "publication_ready") {
    throw new Error(
      "Witness publication bundle creation requires a publication_ready archive candidate."
    );
  }
  return archiveCandidate;
}

async function loadTestimonyOrThrow(
  testimonyStore: FileWitnessTestimonyStore,
  testimonyId: string
) {
  const testimony = await testimonyStore.load(testimonyId);
  if (!testimony) {
    throw new Error(`Unknown testimony record: ${testimonyId}`);
  }
  if (testimony.state !== "sealed") {
    throw new Error(
      "Witness publication bundle creation requires a sealed testimony."
    );
  }
  return testimony;
}

async function loadSynthesisOrThrow(
  synthesisStore: FileWitnessSynthesisStore,
  synthesisId: string
) {
  const synthesis = await synthesisStore.load(synthesisId);
  if (!synthesis) {
    throw new Error(`Unknown synthesis record: ${synthesisId}`);
  }
  if (synthesis.status !== "approved") {
    throw new Error(
      "Witness publication bundle creation requires an approved synthesis."
    );
  }
  return synthesis;
}

async function loadAnnotationOrThrow(
  annotationStore: FileWitnessAnnotationStore,
  annotationId: string
) {
  const annotation = await annotationStore.load(annotationId);
  if (!annotation) {
    throw new Error(`Unknown annotation record: ${annotationId}`);
  }
  if (annotation.status !== "approved") {
    throw new Error(
      "Witness publication bundle creation requires an approved annotation."
    );
  }
  return annotation;
}

function buildPublicationBundlePayload(
  testimony: TestimonyRecord,
  synthesis: SynthesisRecord,
  annotation: AnnotationRecord,
  archiveCandidate: ArchiveCandidateRecord
): WitnessPublicationBundlePayload {
  return {
    schemaVersion: "0.1.0",
    witnessId: testimony.witnessId,
    testimony,
    synthesis,
    annotations: annotation.entries,
    archiveCandidate: {
      id: archiveCandidate.id,
      testimonyId: archiveCandidate.testimonyId,
      testimonyUpdatedAt: archiveCandidate.testimonyUpdatedAt,
      status: archiveCandidate.status,
      approvedSynthesisId: archiveCandidate.approvedSynthesisId,
      approvedAnnotationId: archiveCandidate.approvedAnnotationId,
      createdAt: archiveCandidate.createdAt,
      updatedAt: archiveCandidate.updatedAt,
      ...(archiveCandidate.reviewNote
        ? { reviewNote: archiveCandidate.reviewNote }
        : {}),
      ...(archiveCandidate.publicationNote
        ? { publicationNote: archiveCandidate.publicationNote }
        : {}),
    },
  };
}

function buildPublicationBundleMarkdown(
  payload: WitnessPublicationBundlePayload
): string {
  return [
    "# Publication Bundle",
    "",
    `- Witness ID: ${payload.witnessId}`,
    `- Testimony ID: ${payload.testimony.id}`,
    `- Archive Candidate ID: ${payload.archiveCandidate.id}`,
    `- Source Testimony Updated At: ${payload.archiveCandidate.testimonyUpdatedAt}`,
    `- Synthesis ID: ${payload.synthesis.id}`,
    `- Annotation ID: ${payload.archiveCandidate.approvedAnnotationId}`,
    "",
    "## Synthesis",
    "",
    payload.synthesis.text,
    "",
    `## Annotation Entries (${payload.annotations.length})`,
  ].join("\n");
}

export async function createWitnessPublicationBundle(
  input: CreateWitnessPublicationBundleInput
) {
  const archiveCandidate = await loadArchiveCandidateOrThrow(
    input.archiveCandidateStore,
    input.archiveCandidateId
  );
  const testimony = await loadTestimonyOrThrow(
    input.testimonyStore,
    archiveCandidate.testimonyId
  );
  const synthesis = await loadSynthesisOrThrow(
    input.synthesisStore,
    archiveCandidate.approvedSynthesisId
  );
  const annotation = await loadAnnotationOrThrow(
    input.annotationStore,
    archiveCandidate.approvedAnnotationId
  );

  const payload = buildPublicationBundlePayload(
    testimony,
    synthesis,
    annotation,
    archiveCandidate
  );
  const exportId = randomUUID();
  const bundleJsonPath = path.join(
    input.publicationBundleRoot,
    `${archiveCandidate.id}-${exportId}.json`
  );
  const bundleMarkdownPath = path.join(
    input.publicationBundleRoot,
    `${archiveCandidate.id}-${exportId}.md`
  );

  await mkdir(input.publicationBundleRoot, { recursive: true });
  await writeFile(bundleJsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(
    bundleMarkdownPath,
    `${buildPublicationBundleMarkdown(payload)}\n`,
    "utf8"
  );

  return input.publicationBundleStore.create({
    witnessId: testimony.witnessId,
    testimonyId: testimony.id,
    archiveCandidateId: archiveCandidate.id,
    sourceTestimonyUpdatedAt: archiveCandidate.testimonyUpdatedAt,
    sourceSynthesisId: synthesis.id,
    sourceAnnotationId: annotation.id,
    createdAt: new Date().toISOString(),
    bundleJsonPath,
    bundleMarkdownPath,
  });
}
