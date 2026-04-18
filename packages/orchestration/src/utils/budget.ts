/**
 * Prompt budget utilities.
 *
 * Rough token estimation (1 token ≈ 4 chars) and budget-aware
 * document trimming for canon retrieval.
 *
 * These are heuristics, not exact counts. The goal is to avoid
 * context overflow and keep prompts predictable, not to hit
 * exact token limits.
 */

// 1 token ≈ 4 UTF-8 characters in English prose
const CHARS_PER_TOKEN = 4;
const BUDGET_SUMMARY_DEBOUNCE_MS = 250;

type BudgetDiagnosticsMode = "off" | "summary" | "verbose";

interface BudgetDocSummary {
  slug: string;
  estimatedTokens: number;
}

interface BudgetTrimEvent {
  available: number;
  used: number;
  candidateTotal: number;
  kept: BudgetDocSummary[];
  dropped: BudgetDocSummary[];
}

const budgetTrimPatterns = new Map<
  string,
  { count: number; event: BudgetTrimEvent }
>();
let budgetSummaryTimer: ReturnType<typeof setTimeout> | null = null;
let budgetExitHookRegistered = false;

/** Rough token count for a string. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export interface TokenEstimate {
  slug: string;
  title: string;
  estimatedTokens: number;
}

function getBudgetDiagnosticsMode(): BudgetDiagnosticsMode {
  const raw = process.env.G52_BUDGET_DIAGNOSTICS?.trim().toLowerCase();
  if (raw === "summary" || raw === "verbose" || raw === "off") {
    return raw;
  }
  return "off";
}

function formatDocs(items: BudgetDocSummary[]): string {
  return items.map((item) => `${item.slug}(${item.estimatedTokens})`).join(", ");
}

function formatBudgetTrimEvent(event: BudgetTrimEvent): string {
  return (
    `[budget] Token budget exceeded — used ${event.used}/${event.available} tokens; ` +
    `candidate total ${event.candidateTotal}; ` +
    `kept: ${formatDocs(event.kept)}; ` +
    `dropped: ${formatDocs(event.dropped)}`
  );
}

function ensureBudgetExitHook() {
  if (budgetExitHookRegistered) {
    return;
  }
  budgetExitHookRegistered = true;
  process.once("exit", () => {
    flushBudgetDiagnosticsSummary();
  });
}

function queueBudgetSummaryFlush() {
  if (budgetSummaryTimer) {
    return;
  }

  ensureBudgetExitHook();
  budgetSummaryTimer = setTimeout(() => {
    budgetSummaryTimer = null;
    flushBudgetDiagnosticsSummary();
  }, BUDGET_SUMMARY_DEBOUNCE_MS);
  budgetSummaryTimer.unref?.();
}

function recordBudgetTrim(event: BudgetTrimEvent) {
  const key = JSON.stringify(event);
  const existing = budgetTrimPatterns.get(key);
  if (existing) {
    existing.count += 1;
  } else {
    budgetTrimPatterns.set(key, { count: 1, event });
  }
  queueBudgetSummaryFlush();
}

export function flushBudgetDiagnosticsSummary() {
  if (budgetSummaryTimer) {
    clearTimeout(budgetSummaryTimer);
    budgetSummaryTimer = null;
  }

  if (budgetTrimPatterns.size === 0) {
    return;
  }

  const patterns = [...budgetTrimPatterns.values()].sort((a, b) => b.count - a.count);
  const totalEvents = patterns.reduce((sum, pattern) => sum + pattern.count, 0);
  const lines = patterns.map(
    ({ count, event }) => `  - ${count}x ${formatBudgetTrimEvent(event).replace("[budget] Token budget exceeded — ", "")}`
  );

  console.warn(
    `[budget] Trim summary — ${totalEvents} event(s), ${patterns.length} unique pattern(s)\n${lines.join("\n")}`
  );
  budgetTrimPatterns.clear();
}

export function resetBudgetDiagnosticsForTests() {
  if (budgetSummaryTimer) {
    clearTimeout(budgetSummaryTimer);
    budgetSummaryTimer = null;
  }
  budgetTrimPatterns.clear();
}

/** Estimate token cost for a list of documents. Useful for debugging context size. */
export function estimateDocBudget(
  docs: { slug: string; title: string; content: string }[]
): TokenEstimate[] {
  return docs.map((doc) => ({
    slug: doc.slug,
    title: doc.title,
    estimatedTokens: estimateTokens(doc.content),
  }));
}

/**
 * Trim a list of documents to fit within a token budget.
 *
 * Documents are processed in the order given — caller should
 * provide them in priority order (highest priority first).
 *
 * @param docs          Documents to filter, in priority order
 * @param budgetTokens  Total usable token budget for documents
 * @param reservedTokens Tokens already committed to system/user prompt
 */
export function trimToTokenBudget<T extends { content: string; slug: string }>(
  docs: T[],
  budgetTokens: number,
  reservedTokens = 0
): T[] {
  const available = budgetTokens - reservedTokens;
  let used = 0;
  const result: T[] = [];
  const kept: Array<{ slug: string; estimatedTokens: number }> = [];
  const dropped: Array<{ slug: string; estimatedTokens: number }> = [];
  let candidateTotal = 0;

  for (const doc of docs) {
    const cost = estimateTokens(doc.content);
    candidateTotal += cost;
    if (used + cost <= available) {
      result.push(doc);
      used += cost;
      kept.push({
        slug: doc.slug,
        estimatedTokens: cost,
      });
    } else {
      dropped.push({
        slug: doc.slug,
        estimatedTokens: cost,
      });
    }
  }

  if (dropped.length > 0) {
    const event: BudgetTrimEvent = {
      available,
      used,
      candidateTotal,
      kept,
      dropped,
    };

    const mode = getBudgetDiagnosticsMode();
    if (mode === "verbose") {
      console.warn(formatBudgetTrimEvent(event));
    } else if (mode === "summary") {
      recordBudgetTrim(event);
    }
  }

  return result;
}

/** Truncate a single text block to a token budget. */
export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}
