import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  ContextSnapshotSchema,
  type PersistedContextSnapshot,
} from "./contextSnapshotSchema";
import {
  defaultContextSnapshotRoot,
  FileContextSnapshotStore,
} from "./fileContextSnapshotStore";
import { migrateSession } from "./migrations";
import { InquirySessionSchema } from "./sessionSchema";
import type { PersistedInquirySession } from "./sessionSchema";
import { SCHEMA_VERSIONS, SchemaMigrationError } from "./schemaVersions";
import { FileSessionStore } from "../sessions/fileSessionStore";
import type { InquirySession } from "../types/session";

export const SessionArchiveSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSIONS.archive),
  kind: z.literal("session"),
  exportedAt: z.string().min(1),
  session: InquirySessionSchema,
  contextSnapshots: z.array(ContextSnapshotSchema),
});

export type SessionArchive = z.infer<typeof SessionArchiveSchema>;

export interface ExportSessionBundleInput {
  sessionsRoot: string;
  snapshotsRoot?: string;
  sessionId: string;
  outputPath: string;
}

export async function exportSessionBundle(
  input: ExportSessionBundleInput
): Promise<SessionArchive> {
  const sessionStore = new FileSessionStore(input.sessionsRoot);
  const session = await sessionStore.load(input.sessionId);
  if (!session) {
    throw new Error(
      `exportSessionBundle: session not found (id=${input.sessionId})`
    );
  }

  const snapshotStore = new FileContextSnapshotStore(
    input.snapshotsRoot ?? defaultContextSnapshotRoot(input.sessionsRoot)
  );

  const snapshotIds = new Set(
    session.turns
      .map((t) => t.contextSnapshotId)
      .filter((id): id is string => typeof id === "string")
  );

  const contextSnapshots: PersistedContextSnapshot[] = [];
  for (const id of snapshotIds) {
    const snap = await snapshotStore.load(id);
    if (snap) {
      contextSnapshots.push(snap);
    }
  }

  const bundle: SessionArchive = {
    schemaVersion: SCHEMA_VERSIONS.archive,
    kind: "session",
    exportedAt: new Date().toISOString(),
    session: {
      ...(session as unknown as PersistedInquirySession),
      schemaVersion: SCHEMA_VERSIONS.session,
    },
    contextSnapshots,
  };

  await mkdir(path.dirname(input.outputPath), { recursive: true });
  await writeFile(
    input.outputPath,
    `${JSON.stringify(bundle, null, 2)}\n`,
    "utf8"
  );

  return bundle;
}

export interface ImportSessionBundleInput {
  bundlePath: string;
  sessionsRoot: string;
  snapshotsRoot?: string;
  overwrite?: boolean;
}

export async function importSessionBundle(
  input: ImportSessionBundleInput
): Promise<{ session: InquirySession; snapshotIds: string[] }> {
  const raw = await readFile(input.bundlePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const bundleResult = SessionArchiveSchema.safeParse(parsed);
  if (!bundleResult.success) {
    throw new SchemaMigrationError(
      "archive",
      (parsed as { schemaVersion?: unknown })?.schemaVersion,
      `invalid session archive: ${bundleResult.error.message}`
    );
  }

  const bundle = bundleResult.data;
  const sessionStore = new FileSessionStore(input.sessionsRoot);
  const snapshotStore = new FileContextSnapshotStore(
    input.snapshotsRoot ??
      defaultContextSnapshotRoot(input.sessionsRoot)
  );

  if (!input.overwrite) {
    const existing = await sessionStore.load(bundle.session.id);
    if (existing) {
      throw new Error(
        `importSessionBundle: session already exists (id=${bundle.session.id}). Pass overwrite: true to replace.`
      );
    }
  }

  for (const snapshot of bundle.contextSnapshots) {
    await snapshotStore.save(snapshot);
  }

  // Run through the standard migration path (idempotent) to ensure the
  // written file is in the canonical current shape.
  const normalized = migrateSession(bundle.session) as InquirySession;
  await sessionStore.save(normalized);

  return {
    session: normalized,
    snapshotIds: bundle.contextSnapshots.map((s) => s.id),
  };
}
