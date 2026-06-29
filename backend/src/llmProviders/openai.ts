import OpenAI from "openai";
import type { LlmProvider, ChatCompletionParams, ChatCompletionResult } from "./base.js";
import { LlmProviderError } from "./base.js";

export function createOpenAiProvider(apiKey: string, baseURL?: string): LlmProvider {
  const client = new OpenAI({ apiKey, baseURL });

  return {
    async chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
      try {
        const response = await client.chat.completions.create({
          model: params.model,
          messages: params.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          temperature: params.temperature,
          ...(params.responseFormat === "json"
            ? { response_format: { type: "json_object" as const } }
            : {}),
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new LlmProviderError("Empty response from OpenAI", undefined, false);
        }

        return {
          content,
          usage: response.usage
            ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
              }
            : undefined,
        };
      } catch (error) {
        if (error instanceof LlmProviderError) throw error;

        const status = (error as { status?: number }).status;
        const message = error instanceof Error ? error.message : "OpenAI request failed";
        const retryable = status === 429 || (status !== undefined && status >= 500);
        throw new LlmProviderError(message, status, retryable);
      }
    },
  };
}
