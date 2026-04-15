import type { InquirySession } from "../../../packages/orchestration/src/types/session";

export interface InquirySessionSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  turnCount: number;
  preview: string;
  searchableText: string;
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }

  return "New session";
}

export function toSessionSummary(
  session: InquirySession
): InquirySessionSummary {
  const lastTurn = session.turns.at(-1);
  const searchableText = [
    session.id,
    session.summary,
    ...session.turns.flatMap((turn) => [
      turn.userMessage,
      turn.assistantMessage,
      turn.memoryDecision.reason,
    ]),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  return {
    id: session.id,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    turnCount: session.turns.length,
    preview: firstNonEmpty(
      session.summary,
      lastTurn?.userMessage,
      lastTurn?.assistantMessage
    ),
    searchableText,
  };
}

export function sortSessionSummaries<T extends { updatedAt: string }>(
  sessions: T[]
): T[] {
  return [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function filterSessionSummaries(
  sessions: InquirySessionSummary[],
  query: string
): InquirySessionSummary[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return sessions;
  }

  return sessions.filter((session) =>
    session.searchableText.includes(normalized)
  );
}
