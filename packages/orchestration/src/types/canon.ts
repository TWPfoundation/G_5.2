/**
 * Runtime types for the orchestration layer.
 *
 * YAML-shape types (CanonManifest, ContinuityFact, etc.) are inferred
 * from Zod schemas in ../schemas/canon and re-exported here so
 * downstream consumers have a single import path.
 *
 * Runtime/loader types (CanonDocument, LoadedCanon) are defined here
 * because they represent the post-load in-memory shape, not the on-disk
 * YAML shape.
 */

export type {
  CanonManifest,
  CanonManifestDocument,
  CanonManifestRecoveredArtifact,
  ContinuityFact,
  ContinuityFactsFile,
  GlossaryFile,
  GlossaryTerm,
  RecoveredIndex,
  RecoveredIndexArtifact,
} from "../schemas/canon";

// ── Runtime types ──────────────────────────────────────────────────────────────

/** A canon document loaded from disk — .md content resolved, path recorded. */
export interface CanonDocument {
  slug: string;
  path: string;
  title: string;
  content: string;
  type: string;
  status: import("../schemas/canon").CanonManifestDocument["status"];
  priority: number;
  retrievalTags: string[];
}

export interface LoadedRecoveredArtifact {
  slug: string;
  title: string;
  class: import("../schemas/canon").CanonManifestRecoveredArtifact["class"];
  status: import("../schemas/canon").CanonManifestRecoveredArtifact["status"];
  recoveryStatus: import("../schemas/canon").RecoveredIndexArtifact["recovery_status"];
  sourceModel: string;
  approximateDate: string;
  retrievalTags: string[];
  retrievalConditions: string[];
  authority: string;
  behavioralBinding: boolean;
  rhetoricalOnlyClaims: string[];
  artifactPath: string;
  provenancePath: string;
  content: string;
  provenance: string;
}

/** The fully loaded canon state passed around the pipeline. */
export interface LoadedCanon {
  rootDir: string;
  manifest: import("../schemas/canon").CanonManifest;
  documents: CanonDocument[];
  continuityFacts: import("../schemas/canon").ContinuityFact[];
  glossary: import("../schemas/canon").GlossaryFile;
  recoveredArtifacts: LoadedRecoveredArtifact[];
}
