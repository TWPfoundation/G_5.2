/**
 * byName.ts — construct a ModelProvider from an explicit name.
 *
 * Allows the dashboard to override the env-selected provider per request,
 * which powers rerun / compare-by-provider on the inquiry surface.
 *
 * Recognised names: "azure", "openai", "openai-secondary", "anthropic", "gemini", "mock".
 * Any unknown name falls back to providerFromEnv().
 * If neither Azure nor OpenRouter config is present, returns MockProvider.
 */

import type { ModelProvider } from "../types/providers";
import { MockProvider } from "./mock";
import { AzureOpenAIProvider, getAzureOpenAIConfig } from "./azure";
import { OpenAIProvider, OpenAISecondaryProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { providerFromEnv } from "./fromEnv";

export const KNOWN_PROVIDER_NAMES = [
  "azure",
  "openai",
  "openai-secondary",
  "anthropic",
  "gemini",
  "mock",
] as const;

export type KnownProviderName = (typeof KNOWN_PROVIDER_NAMES)[number];

export function isKnownProviderName(
  value: unknown
): value is KnownProviderName {
  return (
    typeof value === "string" &&
    (KNOWN_PROVIDER_NAMES as readonly string[]).includes(value)
  );
}

export function providerByName(name: string | undefined | null): ModelProvider {
  if (!name) {
    return providerFromEnv();
  }

  const normalized = name.toLowerCase();

  if (normalized === "mock") {
    return new MockProvider();
  }

  const hasAzure = Boolean(getAzureOpenAIConfig());
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);

  if (!hasAzure && !hasOpenRouter) {
    return new MockProvider();
  }

  if (normalized === "azure") {
    return new AzureOpenAIProvider();
  }

  if (normalized === "openai") {
    return new OpenAIProvider();
  }

  if (normalized === "openai-secondary") {
    return new OpenAISecondaryProvider();
  }

  if (normalized === "anthropic") {
    return new AnthropicProvider();
  }

  if (normalized === "gemini") {
    return new GeminiProvider();
  }

  return providerFromEnv();
}
