/**
 * GeminiProvider — routed through OpenRouter.
 *
 * Uses model: google/gemini-3.1-pro-preview-20260219 by default.
 * Override with OPENROUTER_GEMINI_MODEL env var.
 *
 * Model page: https://openrouter.ai/google/gemini-3.1-pro-preview-20260219
 */

import type {
  GenerateTextInput,
  GenerateTextOutput,
  ModelProvider,
} from "../types/providers";
import { openRouterGenerate } from "./openrouter";

const DEFAULT_MODEL =
  process.env.OPENROUTER_GEMINI_MODEL ??
  "google/gemini-3.1-pro-preview-20260219";

export class GeminiProvider implements ModelProvider {
  name = "gemini";
  readonly model: string;

  constructor(model?: string) {
    this.model = model ?? DEFAULT_MODEL;
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    return openRouterGenerate(input.model ?? this.model, input, this.name);
  }
}
