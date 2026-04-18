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

/** Rough token count for a string. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export interface TokenEstimate {
  slug: string;
  title: string;
  estimatedTokens: number;
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

  if (dropped.length > 0 && process.env.NODE_ENV !== "test") {
    const formatDocs = (items: Array<{ slug: string; estimatedTokens: number }>) =>
      items.map((item) => `${item.slug}(${item.estimatedTokens})`).join(", ");

    console.warn(
      `[budget] Token budget exceeded — used ${used}/${available} tokens; ` +
        `candidate total ${candidateTotal}; ` +
        `kept: ${formatDocs(kept)}; ` +
        `dropped: ${formatDocs(dropped)}`
    );
  }

  return result;
}

/** Truncate a single text block to a token budget. */
export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}
