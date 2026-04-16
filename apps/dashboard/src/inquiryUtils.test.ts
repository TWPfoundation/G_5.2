import test from "node:test";
import assert from "node:assert/strict";
import {
  filterSessionSummaries,
  sortSessionSummaries,
  toSessionSummary,
} from "./inquiryUtils";
import type { InquirySession } from "../../../packages/orchestration/src/types/session";
import type { MemoryDecision } from "../../../packages/orchestration/src/types/memory";

function buildMemoryDecision(
  overrides: Partial<MemoryDecision> = {}
): MemoryDecision {
  return {
    shouldStore: false,
    reason: "No durable memory candidate.",
    candidates: [],
    skippedCandidates: [],
    storedItems: [],
    ...overrides,
  };
}

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
      summary: {
        schemaVersion: 1,
        text: "Reviewed canon boundaries and session carryover.",
        generatedAt: "2026-04-15T10:05:00.000Z",
      },
      turns: [
        {
          id: "turn-1",
          createdAt: "2026-04-15T10:05:00.000Z",
          mode: "dialogic",
          userMessage: "Tell me about the canon boundary.",
          assistantMessage: "The canon boundary is explicit.",
          memoryDecision: buildMemoryDecision(),
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
        summary: {
          schemaVersion: 1,
          text: "Focused on canon retrieval.",
          generatedAt: "2026-04-15T10:00:00.000Z",
        },
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
            memoryDecision: buildMemoryDecision({
              storedItems: [
                {
                  action: "created",
                  id: "memory-1",
                  type: "project_decision",
                  scope: "global",
                  statement: "Keep project terms stable.",
                  justification: "The assistant captured a durable project decision.",
                  confidence: "high",
                  tags: ["glossary"],
                  createdAt: "2026-04-15T10:05:00.000Z",
                  updatedAt: "2026-04-15T10:05:00.000Z",
                  createdFrom: {
                    sessionId: "session-beta",
                    turnId: "turn-1",
                    createdAt: "2026-04-15T10:05:00.000Z",
                  },
                  lastConfirmedFrom: {
                    sessionId: "session-beta",
                    turnId: "turn-1",
                    createdAt: "2026-04-15T10:05:00.000Z",
                  },
                  confirmationCount: 1,
                },
              ],
            }),
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
    filterSessionSummaries(sessions, "stable").map((session) => session.id),
    ["session-beta"]
  );
  assert.deepEqual(
    filterSessionSummaries(sessions, "canon").map((session) => session.id),
    ["session-alpha"]
  );
});
