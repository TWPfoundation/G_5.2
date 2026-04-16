import type { ModelProvider } from "../types/providers";
import type { Message } from "../types/messages";
import type { Mode } from "../types/modes";
import {
  MemoryCandidateSchema,
  MemoryModelResponseSchema,
  type MemoryCandidate,
  type MemoryDecision,
} from "../schemas/memory";
import { normalizeMemoryStatement } from "../memory/fileMemoryStore";
import { buildMemoryPrompt } from "./prompts/memoryPrompt";

interface DecideMemoryInput {
  provider: ModelProvider;
  mode: Mode;
  userMessage: string;
  finalText: string;
  recentMessages: Message[];
  sessionSummary?: string;
}

function createEmptyDecision(reason: string): MemoryDecision {
  return {
    shouldStore: false,
    reason,
    candidates: [],
    skippedCandidates: [],
    storedItems: [],
  };
}

function extractJsonPayload(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }

  throw new Error("No JSON object found in memory pass output.");
}

function typeToScope(type: MemoryCandidate["type"]): MemoryCandidate["scope"] {
  if (type === "open_thread") {
    return "session";
  }

  return "global";
}

function finalizeCandidate(
  candidate: Omit<MemoryCandidate, "scope">,
  rejectionReason?: string
): MemoryCandidate {
  return MemoryCandidateSchema.parse({
    ...candidate,
    scope: typeToScope(candidate.type),
    statement: normalizeMemoryStatement(candidate.statement),
    justification: candidate.justification.trim(),
    tags: candidate.tags.map((tag) => tag.trim()).filter(Boolean),
    ...(rejectionReason ? { rejectionReason } : {}),
  });
}

function rejectionForCandidate(candidate: MemoryCandidate): string | null {
  const text = candidate.statement.toLowerCase();
  const justification = candidate.justification.toLowerCase();

  if (candidate.confidence !== "high") {
    return "Only high-confidence candidates are stored in V1.";
  }

  if (candidate.justification.trim().length < 16) {
    return "Candidate justification is too weak for durable memory.";
  }

  if (
    /\b(speculative|speculation|maybe|might|could|uncertain|possible)\b/.test(
      text
    )
  ) {
    return "Speculative claims do not enter durable memory.";
  }

  if (
    /\b(canon|continuity|promote|promotion|becomes canon|change canon)\b/.test(
      `${text} ${justification}`
    )
  ) {
    return "Canon or continuity changes are not stored as runtime memory.";
  }

  if (
    /\b(currently|right now|today|this morning|sandwich|hungry|tired|mood|temporary|for lunch)\b/.test(
      text
    )
  ) {
    return "Temporary state does not enter durable memory.";
  }

  return null;
}

function buildDeterministicMockDecision(userMessage: string): MemoryDecision {
  const candidates: MemoryCandidate[] = [];
  const preference =
    userMessage.match(/\bI prefer\s+(.+?)(?:[.!?]|$)/i) ??
    userMessage.match(/\bnever use\s+(.+?)(?:[.!?]|$)/i) ??
    userMessage.match(/\bplease use\s+(.+?)(?:[.!?]|$)/i);
  if (preference) {
    const statement = /prefer/i.test(preference[0])
      ? `Prefer ${preference[1].trim()}.`
      : `Use ${preference[1].trim()}.`;
    candidates.push(
      finalizeCandidate({
        type: "user_preference",
        statement,
        justification:
          "The user explicitly requested a durable preference for future interactions.",
        confidence: "high",
        tags: ["preference"],
      })
    );
  }

  const decision =
    userMessage.match(/\bwe decided\s+(.+?)(?:[.!?]|$)/i) ??
    userMessage.match(/\bour decision is\s+(.+?)(?:[.!?]|$)/i) ??
    userMessage.match(/\bdefault to\s+(.+?)(?:[.!?]|$)/i);
  if (decision) {
    const statement = /default to/i.test(decision[0])
      ? `Default to ${decision[1].trim()}.`
      : decision[1].trim().replace(/^[a-z]/, (match) => match.toUpperCase());
    candidates.push(
      finalizeCandidate({
        type: "project_decision",
        statement,
        justification:
          "The turn contains an explicit project-level decision intended to persist.",
        confidence: "high",
        tags: ["decision"],
      })
    );
  }

  const openThread =
    userMessage.match(/\bwe still need to\s+(.+?)(?:[.!?]|$)/i) ??
    userMessage.match(/\bopen thread[:\-]?\s+(.+?)(?:[.!?]|$)/i) ??
    userMessage.match(/\brevisit\s+(.+?)(?:[.!?]|$)/i);
  if (openThread) {
    candidates.push(
      finalizeCandidate({
        type: "open_thread",
        statement: `Need to ${openThread[1].trim()}.`,
        justification:
          "The user marked an unresolved thread that should persist for this session.",
        confidence: "high",
        tags: ["open-thread"],
      })
    );
  }

  const skippedCandidates = candidates
    .map((candidate) => {
      const rejectionReason = rejectionForCandidate(candidate);
      return rejectionReason
        ? finalizeCandidate(candidate, rejectionReason)
        : null;
    })
    .filter((candidate): candidate is MemoryCandidate => Boolean(candidate));

  return {
    shouldStore: candidates.some((candidate) => !rejectionForCandidate(candidate)),
    reason: candidates.length
      ? "Structured memory candidates extracted."
      : "No obvious durable memory candidate.",
    candidates,
    skippedCandidates,
    storedItems: [],
  };
}

export async function decideMemory(
  input: DecideMemoryInput
): Promise<MemoryDecision> {
  if (input.provider.name === "mock") {
    return buildDeterministicMockDecision(input.userMessage);
  }

  try {
    const result = await input.provider.generateText({
      system: "You are the durable-memory pass for G_5.2. Return JSON only.",
      user: buildMemoryPrompt({
        mode: input.mode,
        userMessage: input.userMessage,
        finalText: input.finalText,
        recentMessages: input.recentMessages,
        sessionSummary: input.sessionSummary,
      }),
      temperature: 0,
    });

    const payload = extractJsonPayload(result.text);
    const parsed = MemoryModelResponseSchema.parse(JSON.parse(payload));
    const candidates = parsed.candidates.map((candidate) =>
      finalizeCandidate(candidate)
    );
    const skippedCandidates = candidates
      .map((candidate) => {
        const rejectionReason = rejectionForCandidate(candidate);
        return rejectionReason
          ? finalizeCandidate(candidate, rejectionReason)
          : null;
      })
      .filter((candidate): candidate is MemoryCandidate => Boolean(candidate));

    return {
      shouldStore: candidates.some(
        (candidate) => rejectionForCandidate(candidate) === null
      ),
      reason:
        parsed.reason ||
        (candidates.length > 0
          ? "Structured memory candidates extracted."
          : "No obvious durable memory candidate."),
      candidates,
      skippedCandidates,
      storedItems: [],
    };
  } catch (error) {
    return createEmptyDecision(
      error instanceof Error
        ? `Memory pass returned no usable candidates: ${error.message}`
        : "Memory pass returned no usable candidates."
    );
  }
}
