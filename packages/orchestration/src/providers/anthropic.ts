/**
 * Anthropic provider — routed through OpenRouter.
 *
 * Uses model: anthropic/claude-sonnet-4.6 by default.
 * Override with OPENROUTER_ANTHROPIC_MODEL env var.
 *
 * Note on model name: verify availability at:
 *   https://openrouter.ai/models?q=anthropic
 */

import type {
  GenerateTextInput,
  GenerateTextOutput,
  ModelProvider,
} from "../types/providers";
import { openRouterGenerate } from "./openrouter";

const DEFAULT_MODEL =
  process.env.OPENROUTER_ANTHROPIC_MODEL ?? "anthropic/claude-sonnet-4.6";

export class AnthropicProvider implements ModelProvider {
  name = "anthropic";
  readonly model: string;

  constructor(model?: string) {
    this.model = model ?? DEFAULT_MODEL;
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    return openRouterGenerate(
      input.model ?? this.model,
      input,
      this.name
    );
  }
}
