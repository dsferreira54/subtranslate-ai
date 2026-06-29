export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatCompletionParams {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  responseFormat?: "json";
}

export interface ChatCompletionResult {
  content: string;
  usage?: TokenUsage;
}

export interface LlmProvider {
  chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult>;
}

export class LlmProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "LlmProviderError";
  }
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof LlmProviderError) {
    return error.retryable;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("timeout") ||
      msg.includes("network") ||
      msg.includes("econnreset") ||
      msg.includes("fetch failed")
    );
  }
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === maxAttempts) {
        throw error;
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export function redactSecrets(text: string, apiKey?: string): string {
  if (!apiKey) return text;
  return text.replaceAll(apiKey, "[REDACTED]");
}
