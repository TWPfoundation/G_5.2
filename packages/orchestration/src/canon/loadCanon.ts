import path from "node:path";
import { readFile } from "node:fs/promises";
import { validateCanonBoundary } from "./validateCanon";
import { parseFrontmatter } from "./parseFrontmatter";
import { YAML_ONLY_SLUGS } from "../schemas/canon";
import type { CanonDocument, LoadedCanon } from "../types/canon";

export async function loadCanon(rootDir: string): Promise<LoadedCanon> {
  // Phase 3 — load-time enforcement: validate before trusting disk
  const { manifest, continuity, warnings } =
    await validateCanonBoundary(rootDir);

  for (const warning of warnings) {
    const ctx = warning.context ? ` [${warning.context}]` : "";
    console.warn(`[canon warning]${ctx} ${warning.message}`);
  }

  // Load markdown-backed documents only (YAML-only slugs are already loaded
  // as structured data via validateCanonBoundary → ContinuityFactsFile)
  const markdownDocs = manifest.documents.filter(
    (doc) => !YAML_ONLY_SLUGS.has(doc.slug)
  );

  const documents: CanonDocument[] = await Promise.all(
    markdownDocs.map(async (doc) => {
      const filePath = path.join(rootDir, `${doc.slug}.md`);
      const raw = await readFile(filePath, "utf8");
      // Strip YAML frontmatter if present; canon files don't use it today
      // but this keeps loading forward-compatible if they ever do
      const { body } = parseFrontmatter(raw);

      return {
        slug: doc.slug,
        path: filePath,
        title: doc.title,
        content: body,
        type: doc.type,
        priority: doc.priority,
        retrievalTags: doc.retrieval_tags,
      };
    })
  );

  return {
    rootDir,
    manifest,
    documents,
    continuityFacts: continuity.facts,
  };
}
