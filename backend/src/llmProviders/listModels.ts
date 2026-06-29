import type { LlmProviderId } from "@subtranslate-ai/shared";
import { redactSecrets } from "./base.js";

export interface ModelInfo {
  id: string;
  name?: string;
}

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

function buildModelsUrls(baseURL?: string): string[] {
  if (!baseURL) {
    return ["https://api.openai.com/v1/models"];
  }

  const trimmed = baseURL.replace(/\/$/, "");
  const urls = new Set<string>();

  if (trimmed.endsWith("/v1")) {
    urls.add(`${trimmed}/models`);
  } else {
    urls.add(`${trimmed}/models`);
    urls.add(`${trimmed}/v1/models`);
  }

  return [...urls];
}

async function fetchModelsFromUrl(url: string, apiKey: string): Promise<ModelInfo[]> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status} from ${url}: ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    data?: Array<{ id: string; name?: string }>;
  };

  if (!Array.isArray(data.data)) {
    throw new Error(`Unexpected response format from ${url}`);
  }

  return data.data
    .map((m) => ({ id: m.id, name: m.name ?? m.id }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function listOpenAiCompatible(apiKey: string, baseURL?: string): Promise<ModelInfo[]> {
  const urls = buildModelsUrls(baseURL);
  let lastError: Error | undefined;

  for (const url of urls) {
    try {
      return await fetchModelsFromUrl(url, apiKey);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("Failed to list models from provider.");
}

async function listAnthropicModels(apiKey: string): Promise<ModelInfo[]> {
  const response = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to list Anthropic models (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    data: Array<{ id: string; display_name?: string }>;
  };

  return data.data
    .map((m) => ({ id: m.id, name: m.display_name ?? m.id }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function listGeminiModels(apiKey: string): Promise<ModelInfo[]> {
  const models: ModelInfo[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: "100", key: apiKey });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?${params}`,
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to list Gemini models (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      models?: Array<{
        name: string;
        displayName?: string;
        supportedGenerationMethods?: string[];
      }>;
      nextPageToken?: string;
    };

    for (const model of data.models ?? []) {
      if (
        model.supportedGenerationMethods &&
        !model.supportedGenerationMethods.includes("generateContent")
      ) {
        continue;
      }
      const id = model.name.replace(/^models\//, "");
      models.push({ id, name: model.displayName ?? id });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return models.sort((a, b) => a.id.localeCompare(b.id));
}

export async function listModels(
  provider: LlmProviderId,
  apiKey: string,
  customBaseUrl?: string,
): Promise<ModelInfo[]> {
  try {
    switch (provider) {
      case "openai":
        return listOpenAiCompatible(apiKey);
      case "deepseek":
        return listOpenAiCompatible(apiKey, DEEPSEEK_BASE_URL);
      case "openrouter":
        return listOpenAiCompatible(apiKey, OPENROUTER_BASE_URL);
      case "custom":
        if (!customBaseUrl?.trim()) {
          throw new Error("Custom provider requires a base URL.");
        }
        return listOpenAiCompatible(apiKey, customBaseUrl.trim());
      case "anthropic":
        return listAnthropicModels(apiKey);
      case "gemini":
        return listGeminiModels(apiKey);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list models";
    throw new Error(redactSecrets(message, apiKey));
  }
}
