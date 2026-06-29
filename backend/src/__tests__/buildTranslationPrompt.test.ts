import { describe, it, expect } from "vitest";
import { resolveSystemPrompt, DEFAULT_TRANSLATION_SETTINGS } from "@subtranslate-ai/shared";
import { buildTranslationPrompt } from "../translation/buildTranslationPrompt.js";

describe("resolveSystemPrompt", () => {
  it("uses default template when systemPrompt is empty", () => {
    const result = resolveSystemPrompt(undefined, "en", "pt-BR");
    expect(result).toContain("from en to pt-BR");
    expect(result).toContain("Respond in strict JSON format");
  });

  it("replaces placeholders in custom template", () => {
    const result = resolveSystemPrompt(
      "Translate from {{sourceLanguage}} to {{targetLanguage}} only.",
      "ja",
      "es",
    );
    expect(result).toBe("Translate from ja to es only.");
  });
});

describe("buildTranslationPrompt", () => {
  it("uses custom system prompt from settings", () => {
    const messages = buildTranslationPrompt({
      context: {
        currentCue: {
          id: 0,
          index: "1",
          startTime: "00:00:01,000",
          endTime: "00:00:02,000",
          originalText: "Hello",
          status: "pending",
        },
        previousContext: [],
        nextContext: [],
      },
      settings: {
        ...DEFAULT_TRANSLATION_SETTINGS,
        systemPrompt: "Custom system instructions for {{sourceLanguage}} → {{targetLanguage}}.",
      },
    });

    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toBe("Custom system instructions for en → pt-BR.");
  });

  it("falls back to default when systemPrompt is not set", () => {
    const messages = buildTranslationPrompt({
      context: {
        currentCue: {
          id: 0,
          index: "1",
          startTime: "00:00:01,000",
          endTime: "00:00:02,000",
          originalText: "Hello",
          status: "pending",
        },
        previousContext: [],
        nextContext: [],
      },
      settings: DEFAULT_TRANSLATION_SETTINGS,
    });

    expect(messages[0].content).toBe(
      resolveSystemPrompt(undefined, DEFAULT_TRANSLATION_SETTINGS.sourceLanguage, DEFAULT_TRANSLATION_SETTINGS.targetLanguage),
    );
  });
});
