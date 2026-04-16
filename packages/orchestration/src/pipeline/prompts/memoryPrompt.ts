import type { Message } from "../../types/messages";
import type { Mode } from "../../types/modes";

interface BuildMemoryPromptInput {
  mode: Mode;
  userMessage: string;
  finalText: string;
  recentMessages: Message[];
  sessionSummary?: string;
}

function formatRecentMessages(messages: Message[]): string {
  if (messages.length === 0) {
    return "None";
  }

  return messages
    .map(
      (message) =>
        `${message.role.toUpperCase()}: ${message.content.replace(/\s+/g, " ")}`
    )
    .join("\n");
}

export function buildMemoryPrompt(input: BuildMemoryPromptInput): string {
  return [
    "Decide whether this turn contains durable runtime memory.",
    "",
    "Rules:",
    "- Allowed types: user_preference, project_decision, open_thread.",
    "- user_preference is for stable user preferences that should persist across sessions.",
    "- project_decision is for stable project/runtime decisions that should persist across sessions.",
    "- open_thread is for unresolved work or follow-ups that should persist only for this session.",
    "- Reject canon claims, continuity updates, speculative claims, temporary state, sentimental residue, and anything without a concrete justification.",
    "- Prefer zero candidates over weak candidates.",
    "- Confidence must be one of: high, medium, low.",
    "- Return raw JSON only with shape: {\"reason\": string, \"candidates\": [{\"type\": string, \"statement\": string, \"justification\": string, \"confidence\": string, \"tags\": string[]}]}",
    "",
    `Mode: ${input.mode}`,
    "",
    "Session summary:",
    input.sessionSummary ?? "None",
    "",
    "Recent messages:",
    formatRecentMessages(input.recentMessages),
    "",
    "Current user message:",
    input.userMessage,
    "",
    "Final answer:",
    input.finalText,
  ].join("\n");
}
