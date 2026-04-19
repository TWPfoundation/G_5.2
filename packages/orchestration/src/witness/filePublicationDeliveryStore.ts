import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  PublicationDeliveryRecord,
  PublicationDeliveryStore,
} from "../../../witness-types/src/publicationDelivery";

export interface CreatePublicationDeliveryInput {
  id?: string;
  packageId: string;
  bundleId: string;
  witnessId: string;
  testimonyId: string;
  backend: PublicationDeliveryRecord["backend"];
  status: PublicationDeliveryRecord["status"];
  createdAt: string;
  remoteKey: string;
  remoteUrl?: string;
  error?: string;
}

export class FileWitnessPublicationDeliveryStore
  implements PublicationDeliveryStore
{
  constructor(private readonly rootDir: string) {}

  private compareRecords(
    a: PublicationDeliveryRecord,
    b: PublicationDeliveryRecord
  ): number {
    return (
      a.createdAt.localeCompare(b.createdAt) ||
      a.updatedAt.localeCompare(b.updatedAt) ||
      a.id.localeCompare(b.id)
    );
  }

  private recordsDir(): string {
    return path.join(this.rootDir, "delivery-records");
  }

  private filePath(recordId: string): string {
    return path.join(this.recordsDir(), `${recordId}.json`);
  }

  async load(deliveryId: string): Promise<PublicationDeliveryRecord | null> {
    try {
      const raw = await readFile(this.filePath(deliveryId), "utf8");
      return JSON.parse(raw) as PublicationDeliveryRecord;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async list(filters?: {
    packageId?: string;
    bundleId?: string;
    witnessId?: string;
    testimonyId?: string;
  }): Promise<PublicationDeliveryRecord[]> {
    try {
      const files = await readdir(this.recordsDir());
      const records = await Promise.all(
        files
          .filter((file) => file.endsWith(".json"))
          .map(async (file) => {
            const raw = await readFile(path.join(this.recordsDir(), file), "utf8");
            return JSON.parse(raw) as PublicationDeliveryRecord;
          })
      );

      return records
        .filter(
          (record) =>
            (!filters?.packageId || record.packageId === filters.packageId) &&
            (!filters?.bundleId || record.bundleId === filters.bundleId) &&
            (!filters?.witnessId || record.witnessId === filters.witnessId) &&
            (!filters?.testimonyId ||
              record.testimonyId === filters.testimonyId)
        )
        .sort((a, b) => this.compareRecords(a, b));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async findLatestByPackageId(
    packageId: string
  ): Promise<PublicationDeliveryRecord | null> {
    const records = await this.list({ packageId });
    return records.at(-1) ?? null;
  }

  async save(
    record: PublicationDeliveryRecord
  ): Promise<PublicationDeliveryRecord> {
    await mkdir(this.recordsDir(), { recursive: true });
    await writeFile(
      this.filePath(record.id),
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8"
    );
    return record;
  }

  async delete(deliveryId: string): Promise<boolean> {
    try {
      await rm(this.filePath(deliveryId));
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
    input: CreatePublicationDeliveryInput
  ): Promise<PublicationDeliveryRecord> {
    return this.save({
      id: input.id ?? randomUUID(),
      packageId: input.packageId,
      bundleId: input.bundleId,
      witnessId: input.witnessId,
      testimonyId: input.testimonyId,
      backend: input.backend,
      status: input.status,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      remoteKey: input.remoteKey,
      ...(input.remoteUrl ? { remoteUrl: input.remoteUrl } : {}),
      ...(input.error ? { error: input.error } : {}),
    });
  }
}
