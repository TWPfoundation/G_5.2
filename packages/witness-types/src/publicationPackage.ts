export type PublicationPackageStatus = "created";

export interface PublicationPackageRecord {
  id: string;
  bundleId: string;
  witnessId: string;
  testimonyId: string;
  archiveCandidateId: string;
  createdAt: string;
  updatedAt: string;
  status: PublicationPackageStatus;
  packagePath: string;
  packageFilename: string;
  packageSha256: string;
  packageByteSize: number;
  sourceBundleJsonPath: string;
  sourceBundleMarkdownPath: string;
  sourceBundleManifestPath: string;
}

export interface PublicationPackageStore {
  load(packageId: string): Promise<PublicationPackageRecord | null>;
  list(): Promise<PublicationPackageRecord[]>;
  findByBundleId(bundleId: string): Promise<PublicationPackageRecord | null>;
  save(
    record: PublicationPackageRecord
  ): Promise<PublicationPackageRecord>;
  delete(packageId: string): Promise<boolean>;
}
