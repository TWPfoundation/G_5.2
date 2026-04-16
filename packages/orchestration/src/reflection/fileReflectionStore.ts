import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ReflectionRunSchema,
  ReflectionTopicSchema,
  type ReflectionRun,
  type ReflectionTopic,
  type ReflectionTopicState,
} from "../schemas/reflection";
import { SCHEMA_VERSIONS } from "../persistence/schemaVersions";

export class ReflectionStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReflectionStoreError";
  }
}

const ALLOWED_TOPIC_TRANSITIONS: Record<
  ReflectionTopicState,
  readonly ReflectionTopicState[]
> = {
  queued: ["drafted", "archived"],
  drafted: ["drafted", "archived"],
  archived: [],
};

function topicPath(rootDir: string, id: string): string {
  return path.join(rootDir, "topics", `${id}.json`);
}

function runPath(rootDir: string, id: string): string {
  return path.join(rootDir, "runs", `${id}.json`);
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson<T>(
  filePath: string,
  parse: (value: unknown) => T
): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return parse(JSON.parse(raw) as unknown);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export interface CreateTopicInput {
  title: string;
  prompt: string;
  notes?: string;
  linkedSessionIds?: string[];
  tags?: string[];
}

export interface PatchTopicInput {
  title?: string;
  prompt?: string;
  notes?: string | null;
  linkedSessionIds?: string[];
  tags?: string[];
}

/**
 * File-backed store for reflection topics and reflection runs.
 *
 * Layout (rootDir):
 *   topics/<id>.json
 *   runs/<id>.json
 *
 * The store enforces topic-state transitions and exposes runs only by id;
 * reverse lookup (topic -> runs) is handled by the caller by scanning
 * `listRuns()` and filtering on `topicId`.
 */
export class FileReflectionStore {
  constructor(private readonly rootDir: string) {}

  // ── Topics ─────────────────────────────────────────────

  async listTopics(): Promise<ReflectionTopic[]> {
    const dir = path.join(this.rootDir, "topics");
    if (!existsSync(dir)) return [];
    const files = await readdir(dir);
    const topics = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map((f) =>
          readJson(path.join(dir, f), (v) => ReflectionTopicSchema.parse(v))
        )
    );
    return topics
      .filter((t): t is ReflectionTopic => t !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async loadTopic(id: string): Promise<ReflectionTopic | null> {
    return readJson(topicPath(this.rootDir, id), (v) =>
      ReflectionTopicSchema.parse(v)
    );
  }

  async createTopic(input: CreateTopicInput): Promise<ReflectionTopic> {
    if (!input.title.trim() || !input.prompt.trim()) {
      throw new ReflectionStoreError("title and prompt are required");
    }
    const now = new Date().toISOString();
    const topic: ReflectionTopic = {
      schemaVersion: SCHEMA_VERSIONS.reflectionTopic as 1,
      id: randomUUID(),
      title: input.title.trim(),
      prompt: input.prompt.trim(),
      notes: input.notes?.trim() || undefined,
      state: "queued",
      linkedSessionIds: dedupeStrings(input.linkedSessionIds ?? []),
      tags: dedupeStrings(input.tags ?? []),
      createdAt: now,
      updatedAt: now,
    };
    ReflectionTopicSchema.parse(topic);
    await writeJson(topicPath(this.rootDir, topic.id), topic);
    return topic;
  }

  async patchTopic(
    id: string,
    patch: PatchTopicInput
  ): Promise<ReflectionTopic> {
    const existing = await this.loadTopic(id);
    if (!existing) {
      throw new ReflectionStoreError(`Reflection topic not found: ${id}`);
    }
    if (existing.state === "archived") {
      throw new ReflectionStoreError(
        `Cannot edit archived topic ${id}; restore it by creating a new one.`
      );
    }
    const updated: ReflectionTopic = {
      ...existing,
      schemaVersion: SCHEMA_VERSIONS.reflectionTopic as 1,
      title: patch.title?.trim() || existing.title,
      prompt: patch.prompt?.trim() || existing.prompt,
      notes:
        patch.notes === null
          ? undefined
          : patch.notes !== undefined
            ? patch.notes.trim() || undefined
            : existing.notes,
      linkedSessionIds:
        patch.linkedSessionIds !== undefined
          ? dedupeStrings(patch.linkedSessionIds)
          : existing.linkedSessionIds,
      tags:
        patch.tags !== undefined ? dedupeStrings(patch.tags) : existing.tags,
      updatedAt: new Date().toISOString(),
    };
    ReflectionTopicSchema.parse(updated);
    await writeJson(topicPath(this.rootDir, id), updated);
    return updated;
  }

  async transitionTopic(
    id: string,
    nextState: ReflectionTopicState,
    extras: { lastRunId?: string; archivedReason?: string } = {}
  ): Promise<ReflectionTopic> {
    const existing = await this.loadTopic(id);
    if (!existing) {
      throw new ReflectionStoreError(`Reflection topic not found: ${id}`);
    }
    const allowed = ALLOWED_TOPIC_TRANSITIONS[existing.state] ?? [];
    if (!allowed.includes(nextState)) {
      throw new ReflectionStoreError(
        `Illegal topic transition ${existing.state} → ${nextState} for ${id}.`
      );
    }
    const now = new Date().toISOString();
    const updated: ReflectionTopic = {
      ...existing,
      schemaVersion: SCHEMA_VERSIONS.reflectionTopic as 1,
      state: nextState,
      updatedAt: now,
      ...(extras.lastRunId
        ? { lastRunId: extras.lastRunId, lastRunAt: now }
        : {}),
      ...(nextState === "archived"
        ? {
            archivedAt: now,
            ...(extras.archivedReason
              ? { archivedReason: extras.archivedReason }
              : {}),
          }
        : {}),
    };
    ReflectionTopicSchema.parse(updated);
    await writeJson(topicPath(this.rootDir, id), updated);
    return updated;
  }

  async deleteTopic(id: string): Promise<boolean> {
    try {
      await rm(topicPath(this.rootDir, id));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }

  // ── Runs ───────────────────────────────────────────────

  async listRuns(): Promise<ReflectionRun[]> {
    const dir = path.join(this.rootDir, "runs");
    if (!existsSync(dir)) return [];
    const files = await readdir(dir);
    const runs = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map((f) =>
          readJson(path.join(dir, f), (v) => ReflectionRunSchema.parse(v))
        )
    );
    return runs
      .filter((r): r is ReflectionRun => r !== null)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }

  async loadRun(id: string): Promise<ReflectionRun | null> {
    return readJson(runPath(this.rootDir, id), (v) =>
      ReflectionRunSchema.parse(v)
    );
  }

  async saveRun(
    run: Omit<ReflectionRun, "schemaVersion" | "id"> & { id?: string }
  ): Promise<ReflectionRun> {
    const id = run.id ?? randomUUID();
    const persisted: ReflectionRun = ReflectionRunSchema.parse({
      ...run,
      schemaVersion: SCHEMA_VERSIONS.reflectionRun as 1,
      id,
    });
    await writeJson(runPath(this.rootDir, id), persisted);
    return persisted;
  }
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}
