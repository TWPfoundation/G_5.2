import type {
  GenerateTextInput,
  GenerateTextOutput,
  ModelProvider,
  ProviderLabel,
} from "../types/providers";
import { OpenAIProvider } from "./openai";

interface AzureChatChoice {
  message?: {
    role?: string;
    content?: string;
  };
}

interface AzureChatResponse {
  model?: string;
  choices?: AzureChatChoice[];
  error?: {
    message?: string;
    code?: string;
  };
}

export interface AzureOpenAIConfig {
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  apiVersion: string;
  model: string;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getAzureOpenAIConfig(): AzureOpenAIConfig | undefined {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME?.trim();
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION?.trim();

  if (!endpoint || !apiKey || !deploymentName || !apiVersion) {
    return undefined;
  }

  return {
    endpoint: trimTrailingSlash(endpoint),
    apiKey,
    deploymentName,
    apiVersion,
    model:
      process.env.AZURE_OPENAI_DEFAULT_MODEL?.trim() || deploymentName,
  };
}

function getAzureRequestUrl(config: AzureOpenAIConfig): string {
  return `${config.endpoint}/openai/deployments/${config.deploymentName}/chat/completions?api-version=${config.apiVersion}`;
}

async function readErrorBody(response: Response): Promise<string> {
  return response.text().catch(() => "(unreadable body)");
}

async function generateViaAzure(
  config: AzureOpenAIConfig,
  input: GenerateTextInput
): Promise<GenerateTextOutput> {
  const body: Record<string, unknown> = {
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
    ...(input.temperature !== undefined
      ? { temperature: input.temperature }
      : {}),
  };

  const response = await fetch(getAzureRequestUrl(config), {
    method: "POST",
    headers: {
      "api-key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await readErrorBody(response);
    throw new Error(
      `Azure OpenAI request failed [${response.status} ${response.statusText}] ` +
        `deployment=${config.deploymentName} endpoint=${config.endpoint}\n${errorText}`
    );
  }

  const data = (await response.json()) as AzureChatResponse;

  if (data.error?.message) {
    throw new Error(
      `Azure OpenAI error [${data.error.code ?? "unknown"}]: ${data.error.message} ` +
        `deployment=${config.deploymentName}`
    );
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(
      `Azure OpenAI returned empty content. deployment=${config.deploymentName} endpoint=${config.endpoint}`
    );
  }

  return {
    text: content,
    provider: "azure",
    model: data.model ?? config.model,
  };
}

export class AzureOpenAIProvider implements ModelProvider {
  name = "azure";
  readonly model: string;
  private readonly config: AzureOpenAIConfig | undefined;
  private readonly fallback: OpenAIProvider | undefined;
  private lastLabel: ProviderLabel;

  constructor(
    config = getAzureOpenAIConfig(),
    fallback = process.env.OPENROUTER_API_KEY ? new OpenAIProvider() : undefined
  ) {
    this.config = config;
    this.fallback = fallback;
    this.model = config?.model ?? fallback?.model ?? "unknown";
    this.lastLabel = {
      name: config ? "azure" : fallback?.name ?? this.name,
      model: this.model,
    };
  }

  getLabel(): ProviderLabel {
    return this.lastLabel;
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    if (this.config) {
      try {
        const result = await generateViaAzure(this.config, input);
        this.lastLabel = {
          name: result.provider,
          model: result.model,
        };
        return result;
      } catch (error) {
        if (!this.fallback) {
          throw error;
        }
      }
    }

    if (!this.fallback) {
      throw new Error(
        "Azure OpenAI is not configured and no OpenRouter fallback is available."
      );
    }

    const fallbackResult = await this.fallback.generateText(input);
    this.lastLabel = {
      name: fallbackResult.provider,
      model: fallbackResult.model,
    };
    return fallbackResult;
  }
}
