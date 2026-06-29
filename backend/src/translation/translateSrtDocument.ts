import type { SubtitleCue, TranslationSettings } from "@subtranslate-ai/shared";
import type { LlmProvider, TokenUsage } from "../llmProviders/base.js";
import { redactSecrets } from "../llmProviders/base.js";
import { translateCue, type TranslateCueResult } from "./translateCue.js";

export type TranslationEventType =
  | "cueStart"
  | "cueComplete"
  | "cueRetry"
  | "cueNeedsReview"
  | "cueFailed"
  | "progress"
  | "log"
  | "complete"
  | "error";

export interface TranslationEvent {
  type: TranslationEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface TranslationControls {
  isCancelled: () => boolean;
  isPaused: () => boolean;
  waitIfPaused: () => Promise<void>;
}

export interface TranslateSrtDocumentOptions {
  cues: SubtitleCue[];
  settings: TranslationSettings;
  provider: LlmProvider;
  controls: TranslationControls;
  apiKey?: string;
  onEvent: (event: TranslationEvent) => void;
}

const MAX_PARALLELISM = 20;

// Rough per-1M-token pricing for cost estimate (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "claude-3-5-haiku-latest": { input: 0.8, output: 4 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "deepseek-v4-flash": { input: 0.14, output: 0.28 },
  "deepseek-v4-pro": { input: 0.55, output: 2.19 },
  "deepseek-chat": { input: 0.14, output: 0.28 },
};

function estimateCost(model: string, usage: TokenUsage): number {
  const pricing = MODEL_PRICING[model] ?? { input: 1, output: 3 };
  return (
    (usage.promptTokens / 1_000_000) * pricing.input +
    (usage.completionTokens / 1_000_000) * pricing.output
  );
}

function emit(
  onEvent: (event: TranslationEvent) => void,
  type: TranslationEventType,
  data: Record<string, unknown>,
) {
  onEvent({ type, timestamp: new Date().toISOString(), data });
}

function countByStatus(cues: SubtitleCue[]) {
  return {
    translated: cues.filter((c) => c.status === "translated").length,
    failed: cues.filter((c) => c.status === "failed").length,
    needsReview: cues.filter((c) => c.status === "needs_review").length,
  };
}

function applyCueResult(cue: SubtitleCue, result: TranslateCueResult): void {
  cue.status = result.status;
  if (result.translatedText !== undefined) {
    cue.translatedText = result.translatedText;
  }
  if (result.error) {
    cue.error = result.error;
  }
}

export async function translateSrtDocument(
  options: TranslateSrtDocumentOptions,
): Promise<{ cues: SubtitleCue[]; tokenUsage: TokenUsage; estimatedCostUsd: number }> {
  const { cues, settings, provider, controls, apiKey, onEvent } = options;
  const cache = new Map<string, string>();
  const parallelism = Math.max(1, Math.min(settings.parallelism ?? 1, MAX_PARALLELISM));
  let totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  emit(onEvent, "log", {
    message: `Starting translation of ${cues.length} cues (${parallelism} in parallel).`,
  });

  // Process cues in batches of `parallelism`. Each batch completes before the next starts,
  // so all translations from prior batches are available as context.
  for (let batchStart = 0; batchStart < cues.length; batchStart += parallelism) {
    if (controls.isCancelled()) {
      emit(onEvent, "log", { message: "Translation cancelled by user." });
      break;
    }

    await controls.waitIfPaused();

    const batchEnd = Math.min(batchStart + parallelism, cues.length);
    const batchIndices = Array.from(
      { length: batchEnd - batchStart },
      (_, j) => batchStart + j,
    );

    const batchResults = await Promise.all(
      batchIndices.map(async (i) => {
        if (controls.isCancelled()) return null;

        const cue = cues[i];
        cue.status = "translating";
        emit(onEvent, "cueStart", { cueId: cue.id, index: cue.index });

        const result = await translateCue({
          cues,
          cueIndex: i,
          settings,
          provider,
          cache,
          onStatusChange: (status) => {
            cue.status = status;
            if (status === "retrying") {
              emit(onEvent, "cueRetry", { cueId: cue.id, index: cue.index });
            }
          },
        });

        applyCueResult(cue, result);

        const eventType =
          result.status === "failed"
            ? "cueFailed"
            : result.status === "needs_review"
              ? "cueNeedsReview"
              : "cueComplete";

        emit(onEvent, eventType, {
          cueId: cue.id,
          index: cue.index,
          status: cue.status,
          translatedText: cue.translatedText,
          error: cue.error ? redactSecrets(cue.error, apiKey) : undefined,
        });

        return result;
      }),
    );

    for (const result of batchResults) {
      if (!result) continue;
      totalUsage = {
        promptTokens: totalUsage.promptTokens + result.usage.promptTokens,
        completionTokens: totalUsage.completionTokens + result.usage.completionTokens,
        totalTokens: totalUsage.totalTokens + result.usage.totalTokens,
      };
    }

    const counts = countByStatus(cues);
    const completed = cues.filter(
      (c) =>
        c.status === "translated" ||
        c.status === "failed" ||
        c.status === "needs_review",
    ).length;

    emit(onEvent, "progress", {
      total: cues.length,
      ...counts,
      current: completed,
      tokenUsage: totalUsage,
      estimatedCostUsd: estimateCost(settings.model, totalUsage),
    });
  }

  const counts = countByStatus(cues);
  const estimatedCostUsd = estimateCost(settings.model, totalUsage);

  if (!controls.isCancelled()) {
    emit(onEvent, "complete", {
      total: cues.length,
      ...counts,
      tokenUsage: totalUsage,
      estimatedCostUsd,
    });
    emit(onEvent, "log", {
      message: `Translation complete. ${counts.translated} translated, ${counts.needsReview} need review, ${counts.failed} failed.`,
    });
  }

  return { cues, tokenUsage: totalUsage, estimatedCostUsd };
}
