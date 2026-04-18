/**
 * fromEnv.ts — construct a ModelProvider from environment variables.
 *
 * Selection order:
 *   EVAL_PROVIDER=azure     → AzureOpenAIProvider (direct Azure first, OpenRouter OpenAI fallback)
 *   EVAL_PROVIDER=openai    → OpenAIProvider (openai/gpt-5.4 or OPENROUTER_OPENAI_MODEL)
 *   EVAL_PROVIDER=openai-secondary → OpenAISecondaryProvider
 *   EVAL_PROVIDER=anthropic → AnthropicProvider (anthropic/claude-sonnet-4.6 or OPENROUTER_ANTHROPIC_MODEL)
 *   EVAL_PROVIDER=gemini    → GeminiProvider (google/gemini-3.1-pro-preview-20260219 or OPENROUTER_GEMINI_MODEL)
 *   unset / default         → GeminiProvider
 *   no provider config      → MockProvider
 *
 * The EVAL_PROVIDER var lets scripts and CI switch providers without
 * code changes. The provider classes themselves read their own model
 * override vars.
 */

import type { ModelProvider } from "../types/providers";
import { MockProvider } from "./mock";
import { AzureOpenAIProvider, getAzureOpenAIConfig } from "./azure";
import { OpenAIProvider, OpenAISecondaryProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";

export function providerFromEnv(): ModelProvider {
  const hasAzure = Boolean(getAzureOpenAIConfig());
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);

  if (!hasAzure && !hasOpenRouter) {
    return new MockProvider();
  }

  const preference = (process.env.EVAL_PROVIDER ?? (hasAzure ? "azure" : "gemini")).toLowerCase();

  if (preference === "azure") {
    return new AzureOpenAIProvider();
  }

  if (preference === "openai") {
    return new OpenAIProvider();
  }

  if (preference === "openai-secondary") {
    return new OpenAISecondaryProvider();
  }

  if (preference === "anthropic") {
    return new AnthropicProvider();
  }

  return new GeminiProvider();
}
