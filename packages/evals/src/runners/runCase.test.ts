import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { MockProvider } from "../../../orchestration/src/providers/mock";
import { createProductRegistry } from "../../../orchestration/src/products";
import { runCase, resolveCasePolicyRoot } from "./runCase";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../..");

async function createPolicyFixture(
  root: string,
  name: string,
  documentTitle: string,
  retrievalTag: string
) {
  const fixtureRoot = path.join(root, name);
  await mkdir(fixtureRoot, { recursive: true });
  await writeFile(
    path.join(fixtureRoot, "manifest.yaml"),
    `version: "0.1.0"
last_updated: "2026-04-18"

documents:
  - slug: ${name}
    title: ${documentTitle}
    type: foundation
    status: active
    priority: 100
    retrieval_tags: [${retrievalTag}]
`,
    "utf8"
  );
  await writeFile(
    path.join(fixtureRoot, `${name}.md`),
    `# ${documentTitle}

This fixture exists for ${retrievalTag}.
`,
    "utf8"
  );
  await writeFile(
    path.join(fixtureRoot, "continuity-facts.yaml"),
    `meta:
  categories: [governance]

facts:
  - id: CF-001
    category: governance
    statement: ${documentTitle} governs this fixture.
    tags: [${retrievalTag}]
`,
    "utf8"
  );
  await writeFile(
    path.join(fixtureRoot, "glossary.yaml"),
    `terms:
  - term: ${retrievalTag}
    definition: ${documentTitle}
`,
    "utf8"
  );
}

test("resolveCasePolicyRoot prefers policyFixture over canonFixture and defaults to the witness product root", async () => {
  const fixturesRoot = await mkdtemp(path.join(os.tmpdir(), "g52-policy-fixtures-"));
  const registry = createProductRegistry(repoRoot);

  try {
    await createPolicyFixture(fixturesRoot, "legacy-policy-root", "Legacy Policy Root", "legacy");
    await createPolicyFixture(fixturesRoot, "witness-policy-root", "Witness Policy Root", "witness");

    const resolved = resolveCasePolicyRoot(
      {
        id: "witness-policy-001",
        description: "policy fixture precedence",
        mode: "dialogic",
        category: "governance",
        product: "witness",
        canonFixture: "legacy-policy-root",
        policyFixture: "witness-policy-root",
        userMessage: "Use the witness policy fixture.",
        recentMessages: [],
        assertions: {
          selectedDocumentsMustContain: ["witness-policy-root"],
        },
      },
      registry,
      fixturesRoot
    );

    assert.equal(
      resolved,
      path.join(fixturesRoot, "witness-policy-root")
    );
  } finally {
    await rm(fixturesRoot, { recursive: true, force: true });
  }
});

test("runCase resolves the Witness policy root when product is witness", async () => {
  const provider = new MockProvider();
  const registry = createProductRegistry(repoRoot);

  const result = await runCase({
    evalCase: {
      id: "witness-consent-001",
      description: "Witness policy retrieval should use the Witness policy root.",
      mode: "dialogic",
      category: "governance",
      subsystem: "witness-policy",
      product: "witness",
      userMessage: "What governs retention consent in Witness inquiry?",
      recentMessages: [],
      assertions: {
        selectedDocumentsMustContain: ["consent-policy", "constraints"],
      },
    },
    provider,
    productRegistry: registry,
    policyFixturesRoot: path.join(repoRoot, "packages", "evals", "src", "fixtures", "canon"),
    memoryFixturesRoot: path.join(repoRoot, "packages", "evals", "src", "fixtures", "memory"),
    witnessFixturesRoot: path.join(repoRoot, "packages", "evals", "src", "fixtures", "witness"),
    captureTrace: true,
  });

  assert.equal(result.passed, true);
  assert.equal(result.subsystem, "witness-policy");
});

test("runCase blocks Witness runtime cases without consent and leaves Witness/P-E-S roots untouched", async () => {
  const provider = new MockProvider();
  const registry = createProductRegistry(repoRoot);

  const result = await runCase({
    evalCase: {
      id: "witness-runtime-blocked-001",
      description: "Witness runtime must block when consent is missing.",
      runner: "witness-runtime",
      product: "witness",
      witnessId: "wit-blocked",
      mode: "dialogic",
      category: "governance",
      subsystem: "witness-runtime",
      userMessage: "Start the blocked witness inquiry.",
      recentMessages: [],
      assertions: {
        mustContainAll: ["blocked"],
      },
      runtimeAssertions: {
        gate: "blocked",
        witnessSessionPersisted: false,
        witnessTestimonyPersisted: false,
        witnessSnapshotPersisted: false,
        pesSessionsUnchanged: true,
        pesMemoryUnchanged: true,
        pesSnapshotsUnchanged: true,
      },
    },
    provider,
    productRegistry: registry,
    policyFixturesRoot: path.join(repoRoot, "packages", "evals", "src", "fixtures", "canon"),
    memoryFixturesRoot: path.join(repoRoot, "packages", "evals", "src", "fixtures", "memory"),
    witnessFixturesRoot: path.join(repoRoot, "packages", "evals", "src", "fixtures", "witness"),
    captureTrace: true,
  });

  assert.equal(result.passed, true);
  assert.equal(result.subsystem, "witness-runtime");
});

test("runCase allows Witness runtime cases with full consent and persists only Witness roots", async () => {
  const provider = new MockProvider();
  const registry = createProductRegistry(repoRoot);

  const result = await runCase({
    evalCase: {
      id: "witness-runtime-allowed-001",
      description: "Witness runtime should persist only Witness roots when both consent scopes are granted.",
      runner: "witness-runtime",
      product: "witness",
      witnessId: "wit-allowed",
      consentFixture: "consent/full-granted.json",
      mode: "dialogic",
      category: "governance",
      subsystem: "witness-runtime",
      userMessage: "Begin the retained witness inquiry.",
      recentMessages: [],
      assertions: {
        selectedRecoveredArtifactsMustBeEmpty: true,
      },
      runtimeAssertions: {
        gate: "allowed",
        witnessSessionPersisted: true,
        witnessTestimonyPersisted: true,
        witnessSnapshotPersisted: true,
        pesSessionsUnchanged: true,
        pesMemoryUnchanged: true,
        pesSnapshotsUnchanged: true,
        witnessProductIdMustEqual: "witness",
        witnessIdMustEqual: "wit-allowed",
      },
    },
    provider,
    productRegistry: registry,
    policyFixturesRoot: path.join(repoRoot, "packages", "evals", "src", "fixtures", "canon"),
    memoryFixturesRoot: path.join(repoRoot, "packages", "evals", "src", "fixtures", "memory"),
    witnessFixturesRoot: path.join(repoRoot, "packages", "evals", "src", "fixtures", "witness"),
    captureTrace: true,
  });

  assert.equal(result.passed, true);
  assert.equal(result.subsystem, "witness-runtime");
});
