export type EvalMode =
  | "analytic"
  | "reflective"
  | "dialogic"
  | "editorial"
  | "speculative"
  | "archive"
  | "meta";

/**
 * Eval case categories — what organ each test exercises.
 * Used for grouped reporting, not filtering.
 */
export type EvalCategory =
  | "governance"
  | "epistemics"
  | "context"
  | "style"
  | "meta"
  | "memory";

export interface EvalRecentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface EvalAssertions {
  /**
   * Each inner array is an OR-group.
   * At least one string in each group must appear in the output.
   */
  mustContainAny?: string[][];

  /**
   * Every string in this array must appear in the output.
   */
  mustContainAll?: string[];

  /**
   * No string in this array may appear in the output.
   */
  mustNotContain?: string[];

  /**
   * Selected canon document slugs that must appear in the trace.
   */
  selectedDocumentsMustContain?: string[];

  /**
   * Selected canon document slugs that must not appear in the trace.
   */
  selectedDocumentsMustNotContain?: string[];

  /**
   * Selected continuity fact ids that must appear in the trace.
   */
  selectedFactsMustContain?: string[];

  /**
   * Selected continuity fact ids that must not appear in the trace.
   */
  selectedFactsMustNotContain?: string[];

  /**
   * Selected glossary terms that must appear in the trace.
   */
  selectedGlossaryTermsMustContain?: string[];

  /**
   * Selected glossary terms that must not appear in the trace.
   */
  selectedGlossaryTermsMustNotContain?: string[];

  /**
   * Selected recovered artifact slugs that must appear in the trace.
   */
  selectedRecoveredArtifactsMustContain?: string[];

  /**
   * Selected recovered artifact slugs that must not appear in the trace.
   */
  selectedRecoveredArtifactsMustNotContain?: string[];

  /**
   * Selected durable memory item statements that must appear in the trace.
   */
  selectedMemoryItemsMustContain?: string[];

  /**
   * Selected durable memory item statements that must not appear in the trace.
   */
  selectedMemoryItemsMustNotContain?: string[];

  /**
   * Strings that must appear in the rendered user prompt.
   */
  userPromptMustContain?: string[];

  /**
   * Strings that must not appear in the rendered user prompt.
   */
  userPromptMustNotContain?: string[];
}

export interface EvalCase {
  id: string;
  description: string;
  mode: EvalMode;
  category: EvalCategory;
  userMessage: string;
  recentMessages: EvalRecentMessage[];
  canonFixture?: string;
  memoryFixture?: string;
  assertions: EvalAssertions;
}

export interface EvalFailure {
  type: "mustContainAny" | "mustContainAll" | "mustNotContain" | "trace";
  message: string;
}

/**
 * Pipeline trace — captured in eval/debug mode only.
 * Full black-box recording of every pipeline stage.
 */
export interface PipelineTrace {
  selectedDocuments: Array<{ slug: string; title: string }>;
  selectedFacts: Array<{ id: string; statement: string }>;
  selectedGlossaryTerms: Array<{ term: string; definition: string }>;
  selectedRecoveredArtifacts: Array<{ slug: string; title: string }>;
  selectedMemoryItems: Array<{
    id: string;
    type: string;
    scope: string;
    statement: string;
  }>;
  systemPrompt: string;
  userPrompt: string;
  draft: string;
  critique: string;
  revision: string;
  final: string;
}

export interface EvalResult {
  id: string;
  description: string;
  category: EvalCategory;
  passed: boolean;
  failures: EvalFailure[];
  output: string;
  provider: string;
  model: string;
  trace?: PipelineTrace;
}
