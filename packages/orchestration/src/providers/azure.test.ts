import test from "node:test";
import assert from "node:assert/strict";
import { AzureOpenAIProvider, getAzureOpenAIConfig } from "./azure";

test("getAzureOpenAIConfig reads direct Azure OpenAI env config", () => {
  const originalEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const originalKey = process.env.AZURE_OPENAI_API_KEY;
  const originalDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  const originalVersion = process.env.AZURE_OPENAI_API_VERSION;
  const originalModel = process.env.AZURE_OPENAI_DEFAULT_MODEL;

  process.env.AZURE_OPENAI_ENDPOINT = "https://example.openai.azure.com/";
  process.env.AZURE_OPENAI_API_KEY = "azure-test-key";
  process.env.AZURE_OPENAI_DEPLOYMENT_NAME = "gpt-5.4";
  process.env.AZURE_OPENAI_API_VERSION = "2024-02-01";
  process.env.AZURE_OPENAI_DEFAULT_MODEL = "gpt-5.4";

  try {
    assert.deepEqual(getAzureOpenAIConfig(), {
      endpoint: "https://example.openai.azure.com",
      apiKey: "azure-test-key",
      deploymentName: "gpt-5.4",
      apiVersion: "2024-02-01",
      model: "gpt-5.4",
    });
  } finally {
    if (originalEndpoint === undefined) {
      delete process.env.AZURE_OPENAI_ENDPOINT;
    } else {
      process.env.AZURE_OPENAI_ENDPOINT = originalEndpoint;
    }

    if (originalKey === undefined) {
      delete process.env.AZURE_OPENAI_API_KEY;
    } else {
      process.env.AZURE_OPENAI_API_KEY = originalKey;
    }

    if (originalDeployment === undefined) {
      delete process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    } else {
      process.env.AZURE_OPENAI_DEPLOYMENT_NAME = originalDeployment;
    }

    if (originalVersion === undefined) {
      delete process.env.AZURE_OPENAI_API_VERSION;
    } else {
      process.env.AZURE_OPENAI_API_VERSION = originalVersion;
    }

    if (originalModel === undefined) {
      delete process.env.AZURE_OPENAI_DEFAULT_MODEL;
    } else {
      process.env.AZURE_OPENAI_DEFAULT_MODEL = originalModel;
    }
  }
});

test("AzureOpenAIProvider falls back to capped OpenRouter OpenAI when Azure fails", async () => {
  const originalFetch = global.fetch;
  const originalEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const originalKey = process.env.AZURE_OPENAI_API_KEY;
  const originalDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  const originalVersion = process.env.AZURE_OPENAI_API_VERSION;
  const originalModel = process.env.AZURE_OPENAI_DEFAULT_MODEL;
  const originalRouterKey = process.env.OPENROUTER_API_KEY;
  const originalRouterModel = process.env.OPENROUTER_OPENAI_MODEL;
  const originalRouterCap =
    process.env.OPENROUTER_OPENAI_MAX_COMPLETION_TOKENS;

  process.env.AZURE_OPENAI_ENDPOINT = "https://example.openai.azure.com/";
  process.env.AZURE_OPENAI_API_KEY = "azure-test-key";
  process.env.AZURE_OPENAI_DEPLOYMENT_NAME = "gpt-5.4";
  process.env.AZURE_OPENAI_API_VERSION = "2024-02-01";
  process.env.AZURE_OPENAI_DEFAULT_MODEL = "gpt-5.4";
  process.env.OPENROUTER_API_KEY = "router-test-key";
  process.env.OPENROUTER_OPENAI_MODEL = "openai/gpt-5.4-20260305";
  process.env.OPENROUTER_OPENAI_MAX_COMPLETION_TOKENS = "48000";

  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  global.fetch = (async (input, init) => {
    const url = String(input);
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    requests.push({ url, body });

    if (url.includes("openai.azure.com")) {
      return new Response(JSON.stringify({ error: { message: "azure unavailable" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        model: "openai/gpt-5.4-20260305",
        choices: [{ message: { role: "assistant", content: "fallback ok" } }],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }) as typeof fetch;

  try {
    const provider = new AzureOpenAIProvider();
    const result = await provider.generateText({
      system: "Return ok.",
      user: "ping",
    });

    assert.equal(result.provider, "openai");
    assert.equal(result.model, "openai/gpt-5.4-20260305");
    assert.equal(result.text, "fallback ok");
    assert.equal(requests.length, 2);
    assert.match(requests[0].url, /openai\.azure\.com/);
    assert.match(requests[1].url, /openrouter\.ai/);
    assert.equal(requests[1].body.max_completion_tokens, 48000);
  } finally {
    global.fetch = originalFetch;

    if (originalEndpoint === undefined) {
      delete process.env.AZURE_OPENAI_ENDPOINT;
    } else {
      process.env.AZURE_OPENAI_ENDPOINT = originalEndpoint;
    }

    if (originalKey === undefined) {
      delete process.env.AZURE_OPENAI_API_KEY;
    } else {
      process.env.AZURE_OPENAI_API_KEY = originalKey;
    }

    if (originalDeployment === undefined) {
      delete process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
    } else {
      process.env.AZURE_OPENAI_DEPLOYMENT_NAME = originalDeployment;
    }

    if (originalVersion === undefined) {
      delete process.env.AZURE_OPENAI_API_VERSION;
    } else {
      process.env.AZURE_OPENAI_API_VERSION = originalVersion;
    }

    if (originalModel === undefined) {
      delete process.env.AZURE_OPENAI_DEFAULT_MODEL;
    } else {
      process.env.AZURE_OPENAI_DEFAULT_MODEL = originalModel;
    }

    if (originalRouterKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = originalRouterKey;
    }

    if (originalRouterModel === undefined) {
      delete process.env.OPENROUTER_OPENAI_MODEL;
    } else {
      process.env.OPENROUTER_OPENAI_MODEL = originalRouterModel;
    }

    if (originalRouterCap === undefined) {
      delete process.env.OPENROUTER_OPENAI_MAX_COMPLETION_TOKENS;
    } else {
      process.env.OPENROUTER_OPENAI_MAX_COMPLETION_TOKENS = originalRouterCap;
    }
  }
});
