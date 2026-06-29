import { createOpenAiProvider } from "./openai.js";
import type { LlmProvider } from "./base.js";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

export function createDeepSeekProvider(apiKey: string): LlmProvider {
  return createOpenAiProvider(apiKey, DEEPSEEK_BASE_URL);
}
