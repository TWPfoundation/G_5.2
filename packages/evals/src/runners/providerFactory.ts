/**
 * providerFactory.ts — eval-layer provider construction.
 *
 * Wraps providerFromEnv() from orchestration with eval-specific
 * logging (which provider is active, why).
 *
 * Selection order:
 *   1. EVAL_PROVIDER=azure   → AzureOpenAIProvider
 *   2. EVAL_PROVIDER=openai  → OpenAIProvider
 *   3. EVAL_PROVIDER=anthropic → AnthropicProvider
 *   4. EVAL_PROVIDER=gemini (or unset, unless Azure is configured) → GeminiProvider
 *   5. No Azure/OpenRouter config → MockProvider (warns loudly)
 */

import { providerFromEnv } from "../../../orchestration/src/providers/fromEnv";
import { describeProvider } from "../../../orchestration/src/providers/label";
import type { ModelProvider } from "../../../orchestration/src/types/providers";

export function buildEvalProvider(): ModelProvider {
  const provider = providerFromEnv();

  if (provider.name === "mock") {
    console.warn(
      "[evals] WARNING: No OPENROUTER_API_KEY set — using MockProvider.\n" +
        "         Results will not be meaningful. Set the key to run real evals.\n"
    );
  } else {
    const label = describeProvider(provider);
    console.log(`[evals] Provider: ${label.name} (${label.model})\n`);
  }

  return provider;
}
