import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, readFile, rm, writeFile, readdir } from "node:fs/promises";

import { FileWitnessPublicationBundleStore } from "./fileDraftStores";
import { FileWitnessPublicationPackageStore } from "./filePublicationPackageStore";
import { createWitnessPublicationPackage } from "./publicationPackageRuntime";

interface YauzlEntryLike {
  fileName: string;
}

interface YauzlZipFileLike {
  readEntry(): void;
  openReadStream(
    entry: YauzlEntryLike,
    callback: (
      error: Error | null,
      stream: NodeJS.ReadableStream | null
    ) => void
  ): void;
  close(): void;
  on(event: "entry", listener: (entry: YauzlEntryLike) => void): this;
  once(event: "end" | "error", listener: (error?: Error) => void): this;
}

type YauzlModuleLike = {
  open(
    path: string,
    options: { lazyEntries: boolean },
    callback: (error: Error | null, zipFile: YauzlZipFileLike | undefined) => void
  ): void;
};

const require = createRequire(import.meta.url);
const yauzl = require("yauzl") as YauzlModuleLike;

function sha256(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}

function openZip(zipPath: string): Promise<YauzlZipFileLike> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (error, zipFile) => {
      if (error) {
        reject(error);
        return;
      }
      if (!zipFile) {
        reject(new Error(`Unable to open zip archive: ${zipPath}`));
        return;
      }
      resolve(zipFile);
    });
  });
}

async function readZipEntries(zipPath: string): Promise<
  Array<{ fileName: string; bytes: Buffer }>
> {
  const zipFile = await openZip(zipPath);

  return new Promise((resolve, reject) => {
    const entries: Array<{ fileName: string; bytes: Buffer }> = [];

    zipFile.on("entry", (entry) => {
      zipFile.openReadStream(entry, (streamError, stream) => {
        if (streamError) {
          zipFile.close();
          reject(streamError);
          return;
        }
        if (!stream) {
          zipFile.close();
          reject(new Error(`Missing read stream for zip entry ${entry.fileName}`));
          return;
        }

        const chunks: Buffer[] = [];
        stream.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        stream.on("error", (error) => {
          zipFile.close();
          reject(error);
        });
        stream.on("end", () => {
          entries.push({
            fileName: entry.fileName,
            bytes: Buffer.concat(chunks),
          });
          zipFile.readEntry();
        });
      });
    });

    zipFile.once("end", () => {
      zipFile.close();
      resolve(entries);
    });
    zipFile.once("error", (error) => {
      zipFile.close();
      reject(error);
    });

    zipFile.readEntry();
  });
}

class ThrowingPublicationPackageStore extends FileWitnessPublicationPackageStore {
  override async create(
    _input: Parameters<FileWitnessPublicationPackageStore["create"]>[0]
  ): Promise<never> {
    throw new Error("simulated publication package store failure");
  }
}

