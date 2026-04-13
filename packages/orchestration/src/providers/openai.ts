/**
 * OpenAI provider — routed through OpenRouter.
 *
 * Uses model: openai/gpt-4.5 by default.
 * Override with OPENROUTER_OPENAI_MODEL env var.
 *
 * Note on model name: OpenRouter model slugs may diverge from
 * OpenAI's own naming. Verify your model is available at:
 *   https://openrouter.ai/models?q=openai
 */

import type {
  GenerateTextInput,
  GenerateTextOutput,
  ModelProvider,
} from "../types/providers";
import { openRouterGenerate } from "./openrouter";

const DEFAULT_MODEL =
  process.env.OPENROUTER_OPENAI_MODEL ?? "openai/gpt-4.5";

export class OpenAIProvider implements ModelProvider {
  name = "openai";
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
