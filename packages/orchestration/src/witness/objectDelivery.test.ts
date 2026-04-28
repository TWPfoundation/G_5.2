import assert from "node:assert/strict";
import test from "node:test";

import {
  getPublicationObjectDeliveryBackend,
  type ObjectDeliveryBackend,
} from "./objectDelivery";
import { AzureBlobObjectDelivery } from "./azureBlobObjectDelivery";
import { S3ObjectDelivery } from "./s3ObjectDelivery";

test("getPublicationObjectDeliveryBackend resolves azure-blob", () => {
  const backend = getPublicationObjectDeliveryBackend("azure-blob");
  assert.equal(backend.name, "azure-blob");
  assert.ok(backend instanceof AzureBlobObjectDelivery);
});

test("getPublicationObjectDeliveryBackend resolves s3", () => {
  const backend = getPublicationObjectDeliveryBackend("s3");
  assert.equal(backend.name, "s3");
  assert.ok(backend instanceof S3ObjectDelivery);
});

test("getPublicationObjectDeliveryBackend rejects unknown backends", () => {
  assert.throws(
    () =>
      getPublicationObjectDeliveryBackend(
        "not-real" as unknown as ObjectDeliveryBackend["name"]
      ),
    /Unknown publication object delivery backend/i
  );
});

test("AzureBlobObjectDelivery uploads through Azure Blob semantics", async () => {
  const calls: Array<{
    key: string;
    filePath: string;
    options: {
      blobHTTPHeaders: { blobContentType: string };
      metadata?: Record<string, string>;
    };
  }> = [];

  const backend = new AzureBlobObjectDelivery({
    connectionString: "UseDevelopmentStorage=true",
    containerName: "witness",
    createBlobServiceClient: (connectionString) => {
      assert.equal(connectionString, "UseDevelopmentStorage=true");
      return {
        getContainerClient(containerName) {
          assert.equal(containerName, "witness");
          return {
            getBlockBlobClient(key) {
              return {
                url: `https://example.invalid/${key}`,
                async uploadFile(filePath, options) {
                  calls.push({ key, filePath, options });
                },
              };
            },
          };
        },
      };
    },
  });

  const result = await backend.putObject({
    key: "witness/wit-1/testimony/testimony-1/packages/bundle-1.zip",
    filePath: "C:/tmp/bundle-1.zip",
    contentType: "application/zip",
    metadata: {
      packageId: "bundle-1",
      bundleId: "bundle-1",
    },
  });

  assert.deepEqual(calls, [
    {
      key: "witness/wit-1/testimony/testimony-1/packages/bundle-1.zip",
      filePath: "C:/tmp/bundle-1.zip",
      options: {
        blobHTTPHeaders: {
          blobContentType: "application/zip",
        },
        metadata: {
          packageId: "bundle-1",
          bundleId: "bundle-1",
        },
      },
    },
  ]);
  assert.deepEqual(result, {
    remoteKey: "witness/wit-1/testimony/testimony-1/packages/bundle-1.zip",
    remoteUrl:
      "https://example.invalid/witness/wit-1/testimony/testimony-1/packages/bundle-1.zip",
  });
});

test("AzureBlobObjectDelivery rejects missing Azure config", async () => {
  const connectionString = process.env.AZURE_BLOB_CONNECTION_STRING;
  const containerName = process.env.AZURE_BLOB_CONTAINER_NAME;

  delete process.env.AZURE_BLOB_CONNECTION_STRING;
  delete process.env.AZURE_BLOB_CONTAINER_NAME;

  try {
    const backend = new AzureBlobObjectDelivery();
    await assert.rejects(
      () =>
        backend.putObject({
          key: "witness/wit-1/testimony/testimony-1/packages/bundle-1.zip",
          filePath: "C:/tmp/bundle-1.zip",
          contentType: "application/zip",
        }),
      /Missing Azure Blob delivery config/i
    );
  } finally {
    if (connectionString === undefined) {
      delete process.env.AZURE_BLOB_CONNECTION_STRING;
    } else {
      process.env.AZURE_BLOB_CONNECTION_STRING = connectionString;
    }

    if (containerName === undefined) {
      delete process.env.AZURE_BLOB_CONTAINER_NAME;
    } else {
      process.env.AZURE_BLOB_CONTAINER_NAME = containerName;
    }
  }
});

test("S3ObjectDelivery uploads through S3 PutObject semantics", async () => {
  const sentCommands: Array<{
    Bucket: string;
    Key: string;
    ContentType: string;
    Metadata?: Record<string, string>;
  }> = [];

  const backend = new S3ObjectDelivery({
    endpoint: "https://test-project.supabase.co/storage/v1/s3",
    region: "us-east-1",
    bucket: "witness-publications",
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
    forcePathStyle: true,
    createBody: (filePath) => Buffer.from(`mock:${filePath}`),
    createS3Client: (_config) => ({
      async send(command: { input: typeof sentCommands[0] }) {
        sentCommands.push(command.input);
      },
    }),
  });

  const result = await backend.putObject({
    key: "witness/wit-1/testimony/testimony-1/packages/bundle-1.zip",
    filePath: "C:/tmp/bundle-1.zip",
    contentType: "application/zip",
    metadata: {
      packageId: "bundle-1",
      bundleId: "bundle-1",
    },
  });

  assert.equal(sentCommands.length, 1);
  assert.equal(sentCommands[0].Bucket, "witness-publications");
  assert.equal(
    sentCommands[0].Key,
    "witness/wit-1/testimony/testimony-1/packages/bundle-1.zip"
  );
  assert.equal(sentCommands[0].ContentType, "application/zip");
  assert.deepEqual(sentCommands[0].Metadata, {
    packageId: "bundle-1",
    bundleId: "bundle-1",
  });

  assert.deepEqual(result, {
    remoteKey: "witness/wit-1/testimony/testimony-1/packages/bundle-1.zip",
    remoteUrl:
      "https://test-project.supabase.co/storage/v1/s3/witness-publications/witness/wit-1/testimony/testimony-1/packages/bundle-1.zip",
  });
});

test("S3ObjectDelivery rejects missing S3 config", async () => {
  const s3Endpoint = process.env.S3_ENDPOINT;
  const s3Region = process.env.S3_REGION;
  const s3Bucket = process.env.S3_BUCKET;
  const s3AccessKey = process.env.S3_ACCESS_KEY_ID;
  const s3SecretKey = process.env.S3_SECRET_ACCESS_KEY;

  delete process.env.S3_ENDPOINT;
  delete process.env.S3_REGION;
  delete process.env.S3_BUCKET;
  delete process.env.S3_ACCESS_KEY_ID;
  delete process.env.S3_SECRET_ACCESS_KEY;

  try {
    const backend = new S3ObjectDelivery();
    await assert.rejects(
      () =>
        backend.putObject({
          key: "witness/wit-1/testimony/testimony-1/packages/bundle-1.zip",
          filePath: "C:/tmp/bundle-1.zip",
          contentType: "application/zip",
        }),
      /Missing S3 delivery config/i
    );
  } finally {
    const restore = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore("S3_ENDPOINT", s3Endpoint);
    restore("S3_REGION", s3Region);
    restore("S3_BUCKET", s3Bucket);
    restore("S3_ACCESS_KEY_ID", s3AccessKey);
    restore("S3_SECRET_ACCESS_KEY", s3SecretKey);
  }
});
