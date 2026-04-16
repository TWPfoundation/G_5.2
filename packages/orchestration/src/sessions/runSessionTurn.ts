import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Message } from "../types/messages";
import type { MemoryDecision, MemoryStoredItemSnapshot } from "../types/memory";
import type { ModelProvider } from "../types/providers";
import type {
  InquirySession,
  RunSessionTurnInput,
  SessionContextSnapshot,
  SessionTurnArtifacts,
  SessionTurnRecord,
} from "../types/session";
import { FileMemoryStore } from "../memory/fileMemoryStore";
import { runTurn } from "../pipeline/runTurn";
import { truncateToTokens } from "../utils/budget";
import { FileSessionStore } from "./fileSessionStore";

const DEFAULT_RECENT_TURN_LIMIT = 4;
const MAX_SUMMARY_ENTRIES = 6;
const MAX_SUMMARY_TOKENS = 500;

function createEmptySession(sessionId?: string): InquirySession {
  const now = new Date().toISOString();

  return {
    id: sessionId ?? randomUUID(),
    createdAt: now,
    updatedAt: now,
    summary: null,
    turns: [],
  };
}

function toRecentMessages(turns: SessionTurnRecord[]): Message[] {
  return turns.flatMap((turn) => [
    {
      role: "user" as const,
      content: turn.userMessage,
      passType: "user" as const,
      createdAt: turn.createdAt,
    },
    {
      role: "assistant" as const,
      content: turn.assistantMessage,
      passType: "final" as const,
      createdAt: turn.createdAt,
    },
  ]);
}

function summarizeTurns(turns: SessionTurnRecord[]): string | null {
  if (turns.length === 0) {
    return null;
  }

  const summary = turns
    .slice(-MAX_SUMMARY_ENTRIES)
    .map((turn, index) => {
      const user = truncateToTokens(turn.userMessage, 40).replace(/\s+/g, " ");
      const assistant = truncateToTokens(turn.assistantMessage, 60).replace(
        /\s+/g,
        " "
      );

      return `${index + 1}. [${turn.mode}] User: ${user}\nAssistant: ${assistant}`;
    })
    .join("\n");

  return truncateToTokens(summary, MAX_SUMMARY_TOKENS);
}

function buildContextSnapshot(
  turn: SessionTurnArtifacts["context"]
): SessionContextSnapshot {
  return {
    selectedDocuments: turn.selectedDocuments.map((doc) => ({
      slug: doc.slug,
      title: doc.title,
    })),
    selectedFacts: turn.selectedFacts.map((fact) => ({
      id: fact.id,
      statement: fact.statement,
    })),
    selectedGlossaryTerms: turn.selectedGlossaryTerms.map((term) => ({
      term: term.term,
      definition: term.definition,
    })),
    selectedRecoveredArtifacts: turn.selectedRecoveredArtifacts.map(
      (artifact) => ({
        slug: artifact.slug,
        title: artifact.title,
      })
    ),
    selectedMemoryItems: turn.selectedMemoryItems.map((item) => ({
      id: item.id,
      type: item.type,
      scope: item.scope,
      statement: item.statement,
      ...(item.sessionId ? { sessionId: item.sessionId } : {}),
    })),
    hadSessionSummary: Boolean(turn.sessionSummary),
    recentMessageCount: turn.recentMessages.length,
  };
}

function defaultMemoryRoot(sessionsRoot: string): string {
  return path.join(path.dirname(sessionsRoot), "memory-items");
}

function finalizeMemoryDecision(
  decision: MemoryDecision,
  storedItems: MemoryStoredItemSnapshot[]
): MemoryDecision {
  const skippedCandidates = decision.candidates
    .filter((candidate) => candidate.confidence !== "high")
    .map((candidate) => ({
      ...candidate,
      rejectionReason:
        candidate.rejectionReason ??
        "Only high-confidence candidates are stored in V1.",
    }));

  if (storedItems.length > 0) {
    return {
      ...decision,
      shouldStore: true,
      reason: `Stored or confirmed ${storedItems.length} durable memory item${storedItems.length === 1 ? "" : "s"}.`,
      skippedCandidates,
      storedItems,
    };
  }

  if (decision.candidates.length > 0 && skippedCandidates.length > 0) {
    return {
      ...decision,
      shouldStore: false,
      reason: "Memory candidates were proposed but none met the V1 storage threshold.",
      skippedCandidates,
      storedItems: [],
    };
  }

  return {
    ...decision,
    shouldStore: false,
    skippedCandidates,
    storedItems: [],
  };
}

export async function runSessionTurn(
  provider: ModelProvider,
  input: RunSessionTurnInput
): Promise<SessionTurnArtifacts> {
  const recentTurnLimit = input.recentTurnLimit ?? DEFAULT_RECENT_TURN_LIMIT;
  const store = new FileSessionStore(input.sessionsRoot);
  const memoryStore = new FileMemoryStore(
    input.memoryRoot ?? defaultMemoryRoot(input.sessionsRoot)
  );
  const existing =
    (input.sessionId ? await store.load(input.sessionId) : null) ??
    createEmptySession(input.sessionId);

  const recentTurns = existing.turns.slice(-recentTurnLimit);
  const turn = await runTurn(provider, {
    canonRoot: input.canonRoot,
    mode: input.mode,
    userMessage: input.userMessage,
    recentMessages: toRecentMessages(recentTurns),
    sessionSummary: existing.summary ?? undefined,
    sessionId: existing.id,
    memoryRoot: input.memoryRoot ?? defaultMemoryRoot(input.sessionsRoot),
  });

  const turnId = randomUUID();
  const createdAt = new Date().toISOString();
  const memorySource = {
    sessionId: existing.id,
    turnId,
    createdAt,
  };
  const storedItems: MemoryStoredItemSnapshot[] = [];

  for (const candidate of turn.memoryDecision.candidates) {
    if (candidate.confidence !== "high") {
      continue;
    }

    storedItems.push(await memoryStore.upsert(candidate, memorySource));
  }

  const memoryDecision = finalizeMemoryDecision(turn.memoryDecision, storedItems);
  const persistedTurn: SessionTurnRecord = {
    id: turnId,
    createdAt,
    mode: input.mode,
    userMessage: input.userMessage,
    assistantMessage: turn.final,
    memoryDecision,
    contextSnapshot: buildContextSnapshot(turn.context),
  };

  const turns = [...existing.turns, persistedTurn];
  const rolledIntoSummary = turns.slice(
    0,
    Math.max(0, turns.length - recentTurnLimit)
  );
  const session: InquirySession = {
    ...existing,
    updatedAt: persistedTurn.createdAt,
    summary: summarizeTurns(rolledIntoSummary),
    turns,
  };

  await store.save(session);

  return {
    ...turn,
    memoryDecision,
    session,
    persistedTurn,
  };
}
