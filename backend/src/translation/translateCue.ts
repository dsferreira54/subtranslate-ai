import type { SubtitleCue, TranslationSettings } from "@subtranslate-ai/shared";
import type { LlmProvider, TokenUsage } from "../llmProviders/base.js";
import { withRetry } from "../llmProviders/base.js";
import { buildContextWindow } from "./buildContextWindow.js";
import { buildTranslationPrompt } from "./buildTranslationPrompt.js";
import {
  validateTranslation,
  parseTranslationResponse,
} from "./validateTranslation.js";

export interface TranslateCueResult {
  translatedText?: string;
  status: SubtitleCue["status"];
  error?: string;
  usage: TokenUsage;
}

export interface TranslateCueOptions {
  cues: SubtitleCue[];
  cueIndex: number;
  settings: TranslationSettings;
  provider: LlmProvider;
  cache?: Map<string, string>;
  onStatusChange?: (status: SubtitleCue["status"]) => void;
}

function cacheKey(text: string, settings: TranslationSettings): string {
  return `${settings.provider}:${settings.model}:${settings.sourceLanguage}:${settings.targetLanguage}:${text}`;
}

export async function translateCue(options: TranslateCueOptions): Promise<TranslateCueResult> {
  const { cues, cueIndex, settings, provider, cache, onStatusChange } = options;
  const cue = cues[cueIndex];
  const key = cacheKey(cue.originalText, settings);

  if (cache?.has(key)) {
    return {
      translatedText: cache.get(key),
      status: "translated",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }

  const context = buildContextWindow(cues, cueIndex, settings.contextWindowSize);
  let totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let lastAttempt: string | undefined;
  let lastErrors: string[] = [];

  for (let attempt = 0; attempt <= settings.maxRetries; attempt++) {
    const isRetry = attempt > 0;
    onStatusChange?.(isRetry ? "retrying" : "translating");

    const messages = buildTranslationPrompt({
      context,
      settings,
      leakageRetry: isRetry,
      previousAttempt: lastAttempt,
      validationErrors: lastErrors,
    });

    try {
      const result = await withRetry(() =>
        provider.chatCompletion({
          model: settings.model,
          messages,
          temperature: isRetry ? Math.max(0.1, settings.temperature - 0.1) : settings.temperature,
          responseFormat: "json",
        }),
      );

      if (result.usage) {
        totalUsage = {
          promptTokens: totalUsage.promptTokens + result.usage.promptTokens,
          completionTokens: totalUsage.completionTokens + result.usage.completionTokens,
          totalTokens: totalUsage.totalTokens + result.usage.totalTokens,
        };
      }

      const translatedText = parseTranslationResponse(result.content);
      lastAttempt = translatedText;

      const validation = validateTranslation(
        translatedText,
        cue,
        context.previousContext,
        context.nextContext,
      );

      if (validation.valid) {
        cache?.set(key, translatedText);
        return { translatedText, status: "translated", usage: totalUsage };
      }

      lastErrors = validation.reasons;
      if (attempt === settings.maxRetries) {
        return {
          translatedText,
          status: "needs_review",
          error: validation.reasons.join(" "),
          usage: totalUsage,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Translation failed";
      if (attempt === settings.maxRetries) {
        return { status: "failed", error: message, usage: totalUsage };
      }
      lastErrors = [message];
    }
  }

  return { status: "failed", error: "Max retries exceeded.", usage: totalUsage };
}
