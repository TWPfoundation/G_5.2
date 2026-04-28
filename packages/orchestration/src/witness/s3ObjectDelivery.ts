import type { S3Client as S3ClientType, PutObjectCommandInput } from "@aws-sdk/client-s3";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createReadStream } from "node:fs";
import type { ReadStream } from "node:fs";

import type {
  ObjectDeliveryBackend,
  PutObjectInput,
  PutObjectResult,
} from "./objectDelivery";

/**
 * Minimal interface mirroring the subset of S3Client that this adapter uses.
 * Enables dependency injection for unit tests without pulling in the full SDK.
 */
interface S3ClientLike {
  send(command: PutObjectCommandLike): Promise<unknown>;
}

interface PutObjectCommandLike {
  readonly input: {
    Bucket?: string;
    Key?: string;
    ContentType?: string;
    Metadata?: Record<string, string>;
  };
}

type S3ClientConfig = {
  endpoint?: string;
  region?: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
  forcePathStyle?: boolean;
};

export interface S3ObjectDeliveryOptions {
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
  /** Dependency injection seam for tests. */
  createS3Client?: (config: S3ClientConfig) => S3ClientLike;
  /** Override the Body factory for testing (avoids real file reads). */
  createBody?: (filePath: string) => ReadStream | Buffer;
}

function getRequiredConfigValue(name: string, value?: string): string {
  const trimmed = value?.trim() ?? process.env[name]?.trim();
  if (!trimmed) {
    throw new Error(`Missing S3 delivery config: ${name}`);
  }
  return trimmed;
}

export class S3ObjectDelivery implements ObjectDeliveryBackend {
  readonly name = "s3" as const;

  constructor(private readonly options: S3ObjectDeliveryOptions = {}) {}

  private createClient(config: S3ClientConfig): S3ClientLike {
    if (this.options.createS3Client) {
      return this.options.createS3Client(config);
    }
    return new S3Client(config);
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const endpoint = getRequiredConfigValue(
      "S3_ENDPOINT",
      this.options.endpoint
    );
    const region = getRequiredConfigValue("S3_REGION", this.options.region);
    const bucket = getRequiredConfigValue("S3_BUCKET", this.options.bucket);
    const accessKeyId = getRequiredConfigValue(
      "S3_ACCESS_KEY_ID",
      this.options.accessKeyId
    );
    const secretAccessKey = getRequiredConfigValue(
      "S3_SECRET_ACCESS_KEY",
      this.options.secretAccessKey
    );
    const envPathStyle = process.env.S3_FORCE_PATH_STYLE?.trim()?.toLowerCase();
    const forcePathStyle =
      this.options.forcePathStyle ??
      (envPathStyle !== undefined ? envPathStyle === "true" : true);

    const client = this.createClient({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle,
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: (this.options.createBody ?? createReadStream)(input.filePath),
      ContentType: input.contentType,
      Metadata: input.metadata,
    });

    await client.send(command);

    // Construct the public URL.
    // For path-style endpoints (Supabase, MinIO): {endpoint}/{bucket}/{key}
    // For virtual-hosted (AWS): https://{bucket}.s3.{region}.amazonaws.com/{key}
    const remoteUrl = forcePathStyle
      ? `${endpoint.replace(/\/+$/, "")}/${bucket}/${input.key}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${input.key}`;

    return {
      remoteKey: input.key,
      remoteUrl,
    };
  }
}
