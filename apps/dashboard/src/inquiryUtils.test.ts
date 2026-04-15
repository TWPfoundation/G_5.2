import test from "node:test";
import assert from "node:assert/strict";
import {
  filterSessionSummaries,
  sortSessionSummaries,
  toSessionSummary,
} from "./inquiryUtils";
import type { InquirySession } from "../../../packages/orchestration/src/types/session";

function buildSession(overrides: Partial<InquirySession>): InquirySession {
  return {
    id: "session-1",
    createdAt: "2026-04-15T10:00:00.000Z",
    updatedAt: "2026-04-15T10:10:00.000Z",
    summary: null,
    turns: [],
    ...overrides,
  };
}

test("toSessionSummary prefers stored summary over raw turn text", () => {
  const summary = toSessionSummary(
    buildSession({
      summary: "Reviewed canon boundaries and session carryover.",
      turns: [
        {
          id: "turn-1",
          createdAt: "2026-04-15T10:05:00.000Z",
          mode: "dialogic",
          userMessage: "Tell me about the canon boundary.",
          assistantMessage: "The canon boundary is explicit.",
          memoryDecision: {
            shouldStore: false,
            reason: "No durable memory candidate.",
            candidates: [],
          },
        },
      ],
    })
  );

  assert.equal(summary.turnCount, 1);
  assert.equal(summary.preview, "Reviewed canon boundaries and session carryover.");
  assert.match(summary.searchableText, /canon boundary/);
});

test("sortSessionSummaries orders newest sessions first", () => {
  const sorted = sortSessionSummaries([
    { id: "older", updatedAt: "2026-04-15T09:00:00.000Z" },
    { id: "newer", updatedAt: "2026-04-15T11:00:00.000Z" },
    { id: "middle", updatedAt: "2026-04-15T10:00:00.000Z" },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ["newer", "middle", "older"]
  );
});

test("filterSessionSummaries matches summary and turn content", () => {
  const sessions = [
    toSessionSummary(
      buildSession({
        id: "session-alpha",
        summary: "Focused on canon retrieval.",
      })
    ),
    toSessionSummary(
      buildSession({
        id: "session-beta",
        turns: [
          {
            id: "turn-1",
            createdAt: "2026-04-15T10:05:00.000Z",
            mode: "dialogic",
            userMessage: "Why does the glossary matter?",
            assistantMessage: "It keeps project terms stable.",
            memoryDecision: {
              shouldStore: false,
              reason: "No durable memory candidate.",
              candidates: [],
            },
          },
        ],
      })
    ),
  ];

  assert.deepEqual(
    filterSessionSummaries(sessions, "glossary").map((session) => session.id),
    ["session-beta"]
  );
  assert.deepEqual(
    filterSessionSummaries(sessions, "canon").map((session) => session.id),
    ["session-alpha"]
  );
});
