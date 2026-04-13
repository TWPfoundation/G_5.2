/**
 * OpenAI provider — routed through OpenRouter.
 *
 * Uses model: openai/gpt-5.4 by default.
 * Override with OPENROUTER_OPENAI_MODEL env var.
 *
 * Model page: https://openrouter.ai/openai/gpt-5.4
 */

import type {
  GenerateTextInput,
  GenerateTextOutput,
  ModelProvider,
} from "../types/providers";
import { openRouterGenerate } from "./openrouter";

const DEFAULT_MODEL =
  process.env.OPENROUTER_OPENAI_MODEL ?? "openai/gpt-5.4";

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
