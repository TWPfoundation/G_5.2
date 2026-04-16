/**
 * Minimal line-level diff for canon-revision diffing.
 *
 * Uses an LCS table; returns a sequence of context / add / remove entries
 * suitable for the editorial UI without pulling in a third-party diff library.
 */

export type DiffOp = "context" | "add" | "remove";

export interface DiffLine {
  op: DiffOp;
  text: string;
  beforeLineNumber: number | null;
  afterLineNumber: number | null;
}

export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
}

export interface ProposalDiff {
  before: string | null;
  after: string | null;
  lines: DiffLine[];
  stats: DiffStats;
}

function splitLines(value: string): string[] {
  if (value === "") {
    return [];
  }

  const lines = value.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines;
}

export function computeLineDiff(
  beforeRaw: string | null,
  afterRaw: string | null
): ProposalDiff {
  const before = beforeRaw ?? "";
  const after = afterRaw ?? "";
  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);

  const m = beforeLines.length;
  const n = afterLines.length;

  // LCS DP table.
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0) as number[]
  );

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (beforeLines[i] === afterLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (beforeLines[i] === afterLines[j]) {
      lines.push({
        op: "context",
        text: beforeLines[i],
        beforeLineNumber: i + 1,
        afterLineNumber: j + 1,
      });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push({
        op: "remove",
        text: beforeLines[i],
        beforeLineNumber: i + 1,
        afterLineNumber: null,
      });
      i++;
    } else {
      lines.push({
        op: "add",
        text: afterLines[j],
        beforeLineNumber: null,
        afterLineNumber: j + 1,
      });
      j++;
    }
  }

  while (i < m) {
    lines.push({
      op: "remove",
      text: beforeLines[i],
      beforeLineNumber: i + 1,
      afterLineNumber: null,
    });
    i++;
  }

  while (j < n) {
    lines.push({
      op: "add",
      text: afterLines[j],
      beforeLineNumber: null,
      afterLineNumber: j + 1,
    });
    j++;
  }

  const stats: DiffStats = { added: 0, removed: 0, unchanged: 0 };
  for (const line of lines) {
    if (line.op === "add") stats.added++;
    else if (line.op === "remove") stats.removed++;
    else stats.unchanged++;
  }

  return { before: beforeRaw, after: afterRaw, lines, stats };
}
