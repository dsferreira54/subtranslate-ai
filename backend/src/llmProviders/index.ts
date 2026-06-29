import type { LlmProviderId } from "@subtranslate-ai/shared";
import type { LlmProvider } from "./base.js";
import { createOpenAiProvider } from "./openai.js";
import { createAnthropicProvider } from "./anthropic.js";
import { createGeminiProvider } from "./gemini.js";
import { createOpenRouterProvider, createCustomProvider } from "./openrouter.js";
import { createDeepSeekProvider } from "./deepseek.js";

export function createProvider(
  providerId: LlmProviderId,
  apiKey: string,
  customBaseUrl?: string,
): LlmProvider {
  switch (providerId) {
    case "openai":
      return createOpenAiProvider(apiKey);
    case "anthropic":
      return createAnthropicProvider(apiKey);
    case "gemini":
      return createGeminiProvider(apiKey);
    case "openrouter":
      return createOpenRouterProvider(apiKey);
    case "deepseek":
      return createDeepSeekProvider(apiKey);
    case "custom":
      if (!customBaseUrl) {
        throw new Error("Custom provider requires a base URL.");
      }
      return createCustomProvider(apiKey, customBaseUrl);
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
}

export * from "./base.js";
export { listModels, type ModelInfo } from "./listModels.js";
