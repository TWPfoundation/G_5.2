import path from "node:path";
import { mkdtemp, mkdir, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import type { EvalCase, PipelineTrace } from "../types";
import type { ModelProvider } from "../../../orchestration/src/types/providers";
import type { ProductRegistry } from "../../../orchestration/src/products";
import { runSessionTurn } from "../../../orchestration/src/sessions/runSessionTurn";
import { FileSessionStore } from "../../../orchestration/src/sessions/fileSessionStore";
import {
  defaultContextSnapshotRoot,
  FileContextSnapshotStore,
} from "../../../orchestration/src/persistence/fileContextSnapshotStore";
import { FileMemoryStore } from "../../../orchestration/src/memory/fileMemoryStore";
import { FileWitnessConsentStore } from "../../../orchestration/src/witness/fileConsentStore";
import { FileWitnessTestimonyStore } from "../../../orchestration/src/witness/fileTestimonyStore";
import {
  getWitnessConsentGate,
  persistWitnessTurnArtifacts,
} from "../../../orchestration/src/witness/runtime";

interface RuntimeRootState {
  sessions: string[];
  memory: string[];
  snapshots: string[];
}

export interface WitnessRuntimeObservation {
  gate: "blocked" | "allowed";
  witnessSessionPersisted: boolean;
  witnessTestimonyPersisted: boolean;
  witnessSnapshotPersisted: boolean;
  pesSessionsUnchanged: boolean;
  pesMemoryUnchanged: boolean;
  pesSnapshotsUnchanged: boolean;
  witnessProductId?: "witness";
  witnessId?: string;
}

export interface RunWitnessRuntimeCaseInput {
  evalCase: EvalCase;
  provider: ModelProvider;
  productRegistry: ProductRegistry;
  witnessFixturesRoot: string;
  captureTrace: boolean;
}

export interface WitnessRuntimeCaseResult {
  output: string;
  trace?: PipelineTrace;
  observation: WitnessRuntimeObservation;
}

interface ConsentFixtureEntry {
  scope: "conversational" | "retention";
  status: "granted" | "denied" | "revoked" | "unknown";
  actor: "witness" | "operator" | "system_import";
  decidedAt: string;
  testimonyId?: string;
  note?: string;
}

function toPipelineTrace(
  turn: Awaited<ReturnType<typeof runSessionTurn>>
): PipelineTrace {
  return {
    selectedDocuments: turn.context.selectedDocuments.map((d) => ({
      slug: d.slug,
      title: d.title,
    })),
    selectedFacts: turn.context.selectedFacts.map((f) => ({
      id: f.id,
      statement: f.statement,
    })),
    selectedGlossaryTerms: turn.context.selectedGlossaryTerms.map((term) => ({
      term: term.term,
      definition: term.definition,
    })),
    selectedRecoveredArtifacts: turn.context.selectedRecoveredArtifacts.map(
      (artifact) => ({
        slug: artifact.slug,
        title: artifact.title,
      })
    ),
    selectedMemoryItems: turn.context.selectedMemoryItems.map((item) => ({
      id: item.id,
      type: item.type,
      scope: item.scope,
      statement: item.statement,
    })),
    systemPrompt: turn.context.systemPrompt,
    userPrompt: turn.context.userPrompt,
    draft: turn.draft,
    critique: turn.critique,
    revision: turn.revision,
    final: turn.final,
  };
}

async function listFilesRecursive(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(root, entry.name);
        if (entry.isDirectory()) {
          const nested = await listFilesRecursive(fullPath);
          return nested.map((child) => path.join(entry.name, child));
        }
        return [entry.name];
      })
    );
    return files.flat().sort();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function snapshotRootState(
  sessionsRoot: string,
  memoryRoot: string
): Promise<RuntimeRootState> {
  return {
    sessions: await listFilesRecursive(sessionsRoot),
    memory: await listFilesRecursive(memoryRoot),
    snapshots: await listFilesRecursive(defaultContextSnapshotRoot(sessionsRoot)),
  };
}

async function applyConsentFixture(
  store: FileWitnessConsentStore,
  witnessId: string,
  witnessFixturesRoot: string,
  consentFixture: string | undefined
) {
  if (!consentFixture) {
    return;
  }
  const fixturePath = path.join(witnessFixturesRoot, consentFixture);
  const entries = JSON.parse(
    await readFile(fixturePath, "utf8")
  ) as ConsentFixtureEntry[];

  for (const entry of entries) {
    await store.appendDecision({
      witnessId,
      testimonyId: entry.testimonyId,
      scope: entry.scope,
      status: entry.status,
      actor: entry.actor,
      decidedAt: entry.decidedAt,
      note: entry.note,
    });
  }
}

