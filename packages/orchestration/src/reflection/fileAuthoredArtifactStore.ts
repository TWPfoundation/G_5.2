import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AuthoredArtifactSchema,
  type AuthoredArtifact,
  type AuthoredArtifactStatus,
  type AuthoredArtifactProposalRef,
  type ReflectionProvider,
} from "../schemas/reflection";
import { SCHEMA_VERSIONS } from "../persistence/schemaVersions";

export class AuthoredArtifactStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthoredArtifactStoreError";
  }
}

const ALLOWED_TRANSITIONS: Record<
  AuthoredArtifactStatus,
  readonly AuthoredArtifactStatus[]
> = {
  draft: ["approved", "archived"],
  approved: ["publishing_ready", "archived"],
  publishing_ready: ["archived"],
  archived: [],
};

function artifactPath(rootDir: string, id: string): string {
  return path.join(rootDir, `${id}.json`);
}

function parse(value: unknown): AuthoredArtifact {
  return AuthoredArtifactSchema.parse(value);
}

export interface CreateArtifactInput {
  topicId: string;
  runId: string;
  title: string;
  body: string;
  linkedSessionIds: string[];
  provider: ReflectionProvider;
  canonVersion: string;
}

export interface PatchArtifactInput {
  title?: string;
  body?: string;
}

/**
 * File-backed store for authored artifacts (M5).
 *
 * Status state machine:
 *   draft → approved → publishing_ready → archived
 *   draft → archived
 *   approved → archived
 *
 * Approving an artifact never mutates canon. The only path from artifact
 * into canon is `attachProposalRef`, which records that the artifact has
 * been routed through the editorial proposal workflow (M4).
 */
export class FileAuthoredArtifactStore {
  constructor(private readonly rootDir: string) {}

  async list(): Promise<AuthoredArtifact[]> {
    if (!existsSync(this.rootDir)) return [];
    const files = await readdir(this.rootDir);
    const items = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          try {
            return parse(JSON.parse(await readFile(path.join(this.rootDir, f), "utf8")));
          } catch {
            return null;
          }
        })
    );
    return items
      .filter((a): a is AuthoredArtifact => a !== null)
      .sort((a, b) =>
        b.metadata.revisionDate.localeCompare(a.metadata.revisionDate)
      );
  }

  async load(id: string): Promise<AuthoredArtifact | null> {
    try {
      return parse(JSON.parse(await readFile(artifactPath(this.rootDir, id), "utf8")));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async create(input: CreateArtifactInput): Promise<AuthoredArtifact> {
    if (!input.title.trim() || !input.body.trim()) {
      throw new AuthoredArtifactStoreError("title and body are required");
    }
    const now = new Date().toISOString();
    const artifact: AuthoredArtifact = {
      schemaVersion: SCHEMA_VERSIONS.authoredArtifact as 1,
      id: randomUUID(),
      topicId: input.topicId,
      runId: input.runId,
      title: input.title.trim(),
      body: input.body,
      status: "draft",
      metadata: {
        sourceTopicId: input.topicId,
        linkedSessionIds: [...input.linkedSessionIds],
        provider: input.provider,
        canonVersion: input.canonVersion,
        createdAt: now,
        revisionDate: now,
      },
    };
    parse(artifact);
    await this.write(artifact);
    return artifact;
  }

  async patch(
    id: string,
    patch: PatchArtifactInput
  ): Promise<AuthoredArtifact> {
    const existing = await this.load(id);
    if (!existing) {
      throw new AuthoredArtifactStoreError(`Artifact not found: ${id}`);
    }
    if (existing.status !== "draft") {
      throw new AuthoredArtifactStoreError(
        `Only draft artifacts can be edited; ${id} is in state "${existing.status}".`
      );
    }
    const now = new Date().toISOString();
    const updated: AuthoredArtifact = {
      ...existing,
      schemaVersion: SCHEMA_VERSIONS.authoredArtifact as 1,
      title: patch.title?.trim() || existing.title,
      body: patch.body !== undefined && patch.body.trim() ? patch.body : existing.body,
      metadata: { ...existing.metadata, revisionDate: now },
    };
    parse(updated);
    await this.write(updated);
    return updated;
  }

  async transition(
    id: string,
    nextStatus: AuthoredArtifactStatus,
    extras: { approvedBy?: string; reason?: string } = {}
  ): Promise<AuthoredArtifact> {
    const existing = await this.load(id);
    if (!existing) {
      throw new AuthoredArtifactStoreError(`Artifact not found: ${id}`);
    }
    const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new AuthoredArtifactStoreError(
        `Illegal artifact transition ${existing.status} → ${nextStatus} for ${id}.`
      );
    }
    const now = new Date().toISOString();
    const meta = { ...existing.metadata, revisionDate: now };
    if (nextStatus === "approved") {
      meta.approvedAt = now;
      if (extras.approvedBy) meta.approvedBy = extras.approvedBy;
    }
    if (nextStatus === "publishing_ready") {
      meta.publishingReadyAt = now;
    }
    if (nextStatus === "archived") {
      meta.archivedAt = now;
      if (extras.reason) meta.archivedReason = extras.reason;
    }
    const updated: AuthoredArtifact = {
      ...existing,
      schemaVersion: SCHEMA_VERSIONS.authoredArtifact as 1,
      status: nextStatus,
      metadata: meta,
    };
    parse(updated);
    await this.write(updated);
    return updated;
  }

  async attachProposalRef(
    id: string,
    ref: AuthoredArtifactProposalRef
  ): Promise<AuthoredArtifact> {
    const existing = await this.load(id);
    if (!existing) {
      throw new AuthoredArtifactStoreError(`Artifact not found: ${id}`);
    }
    if (existing.status === "draft") {
      throw new AuthoredArtifactStoreError(
        `Artifact ${id} must be approved (or beyond) before being proposed to canon.`
      );
    }
    if (existing.proposalRef) {
      throw new AuthoredArtifactStoreError(
        `Artifact ${id} already has a proposal reference (${existing.proposalRef.proposalId}).`
      );
    }
    const updated: AuthoredArtifact = {
      ...existing,
      schemaVersion: SCHEMA_VERSIONS.authoredArtifact as 1,
      proposalRef: ref,
      metadata: {
        ...existing.metadata,
        revisionDate: new Date().toISOString(),
      },
    };
    parse(updated);
    await this.write(updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await rm(artifactPath(this.rootDir, id));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }

  private async write(artifact: AuthoredArtifact): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
    await writeFile(
      artifactPath(this.rootDir, artifact.id),
      `${JSON.stringify(artifact, null, 2)}\n`,
      "utf8"
    );
  }
}
