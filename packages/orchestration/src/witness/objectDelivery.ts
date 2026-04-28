export interface PutObjectInput {
  key: string;
  filePath: string;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface PutObjectResult {
  remoteKey: string;
  remoteUrl?: string;
}

export type ObjectDeliveryBackendName = "azure-blob" | "s3";

export interface ObjectDeliveryBackend {
  name: ObjectDeliveryBackendName;
  putObject(input: PutObjectInput): Promise<PutObjectResult>;
}

import { AzureBlobObjectDelivery } from "./azureBlobObjectDelivery";
import { S3ObjectDelivery } from "./s3ObjectDelivery";

export function getPublicationObjectDeliveryBackend(
  backendName: ObjectDeliveryBackend["name"]
): ObjectDeliveryBackend {
  switch (backendName) {
    case "azure-blob":
      return new AzureBlobObjectDelivery();
    case "s3":
      return new S3ObjectDelivery();
    default:
      throw new Error(
        `Unknown publication object delivery backend: ${backendName as string}`
      );
  }
}
