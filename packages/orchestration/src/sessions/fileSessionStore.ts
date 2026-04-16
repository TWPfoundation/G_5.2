import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { migrateSession } from "../persistence/migrations";
import { SCHEMA_VERSIONS } from "../persistence/schemaVersions";
import type { InquirySession, SessionStore } from "../types/session";

function sessionPath(rootDir: string, sessionId: string): string {
  return path.join(rootDir, `${sessionId}.json`);
}

export class FileSessionStore implements SessionStore {
  constructor(private readonly rootDir: string) {}

  async load(sessionId: string): Promise<InquirySession | null> {
    try {
      const raw = await readFile(sessionPath(this.rootDir, sessionId), "utf8");
      return migrateSession(JSON.parse(raw)) as InquirySession;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  async save(session: InquirySession): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
    const payload: InquirySession = {
      ...session,
      schemaVersion: SCHEMA_VERSIONS.session,
    };
    await writeFile(
      sessionPath(this.rootDir, session.id),
      `${JSON.stringify(payload, null, 2)}\n`,
      "utf8"
    );
  }
}
