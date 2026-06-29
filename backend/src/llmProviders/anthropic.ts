import Anthropic from "@anthropic-ai/sdk";
import type { LlmProvider, ChatCompletionParams, ChatCompletionResult } from "./base.js";
import { LlmProviderError } from "./base.js";

export function createAnthropicProvider(apiKey: string): LlmProvider {
  const client = new Anthropic({ apiKey });

  return {
    async chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
      try {
        const systemMessage = params.messages.find((m) => m.role === "system");
        const otherMessages = params.messages.filter((m) => m.role !== "system");

        const response = await client.messages.create({
          model: params.model,
          max_tokens: 4096,
          temperature: params.temperature,
          system: systemMessage?.content,
          messages: otherMessages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
        });

        const textBlock = response.content.find((block) => block.type === "text");
        if (!textBlock || textBlock.type !== "text") {
          throw new LlmProviderError("Empty response from Anthropic", undefined, false);
        }

        return {
          content: textBlock.text,
          usage: {
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens,
          },
        };
      } catch (error) {
        if (error instanceof LlmProviderError) throw error;
        const status = (error as { status?: number }).status;
        const message = error instanceof Error ? error.message : "Anthropic request failed";
        const retryable = status === 429 || (status !== undefined && status >= 500);
        throw new LlmProviderError(message, status, retryable);
      }
    },
  };
}
