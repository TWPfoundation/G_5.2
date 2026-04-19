export interface PublicationBundleExportEntry {
  filename: string;
  sha256: string;
  contentType:
    | "application/json; charset=utf-8"
    | "text/markdown; charset=utf-8";
}

export interface PublicationBundleManifest {
  schemaVersion: "0.1.0";
  bundleId: string;
  witnessId: string;
  archiveCandidateId: string;
  testimonyId: string;
  testimonyUpdatedAt: string;
  synthesisId: string;
  annotationId: string;
  createdAt: string;
  exports: {
    json: PublicationBundleExportEntry;
    markdown: PublicationBundleExportEntry;
  };
}
