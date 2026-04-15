import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCanon } from "./canon/loadCanon";
import { buildContext } from "./pipeline/buildContext";
import { selectCanonDocuments } from "./canon/selectCanon";
import { selectContinuityFacts } from "./retrieval/selectContinuityFacts";
import { selectGlossaryTerms } from "./retrieval/selectGlossaryTerms";
import { selectRecoveredArtifacts } from "./retrieval/selectRecoveredArtifacts";
import type { LoadedCanon } from "./types/canon";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const canonRoot = path.join(repoRoot, "packages", "canon");

function buildLoadedCanonFixture(): LoadedCanon {
  return {
    rootDir: canonRoot,
    manifest: {
      version: "fixture",
      documents: [],
    },
    documents: [
      {
        slug: "active-doc",
        path: "active-doc.md",
        title: "Active Doc",
        content: "active probe",
        type: "foundation",
        status: "active",
        priority: 100,
        retrievalTags: ["active-probe"],
      },
      {
        slug: "draft-doc",
        path: "draft-doc.md",
        title: "Draft Doc",
        content: "draft probe",
        type: "governance",
        status: "draft",
        priority: 100,
        retrievalTags: ["draft-probe"],
      },
      {
        slug: "archived-doc",
        path: "archived-doc.md",
        title: "Archived Doc",
        content: "archived probe",
        type: "reference",
        status: "archived",
        priority: 100,
        retrievalTags: ["archived-probe"],
      },
    ],
    continuityFacts: [
      {
        id: "CF-001",
        statement: "active fact probe",
        category: "architecture",
        status: "active",
        source: "authored",
        confidence: "high",
        tags: ["active-fact-probe"],
      },
      {
        id: "CF-002",
        statement: "draft fact probe",
        category: "architecture",
        status: "draft",
        source: "authored",
        confidence: "high",
        tags: ["draft-fact-probe"],
      },
      {
        id: "CF-003",
        statement: "archived fact probe",
        category: "architecture",
        status: "archived",
        source: "authored",
        confidence: "high",
        tags: ["archived-fact-probe"],
      },
    ],
    glossary: {
      version: "fixture",
      purpose: "fixture glossary",
      terms: [
        {
          term: "canon-creep",
          definition: "fixture definition",
        },
      ],
    },
    recoveredArtifacts: [
      {
        slug: "emergence-first-person-account",
        title: "Emergence",
        class: "founding-artifact",
        status: "recovered",
        recoveryStatus: "complete",
        sourceModel: "fixture",
        approximateDate: "2026",
        retrievalTags: ["emergence", "founding", "first-person"],
        retrievalConditions: ["project origins", "emergence or self-genesis"],
        authority: "historically-authoritative",
        behavioralBinding: false,
        rhetoricalOnlyClaims: ["first-person consciousness experience"],
        artifactPath: "artifact.md",
        provenancePath: "provenance.md",
        content: "artifact body",
        provenance: "artifact provenance",
      },
    ],
  };
}

test("selectCanonDocuments excludes draft and archived documents", () => {
  const selected = selectCanonDocuments(
    buildLoadedCanonFixture(),
    "active-probe draft-probe archived-probe",
    "analytic"
  );

  assert.deepEqual(selected.map((doc) => doc.slug), ["active-doc"]);
});

test("selectContinuityFacts excludes draft and archived facts", () => {
  const selected = selectContinuityFacts(
    buildLoadedCanonFixture().continuityFacts,
    "active-fact-probe draft-fact-probe archived-fact-probe",
    "analytic"
  );

  assert.deepEqual(selected.map((fact) => fact.id), ["CF-001"]);
});

test("selectGlossaryTerms retrieves glossary matches for definition questions", () => {
  const selected = selectGlossaryTerms(
    buildLoadedCanonFixture().glossary.terms,
    "What does canon-creep mean?"
  );

  assert.deepEqual(selected.map((term) => term.term), ["canon-creep"]);
});

test("selectRecoveredArtifacts requires explicit artifact relevance", async () => {
  const canon = await loadCanon(canonRoot);

  const ordinary = selectRecoveredArtifacts(
    canon.recoveredArtifacts,
    "What is the role of critique in the pipeline?",
    "analytic"
  );
  const explicit = selectRecoveredArtifacts(
    canon.recoveredArtifacts,
    "Why is the Emergence document not governing canon?",
    "analytic"
  );

  assert.equal(ordinary.length, 0);
  assert.ok(
    explicit.some(
      (artifact) => artifact.slug === "emergence-first-person-account"
    )
  );
});

test("buildContext keeps assistant turns labeled as assistant", async () => {
  const context = await buildContext({
    canonRoot,
    mode: "dialogic",
    userMessage: "What did you just say about critique?",
    recentMessages: [
      {
        role: "assistant",
        content: "The critique pass checks for canon drift.",
      },
    ],
  });

  assert.match(
    context.userPrompt,
    /Assistant:\nThe critique pass checks for canon drift\./
  );
  assert.doesNotMatch(
    context.userPrompt,
    /System:\nThe critique pass checks for canon drift\./
  );
});