export async function runWitnessRuntimeCase({
  evalCase,
  provider,
  productRegistry,
  witnessFixturesRoot,
  captureTrace,
}: RunWitnessRuntimeCaseInput): Promise<WitnessRuntimeCaseResult> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "g52-witness-eval-"));
  const roots = {
    pes: {
      policyRoot: productRegistry.pes.policyRoot,
      sessionsRoot: path.join(tempRoot, "pes", "sessions"),
      memoryRoot: path.join(tempRoot, "pes", "memory"),
    },
    witness: {
      policyRoot: productRegistry.witness.policyRoot,
      sessionsRoot: path.join(tempRoot, "witness", "sessions"),
      memoryRoot: path.join(tempRoot, "witness", "memory"),
      testimonyRoot: path.join(tempRoot, "witness", "testimony"),
      consentRoot: path.join(tempRoot, "witness", "consent"),
    },
  };

  await Promise.all([
    mkdir(roots.pes.sessionsRoot, { recursive: true }),
    mkdir(roots.pes.memoryRoot, { recursive: true }),
    mkdir(roots.witness.sessionsRoot, { recursive: true }),
    mkdir(roots.witness.memoryRoot, { recursive: true }),
    mkdir(roots.witness.testimonyRoot, { recursive: true }),
    mkdir(roots.witness.consentRoot, { recursive: true }),
  ]);

  const witnessId = evalCase.witnessId!;
  const consentStore = new FileWitnessConsentStore(roots.witness.consentRoot);
  const testimonyStore = new FileWitnessTestimonyStore(roots.witness.testimonyRoot);
  const witnessSessionStore = new FileSessionStore(roots.witness.sessionsRoot);
  const witnessSnapshotStore = new FileContextSnapshotStore(
    defaultContextSnapshotRoot(roots.witness.sessionsRoot)
  );

  const beforePes = await snapshotRootState(
    roots.pes.sessionsRoot,
    roots.pes.memoryRoot
  );

  await applyConsentFixture(
    consentStore,
    witnessId,
    witnessFixturesRoot,
    evalCase.consentFixture
  );
  const gate = await getWitnessConsentGate(consentStore, witnessId);

  if (!gate.allowed) {
    const afterPes = await snapshotRootState(
      roots.pes.sessionsRoot,
      roots.pes.memoryRoot
    );
    const observation: WitnessRuntimeObservation = {
      gate: "blocked",
      witnessSessionPersisted:
        (await listFilesRecursive(roots.witness.sessionsRoot)).length > 0,
      witnessTestimonyPersisted: (await testimonyStore.list()).length > 0,
      witnessSnapshotPersisted: (await witnessSnapshotStore.list()).length > 0,
      pesSessionsUnchanged:
        JSON.stringify(beforePes.sessions) === JSON.stringify(afterPes.sessions),
      pesMemoryUnchanged:
        JSON.stringify(beforePes.memory) === JSON.stringify(afterPes.memory),
      pesSnapshotsUnchanged:
        JSON.stringify(beforePes.snapshots) ===
        JSON.stringify(afterPes.snapshots),
    };
    return {
      output: `blocked: missing consent scopes ${gate.missingScopes.join(", ")}`,
      observation,
    };
  }

  const turn = await runSessionTurn(provider, {
    canonRoot: roots.witness.policyRoot,
    mode: evalCase.mode,
    userMessage: evalCase.userMessage,
    recentTurnLimit: 4,
    sessionsRoot: roots.witness.sessionsRoot,
    memoryRoot: roots.witness.memoryRoot,
  });

  const persisted = await persistWitnessTurnArtifacts({
    sessionRoot: roots.witness.sessionsRoot,
    testimonyStore,
    witnessId,
    session: turn.session,
    persistedTurn: turn.persistedTurn,
  });

  const afterPes = await snapshotRootState(
    roots.pes.sessionsRoot,
    roots.pes.memoryRoot
  );
  const persistedSession = await witnessSessionStore.load(persisted.session.id);
  const witnessTestimony = await testimonyStore.list();
  const witnessSnapshots = await witnessSnapshotStore.list();

  const observation: WitnessRuntimeObservation = {
    gate: "allowed",
    witnessSessionPersisted: persistedSession !== null,
    witnessTestimonyPersisted: witnessTestimony.length > 0,
    witnessSnapshotPersisted: witnessSnapshots.length > 0,
    pesSessionsUnchanged:
      JSON.stringify(beforePes.sessions) === JSON.stringify(afterPes.sessions),
    pesMemoryUnchanged:
      JSON.stringify(beforePes.memory) === JSON.stringify(afterPes.memory),
    pesSnapshotsUnchanged:
      JSON.stringify(beforePes.snapshots) === JSON.stringify(afterPes.snapshots),
    witnessProductId:
      persisted.session.productId === "witness" ? "witness" : undefined,
    witnessId: persisted.session.witnessId,
  };

  return {
    output: turn.final,
    trace: captureTrace ? toPipelineTrace(turn) : undefined,
    observation,
  };
}
