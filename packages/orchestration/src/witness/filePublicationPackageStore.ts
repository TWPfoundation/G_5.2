import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type {
  PublicationPackageRecord,
  PublicationPackageStore,
} from "../../../witness-types/src/publicationPackage";

export interface CreatePublicationPackageInput {
  id?: string;
  bundleId: string;
  witnessId: string;
  testimonyId: string;
  archiveCandidateId: string;
  createdAt: string;
  packagePath: string;
  packageFilename: string;
  packageSha256: string;
  packageByteSize: number;
  sourceBundleJsonPath: string;
  sourceBundleMarkdownPath: string;
  sourceBundleManifestPath: string;
}

export class FileWitnessPublicationPackageStore
  implements PublicationPackageStore
{
  constructor(private readonly rootDir: string) {}

  private recordsDir(): string {
    return path.join(this.rootDir, "package-records");
  }

  private filePath(recordId: string): string {
    return path.join(this.recordsDir(), `${recordId}.json`);
  }

  async load(packageId: string): Promise<PublicationPackageRecord | null> {
    try {
      const raw = await readFile(this.filePath(packageId), "utf8");
      return JSON.parse(raw) as PublicationPackageRecord;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async list(): Promise<PublicationPackageRecord[]> {
    try {
      const files = await readdir(this.recordsDir());
      const records = await Promise.all(
        files
          .filter((file) => file.endsWith(".json"))
          .map(async (file) => {
            const raw = await readFile(path.join(this.recordsDir(), file), "utf8");
            return JSON.parse(raw) as PublicationPackageRecord;
          })
      );
      return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async findByBundleId(
    bundleId: string
  ): Promise<PublicationPackageRecord | null> {
    const records = await this.list();
    return records.find((record) => record.bundleId === bundleId) ?? null;
  }

  async save(
    record: PublicationPackageRecord
  ): Promise<PublicationPackageRecord> {
    await mkdir(this.recordsDir(), { recursive: true });
    await writeFile(
      this.filePath(record.id),
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8"
    );
    return record;
  }

  async delete(packageId: string): Promise<boolean> {
    try {
      await rm(this.filePath(packageId));
      return true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return false;
      }
      throw error;
    }
  }

  async create(
    input: CreatePublicationPackageInput
  ): Promise<PublicationPackageRecord> {
    const now = input.createdAt;
    return this.save({
      id: input.id ?? randomUUID(),
      bundleId: input.bundleId,
      witnessId: input.witnessId,
      testimonyId: input.testimonyId,
      archiveCandidateId: input.archiveCandidateId,
      createdAt: input.createdAt,
      updatedAt: now,
      status: "created",
      packagePath: input.packagePath,
      packageFilename: input.packageFilename,
      packageSha256: input.packageSha256,
      packageByteSize: input.packageByteSize,
      sourceBundleJsonPath: input.sourceBundleJsonPath,
      sourceBundleMarkdownPath: input.sourceBundleMarkdownPath,
      sourceBundleManifestPath: input.sourceBundleManifestPath,
    });
  }
}
