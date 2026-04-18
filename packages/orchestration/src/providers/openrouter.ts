/**
 * openrouter.ts — shared OpenRouter API client
 *
 * Both OpenAI and Anthropic models are accessed through OpenRouter.
 * This module handles the HTTP call, error surfacing, and response
 * parsing so provider files stay thin.
 *
 * OpenRouter exposes an OpenAI-compatible chat completions endpoint:
 *   POST https://openrouter.ai/api/v1/chat/completions
 *   Authorization: Bearer {OPENROUTER_API_KEY}
 *
 * Docs: https://openrouter.ai/docs
 */

import type { GenerateTextInput, GenerateTextOutput } from "../types/providers";

const BASE_URL =
  process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

// Minimal response shape — only what we actually use
interface OpenRouterChoice {
  message: {
    role: string;
    content: string;
  };
}

interface OpenRouterResponse {
  id: string;
  model: string;
  choices: OpenRouterChoice[];
  error?: { message: string; code?: string };
}

export interface OpenRouterProviderRouting {
  order?: string[];
  only?: string[];
  ignore?: string[];
  allowFallbacks?: boolean;
  requireParameters?: boolean;
  dataCollection?: "allow" | "deny";
  zdr?: boolean;
}

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. " +
        "Add it to your .env file (see .env.example)."
    );
  }
  return key;
}

export function buildOpenRouterProviderPayload(
  routing?: OpenRouterProviderRouting
): Record<string, unknown> | undefined {
  if (!routing) {
    return undefined;
  }

  const payload: Record<string, unknown> = {};

  if (routing.order && routing.order.length > 0) {
    payload.order = routing.order;
  }

  if (routing.only && routing.only.length > 0) {
    payload.only = routing.only;
  }

  if (routing.ignore && routing.ignore.length > 0) {
    payload.ignore = routing.ignore;
  }

  if (routing.allowFallbacks !== undefined) {
    payload.allow_fallbacks = routing.allowFallbacks;
  }

  if (routing.requireParameters !== undefined) {
    payload.require_parameters = routing.requireParameters;
  }

  if (routing.dataCollection !== undefined) {
    payload.data_collection = routing.dataCollection;
  }

  if (routing.zdr !== undefined) {
    payload.zdr = routing.zdr;
  }

  return Object.keys(payload).length > 0 ? payload : undefined;
}

export async function openRouterGenerate(
  model: string,
  input: GenerateTextInput,
  providerName: string,
  routing?: OpenRouterProviderRouting,
  maxCompletionTokens?: number
): Promise<GenerateTextOutput> {
  const apiKey = getApiKey();
  const providerPayload = buildOpenRouterProviderPayload(routing);

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
    ...(input.temperature !== undefined
      ? { temperature: input.temperature }
      : {}),
    ...(maxCompletionTokens !== undefined
      ? { max_completion_tokens: maxCompletionTokens }
      : {}),
    ...(providerPayload ? { provider: providerPayload } : {}),
  };

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // OpenRouter recommends identifying your app
      "HTTP-Referer": "https://github.com/g52",
      "X-Title": "G_5.2",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "(unreadable body)");
    throw new Error(
      `OpenRouter request failed [${response.status} ${response.statusText}] ` +
        `provider=${providerName} model=${model}\n${errorText}`
    );
  }

  const data = (await response.json()) as OpenRouterResponse;

  // OpenRouter can return a top-level error even with 200
  if (data.error) {
    throw new Error(
      `OpenRouter error [${data.error.code ?? "unknown"}]: ${data.error.message} ` +
        `provider=${providerName} model=${model}`
    );
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(
      `OpenRouter returned empty content. provider=${providerName} model=${model} ` +
        `response=${JSON.stringify(data)}`
    );
  }

  return {
    text: content,
    provider: providerName,
    model: data.model ?? model,
  };
}
