import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CanonProposalSchema,
  PROPOSAL_SCHEMA_VERSION,
  type CanonProposal,
} from "./proposalSchema";

export class FileProposalStore {
  constructor(private readonly rootDir: string) {}

  private filePath(id: string): string {
    return path.join(this.rootDir, `${id}.json`);
  }

  async list(): Promise<CanonProposal[]> {
    if (!existsSync(this.rootDir)) {
      return [];
    }

    const files = await readdir(this.rootDir);
    const proposals = await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => {
          const raw = await readFile(path.join(this.rootDir, file), "utf8");
          return CanonProposalSchema.parse(JSON.parse(raw));
        })
    );

    return proposals.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async load(id: string): Promise<CanonProposal | null> {
    try {
      const raw = await readFile(this.filePath(id), "utf8");
      return CanonProposalSchema.parse(JSON.parse(raw));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async save(proposal: CanonProposal): Promise<CanonProposal> {
    await mkdir(this.rootDir, { recursive: true });
    const validated = CanonProposalSchema.parse({
      ...proposal,
      schemaVersion: PROPOSAL_SCHEMA_VERSION,
    });
    await writeFile(
      this.filePath(validated.id),
      `${JSON.stringify(validated, null, 2)}\n`,
      "utf8"
    );
    return validated;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await rm(this.filePath(id));
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
