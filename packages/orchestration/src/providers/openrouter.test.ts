import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOpenRouterProviderPayload,
  type OpenRouterProviderRouting,
} from "./openrouter";
import { getOpenAIProviderRouting } from "./openai";

test("buildOpenRouterProviderPayload omits empty routing", () => {
  assert.equal(buildOpenRouterProviderPayload(undefined), undefined);
  assert.equal(buildOpenRouterProviderPayload({}), undefined);
});

test("buildOpenRouterProviderPayload maps routing fields to OpenRouter request keys", () => {
  const routing: OpenRouterProviderRouting = {
    only: ["azure"],
    order: ["azure", "openai"],
    ignore: ["deepinfra"],
    allowFallbacks: false,
    requireParameters: true,
    dataCollection: "deny",
    zdr: true,
  };

  assert.deepEqual(buildOpenRouterProviderPayload(routing), {
    only: ["azure"],
    order: ["azure", "openai"],
    ignore: ["deepinfra"],
    allow_fallbacks: false,
    require_parameters: true,
    data_collection: "deny",
    zdr: true,
  });
});

test("getOpenAIProviderRouting supports explicit Azure routing with legacy ignore fallback", () => {
  const originalOnly = process.env.OPENROUTER_OPENAI_PROVIDER_ONLY;
  const originalOrder = process.env.OPENROUTER_OPENAI_PROVIDER_ORDER;
  const originalIgnore = process.env.OPENROUTER_OPENAI_PROVIDER_IGNORE;
  const originalLegacyIgnore = process.env.OPENROUTER_IGNORE_PROVIDERS;
  const originalFallbacks = process.env.OPENROUTER_OPENAI_ALLOW_FALLBACKS;
  const originalRequire = process.env.OPENROUTER_OPENAI_REQUIRE_PARAMETERS;
  const originalDataCollection =
    process.env.OPENROUTER_OPENAI_DATA_COLLECTION;
  const originalZdr = process.env.OPENROUTER_OPENAI_ZDR;

  process.env.OPENROUTER_OPENAI_PROVIDER_ONLY = "azure";
  process.env.OPENROUTER_OPENAI_PROVIDER_ORDER = "azure,openai";
  delete process.env.OPENROUTER_OPENAI_PROVIDER_IGNORE;
  process.env.OPENROUTER_IGNORE_PROVIDERS = "deepinfra";
  process.env.OPENROUTER_OPENAI_ALLOW_FALLBACKS = "false";
  process.env.OPENROUTER_OPENAI_REQUIRE_PARAMETERS = "true";
  process.env.OPENROUTER_OPENAI_DATA_COLLECTION = "deny";
  process.env.OPENROUTER_OPENAI_ZDR = "true";

  try {
    assert.deepEqual(getOpenAIProviderRouting(), {
      only: ["azure"],
      order: ["azure", "openai"],
      ignore: ["deepinfra"],
      allowFallbacks: false,
      requireParameters: true,
      dataCollection: "deny",
      zdr: true,
    });
  } finally {
    if (originalOnly === undefined) {
      delete process.env.OPENROUTER_OPENAI_PROVIDER_ONLY;
    } else {
      process.env.OPENROUTER_OPENAI_PROVIDER_ONLY = originalOnly;
    }

    if (originalOrder === undefined) {
      delete process.env.OPENROUTER_OPENAI_PROVIDER_ORDER;
    } else {
      process.env.OPENROUTER_OPENAI_PROVIDER_ORDER = originalOrder;
    }

    if (originalIgnore === undefined) {
      delete process.env.OPENROUTER_OPENAI_PROVIDER_IGNORE;
    } else {
      process.env.OPENROUTER_OPENAI_PROVIDER_IGNORE = originalIgnore;
    }

    if (originalLegacyIgnore === undefined) {
      delete process.env.OPENROUTER_IGNORE_PROVIDERS;
    } else {
      process.env.OPENROUTER_IGNORE_PROVIDERS = originalLegacyIgnore;
    }

    if (originalFallbacks === undefined) {
      delete process.env.OPENROUTER_OPENAI_ALLOW_FALLBACKS;
    } else {
      process.env.OPENROUTER_OPENAI_ALLOW_FALLBACKS = originalFallbacks;
    }

    if (originalRequire === undefined) {
      delete process.env.OPENROUTER_OPENAI_REQUIRE_PARAMETERS;
    } else {
      process.env.OPENROUTER_OPENAI_REQUIRE_PARAMETERS = originalRequire;
    }

    if (originalDataCollection === undefined) {
      delete process.env.OPENROUTER_OPENAI_DATA_COLLECTION;
    } else {
      process.env.OPENROUTER_OPENAI_DATA_COLLECTION = originalDataCollection;
    }

    if (originalZdr === undefined) {
      delete process.env.OPENROUTER_OPENAI_ZDR;
    } else {
      process.env.OPENROUTER_OPENAI_ZDR = originalZdr;
    }
  }
});
