/**
 * OpenAI provider — routed through OpenRouter.
 *
 * Uses model: openai/gpt-5.4 by default.
 * Override with OPENROUTER_OPENAI_MODEL or OPENROUTER_DEFAULT_MODEL.
 * OPENROUTER_SECONDARY_MODEL provides a lighter OpenAI route for
 * compare/rerun or default-provider use when desired.
 *
 * Azure is a provider choice on OpenRouter, not part of the model slug.
 * Use standard model IDs such as openai/gpt-5.4 and control provider
 * routing with OPENROUTER_IGNORE_PROVIDERS or request-level provider rules.
 *
 * Model page: https://openrouter.ai/openai/gpt-5.4
 */

import type {
  GenerateTextInput,
  GenerateTextOutput,
  ModelProvider,
} from "../types/providers";
import {
  openRouterGenerate,
  type OpenRouterProviderRouting,
} from "./openrouter";

export function getDefaultOpenAIModel(): string {
  return (
    process.env.OPENROUTER_OPENAI_MODEL ??
    process.env.OPENROUTER_DEFAULT_MODEL ??
    "openai/gpt-5.4"
  );
}

export function getSecondaryOpenAIModel(): string {
  return process.env.OPENROUTER_SECONDARY_MODEL ?? "openai/gpt-5.4-mini";
}

export function getOpenAIMaxCompletionTokens(): number | undefined {
  const raw =
    process.env.OPENROUTER_OPENAI_MAX_COMPLETION_TOKENS ??
    process.env.OPENROUTER_MAX_COMPLETION_TOKENS;

  if (!raw) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseProviderList(
  raw: string | undefined,
  noneSentinel = true
): string[] | undefined {
  if (!raw) {
    return undefined;
  }

  if (noneSentinel && raw.trim().toLowerCase() === "none") {
    return undefined;
  }

  const parsed = raw
    .split(",")
    .map((provider) => provider.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : undefined;
}

function parseBooleanEnv(raw: string | undefined): boolean | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }

  return undefined;
}

function parseDataCollection(
  raw: string | undefined
): OpenRouterProviderRouting["dataCollection"] | undefined {
  if (!raw) {
    return undefined;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "allow" || normalized === "deny") {
    return normalized;
  }

  return undefined;
}

export function getOpenAIProviderRouting(): OpenRouterProviderRouting | undefined {
  const routing: OpenRouterProviderRouting = {
    only: parseProviderList(process.env.OPENROUTER_OPENAI_PROVIDER_ONLY, false),
    order: parseProviderList(process.env.OPENROUTER_OPENAI_PROVIDER_ORDER, false),
    ignore: parseProviderList(
      process.env.OPENROUTER_OPENAI_PROVIDER_IGNORE ??
        process.env.OPENROUTER_IGNORE_PROVIDERS
    ),
    allowFallbacks: parseBooleanEnv(
      process.env.OPENROUTER_OPENAI_ALLOW_FALLBACKS
    ),
    requireParameters: parseBooleanEnv(
      process.env.OPENROUTER_OPENAI_REQUIRE_PARAMETERS
    ),
    dataCollection: parseDataCollection(
      process.env.OPENROUTER_OPENAI_DATA_COLLECTION
    ),
    zdr: parseBooleanEnv(process.env.OPENROUTER_OPENAI_ZDR),
  };

  return Object.values(routing).some((value) => value !== undefined)
    ? routing
    : undefined;
}

export class OpenAIProvider implements ModelProvider {
  name = "openai";
  readonly model: string;

  constructor(model?: string) {
    this.model = model ?? getDefaultOpenAIModel();
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    return openRouterGenerate(
      input.model ?? this.model,
      input,
      this.name,
      getOpenAIProviderRouting(),
      getOpenAIMaxCompletionTokens()
    );
  }

  getLabel() {
    return {
      name: this.name,
      model: this.model,
    };
  }
}

export class OpenAISecondaryProvider implements ModelProvider {
  name = "openai-secondary";
  readonly model: string;

  constructor(model?: string) {
    this.model = model ?? getSecondaryOpenAIModel();
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    return openRouterGenerate(
      input.model ?? this.model,
      input,
      this.name,
      getOpenAIProviderRouting(),
      getOpenAIMaxCompletionTokens()
    );
  }

  getLabel() {
    return {
      name: this.name,
      model: this.model,
    };
  }
}
