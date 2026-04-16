import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MemoryFixtureSchema,
  type MemoryCandidate,
  type MemoryItem,
  type MemorySourceRef,
  type MemoryStoredItemSnapshot,
} from "../schemas/memory";
import type { MemoryStore } from "../types/memory";

function memoryPath(rootDir: string, memoryId: string): string {
  return path.join(rootDir, `${memoryId}.json`);
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeStatement(value: string): string {
  return normalizeWhitespace(value)
    .replace(/[.?!]+$/g, "")
    .trim();
}

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags) {
    const value = normalizeWhitespace(tag).toLowerCase();
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

function dedupeKey(
  candidate: Pick<MemoryCandidate, "type" | "scope" | "statement"> & {
    sessionId?: string;
  }
): string {
  return [
    candidate.type,
    candidate.scope,
    candidate.scope === "session" ? candidate.sessionId ?? "" : "",
    normalizeStatement(candidate.statement).toLowerCase(),
  ].join("::");
}

async function parseMemoryFile(filePath: string): Promise<MemoryItem> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return MemoryFixtureSchema.element.parse(parsed);
}

export class FileMemoryStore implements MemoryStore {
  constructor(private readonly rootDir: string) {}

  async load(memoryId: string): Promise<MemoryItem | null> {
    try {
      return await parseMemoryFile(memoryPath(this.rootDir, memoryId));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return null;
      }

      throw error;
    }
  }

  async list(): Promise<MemoryItem[]> {
    if (!existsSync(this.rootDir)) {
      return [];
    }

    const files = await readdir(this.rootDir);
    const items = await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map((file) => parseMemoryFile(path.join(this.rootDir, file)))
    );

    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async upsert(
    candidate: MemoryCandidate,
    source: MemorySourceRef
  ): Promise<MemoryStoredItemSnapshot> {
    await mkdir(this.rootDir, { recursive: true });

    const normalizedCandidate = {
      ...candidate,
      statement: normalizeStatement(candidate.statement),
      justification: normalizeWhitespace(candidate.justification),
      tags: normalizeTags(candidate.tags),
      sessionId: candidate.scope === "session" ? source.sessionId : undefined,
    };

    const existing = (await this.list()).find(
      (item) =>
        dedupeKey(item) ===
        dedupeKey({
          type: normalizedCandidate.type,
          scope: normalizedCandidate.scope,
          statement: normalizedCandidate.statement,
          sessionId: normalizedCandidate.sessionId,
        })
    );

    if (existing) {
      const updated: MemoryItem = {
        ...existing,
        updatedAt: source.createdAt,
        lastConfirmedFrom: source,
        confirmationCount: existing.confirmationCount + 1,
        tags: normalizeTags([...existing.tags, ...normalizedCandidate.tags]),
      };

      await writeFile(
        memoryPath(this.rootDir, updated.id),
        `${JSON.stringify(updated, null, 2)}\n`,
        "utf8"
      );

      return {
        ...updated,
        action: "confirmed",
      };
    }

    const created: MemoryItem = {
      id: randomUUID(),
      type: normalizedCandidate.type,
      scope: normalizedCandidate.scope,
      statement: normalizedCandidate.statement,
      justification: normalizedCandidate.justification,
      confidence: normalizedCandidate.confidence,
      tags: normalizedCandidate.tags,
      ...(normalizedCandidate.scope === "session" && source.sessionId
        ? { sessionId: source.sessionId }
        : {}),
      createdAt: source.createdAt,
      updatedAt: source.createdAt,
      createdFrom: source,
      lastConfirmedFrom: source,
      confirmationCount: 1,
    };

    await writeFile(
      memoryPath(this.rootDir, created.id),
      `${JSON.stringify(created, null, 2)}\n`,
      "utf8"
    );

    return {
      ...created,
      action: "created",
    };
  }

  async delete(memoryId: string): Promise<boolean> {
    try {
      await rm(memoryPath(this.rootDir, memoryId));
      return true;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return false;
      }

      throw error;
    }
  }
}

export function normalizeMemoryStatement(value: string): string {
  return normalizeStatement(value);
}
