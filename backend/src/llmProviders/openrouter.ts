import { createOpenAiProvider } from "./openai.js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function createOpenRouterProvider(apiKey: string): LlmProvider {
  return createOpenAiProvider(apiKey, OPENROUTER_BASE_URL);
}

export function createCustomProvider(apiKey: string, baseUrl: string): LlmProvider {
  return createOpenAiProvider(apiKey, baseUrl);
}

// Re-export type for convenience
import type { LlmProvider } from "./base.js";
export type { LlmProvider };
