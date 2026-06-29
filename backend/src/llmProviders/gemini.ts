import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LlmProvider, ChatCompletionParams, ChatCompletionResult } from "./base.js";
import { LlmProviderError } from "./base.js";

export function createGeminiProvider(apiKey: string): LlmProvider {
  const genAI = new GoogleGenerativeAI(apiKey);

  return {
    async chatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
      try {
        const model = genAI.getGenerativeModel({
          model: params.model,
          generationConfig: {
            temperature: params.temperature,
            ...(params.responseFormat === "json"
              ? { responseMimeType: "application/json" }
              : {}),
          },
        });

        const systemMessage = params.messages.find((m) => m.role === "system");
        const conversation = params.messages.filter((m) => m.role !== "system");

        const prompt = [
          systemMessage ? `System:\n${systemMessage.content}\n\n` : "",
          ...conversation.map((m) => `${m.role}:\n${m.content}`),
        ].join("\n\n");

        const result = await model.generateContent(prompt);
        const content = result.response.text();

        if (!content) {
          throw new LlmProviderError("Empty response from Gemini", undefined, false);
        }

        const usage = result.response.usageMetadata;
        return {
          content,
          usage: usage
            ? {
                promptTokens: usage.promptTokenCount ?? 0,
                completionTokens: usage.candidatesTokenCount ?? 0,
                totalTokens: usage.totalTokenCount ?? 0,
              }
            : undefined,
        };
      } catch (error) {
        if (error instanceof LlmProviderError) throw error;
        const message = error instanceof Error ? error.message : "Gemini request failed";
        const retryable =
          message.includes("429") ||
          message.includes("503") ||
          message.includes("RESOURCE_EXHAUSTED");
        throw new LlmProviderError(message, undefined, retryable);
      }
    },
  };
}
