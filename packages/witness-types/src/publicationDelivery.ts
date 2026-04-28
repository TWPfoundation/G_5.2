export type PublicationDeliveryBackend = "azure-blob" | "s3";
export type PublicationDeliveryStatus = "succeeded" | "failed";

export interface PublicationDeliveryRecord {
  id: string;
  packageId: string;
  bundleId: string;
  witnessId: string;
  testimonyId: string;
  backend: PublicationDeliveryBackend;
  status: PublicationDeliveryStatus;
  createdAt: string;
  updatedAt: string;
  remoteKey: string;
  remoteUrl?: string;
  error?: string;
}

export interface PublicationDeliveryStore {
  load(deliveryId: string): Promise<PublicationDeliveryRecord | null>;
  list(filters?: {
    packageId?: string;
    bundleId?: string;
    witnessId?: string;
    testimonyId?: string;
  }): Promise<PublicationDeliveryRecord[]>;
  findLatestByPackageId(
    packageId: string
  ): Promise<PublicationDeliveryRecord | null>;
  save(
    record: PublicationDeliveryRecord
  ): Promise<PublicationDeliveryRecord>;
  delete(deliveryId: string): Promise<boolean>;
}
