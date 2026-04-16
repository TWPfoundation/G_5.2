import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ContextSnapshotSchema,
  type PersistedContextSnapshot,
} from "./contextSnapshotSchema";
import { SCHEMA_VERSIONS, SchemaMigrationError } from "./schemaVersions";

function snapshotPath(rootDir: string, id: string): string {
  return path.join(rootDir, `${id}.json`);
}

function migrateSnapshot(raw: unknown): PersistedContextSnapshot {
  if (typeof raw !== "object" || raw === null) {
    throw new SchemaMigrationError(
      "contextSnapshot",
      raw,
      "snapshot is not an object"
    );
  }
  const record = raw as Record<string, unknown>;
  const version =
    typeof record.schemaVersion === "number" ? record.schemaVersion : undefined;
  if (version !== undefined && version > SCHEMA_VERSIONS.contextSnapshot) {
    throw new SchemaMigrationError(
      "contextSnapshot",
      version,
      `newer than supported (${SCHEMA_VERSIONS.contextSnapshot})`
    );
  }
  const parsed = ContextSnapshotSchema.safeParse({
    ...record,
    schemaVersion: SCHEMA_VERSIONS.contextSnapshot,
  });
  if (!parsed.success) {
    throw new SchemaMigrationError(
      "contextSnapshot",
      version ?? "unversioned",
      parsed.error.message
    );
  }
  return parsed.data;
}

export class FileContextSnapshotStore {
  constructor(private readonly rootDir: string) {}

  get root(): string {
    return this.rootDir;
  }

  async save(snapshot: PersistedContextSnapshot): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
    await writeFile(
      snapshotPath(this.rootDir, snapshot.id),
      `${JSON.stringify(snapshot, null, 2)}\n`,
      "utf8"
    );
  }

  async load(id: string): Promise<PersistedContextSnapshot | null> {
    try {
      const raw = await readFile(snapshotPath(this.rootDir, id), "utf8");
      return migrateSnapshot(JSON.parse(raw));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return null;
      throw error;
    }
  }

  async list(): Promise<PersistedContextSnapshot[]> {
    if (!existsSync(this.rootDir)) return [];
    const files = await readdir(this.rootDir);
    const items = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          const raw = await readFile(path.join(this.rootDir, f), "utf8");
          return migrateSnapshot(JSON.parse(raw));
        })
    );
    return items;
  }
}

export function defaultContextSnapshotRoot(sessionsRoot: string): string {
  return path.join(path.dirname(sessionsRoot), "context-snapshots");
}