test("PublicationPackage createWitnessPublicationPackage creates a deterministic zip and reuses it for the same bundle", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "g52-witness-publication-package-runtime-")
  );

  try {
    const publicationBundleRoot = path.join(root, "publication-bundles");
    const exportsRoot = path.join(publicationBundleRoot, "exports");
    const publicationBundleStore = new FileWitnessPublicationBundleStore(
      publicationBundleRoot
    );
    const publicationPackageStore = new FileWitnessPublicationPackageStore(
      publicationBundleRoot
    );
    await mkdir(exportsRoot, { recursive: true });

    await writeFile(
      path.join(exportsRoot, "bundle-1.json"),
      `${JSON.stringify({ bundleId: "bundle-1", ok: true }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      path.join(exportsRoot, "bundle-1.md"),
      "# Bundle 1\n\nDeterministic markdown body.\n",
      "utf8"
    );
    await writeFile(
      path.join(exportsRoot, "bundle-1-manifest.json"),
      `${JSON.stringify(
        {
          schemaVersion: "0.1.0",
          bundleId: "bundle-1",
          createdAt: "2026-04-19T16:01:00.000Z",
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const bundle = await publicationBundleStore.create({
      id: "bundle-1",
      witnessId: "witness-1",
      testimonyId: "testimony-1",
      archiveCandidateId: "candidate-1",
      sourceTestimonyUpdatedAt: "2026-04-19T16:00:30.000Z",
      sourceSynthesisId: "synthesis-1",
      sourceAnnotationId: "annotation-1",
      createdAt: "2026-04-19T16:01:00.000Z",
      bundleJsonPath: path.join(exportsRoot, "bundle-1.json"),
      bundleMarkdownPath: path.join(exportsRoot, "bundle-1.md"),
      bundleManifestPath: path.join(exportsRoot, "bundle-1-manifest.json"),
    });

    const firstPackage = await createWitnessPublicationPackage({
      publicationBundleRoot,
      bundleId: bundle.id,
      publicationBundleStore,
      publicationPackageStore,
    });
    const secondPackage = await createWitnessPublicationPackage({
      publicationBundleRoot,
      bundleId: bundle.id,
      publicationBundleStore,
      publicationPackageStore,
    });

    assert.equal(
      firstPackage.packageFilename,
      "bundle-1--2026-04-19T16-01-00-000Z.zip"
    );
    assert.equal(secondPackage.id, firstPackage.id);
    assert.equal(secondPackage.packageSha256, firstPackage.packageSha256);
    assert.equal(secondPackage.packageByteSize, firstPackage.packageByteSize);
    assert.equal(secondPackage.packagePath, firstPackage.packagePath);

    const packageBytes = await readFile(firstPackage.packagePath);
    const zipEntries = await readZipEntries(firstPackage.packagePath);

    assert.deepEqual(
      zipEntries.map((entry) => entry.fileName),
      ["README.txt", "bundle.json", "bundle.md", "manifest.json"]
    );
    assert.equal(firstPackage.packageSha256, sha256(packageBytes));
    assert.equal(firstPackage.packageByteSize, packageBytes.byteLength);

    const [readmeEntry, bundleJsonEntry, bundleMarkdownEntry, manifestEntry] =
      zipEntries;
    assert.match(readmeEntry.bytes.toString("utf8"), /bundle-1/);
    assert.equal(
      bundleJsonEntry.bytes.toString("utf8"),
      await readFile(bundle.bundleJsonPath, "utf8")
    );
    assert.equal(
      bundleMarkdownEntry.bytes.toString("utf8"),
      await readFile(bundle.bundleMarkdownPath as string, "utf8")
    );
    assert.equal(
      manifestEntry.bytes.toString("utf8"),
      await readFile(bundle.bundleManifestPath, "utf8")
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("PublicationPackage createWitnessPublicationPackage rolls back a partial zip when package store persistence fails", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "g52-witness-publication-package-rollback-")
  );

  try {
    const publicationBundleRoot = path.join(root, "publication-bundles");
    const exportsRoot = path.join(publicationBundleRoot, "exports");
    const publicationBundleStore = new FileWitnessPublicationBundleStore(
      publicationBundleRoot
    );
    const publicationPackageStore = new ThrowingPublicationPackageStore(
      publicationBundleRoot
    );
    await mkdir(exportsRoot, { recursive: true });

    await writeFile(
      path.join(exportsRoot, "bundle-rollback.json"),
      "{}\n",
      "utf8"
    );
    await writeFile(
      path.join(exportsRoot, "bundle-rollback.md"),
      "# Rollback\n",
      "utf8"
    );
    await writeFile(
      path.join(exportsRoot, "bundle-rollback-manifest.json"),
      "{}\n",
      "utf8"
    );

    await publicationBundleStore.create({
      id: "bundle-rollback",
      witnessId: "witness-rollback",
      testimonyId: "testimony-rollback",
      archiveCandidateId: "candidate-rollback",
      sourceTestimonyUpdatedAt: "2026-04-19T16:10:00.000Z",
      sourceSynthesisId: "synthesis-rollback",
      sourceAnnotationId: "annotation-rollback",
      createdAt: "2026-04-19T16:11:00.000Z",
      bundleJsonPath: path.join(exportsRoot, "bundle-rollback.json"),
      bundleMarkdownPath: path.join(exportsRoot, "bundle-rollback.md"),
      bundleManifestPath: path.join(
        exportsRoot,
        "bundle-rollback-manifest.json"
      ),
    });

    await assert.rejects(
      () =>
        createWitnessPublicationPackage({
          publicationBundleRoot,
          bundleId: "bundle-rollback",
          publicationBundleStore,
          publicationPackageStore,
        }),
      /simulated publication package store failure/i
    );

    const packagesRoot = path.join(publicationBundleRoot, "packages");
    assert.deepEqual(await readdir(packagesRoot), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
