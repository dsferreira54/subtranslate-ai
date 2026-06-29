import type { TranslationSettings } from "@subtranslate-ai/shared";
import type { ChatMessage } from "../llmProviders/base.js";
import type { ContextWindow } from "./buildContextWindow.js";

interface PromptOptions {
  context: ContextWindow;
  settings: TranslationSettings;
  leakageRetry?: boolean;
  previousAttempt?: string;
  validationErrors?: string[];
}

function formatPreviousBlock(block: {
  index: string;
  originalText: string;
  translatedText?: string;
}) {
  return {
    index: block.index,
    originalText: block.originalText,
    translatedText: block.translatedText ?? null,
  };
}

function formatNextBlock(block: { index: string; originalText: string }) {
  return {
    index: block.index,
    originalText: block.originalText,
  };
}

export function buildTranslationPrompt(options: PromptOptions): ChatMessage[] {
  const { context, settings, leakageRetry, previousAttempt, validationErrors } = options;
  const { sourceLanguage, targetLanguage, glossary, styleInstructions } = settings;

  const systemPrompt = `You are a professional SRT subtitle translator.
Translate ONLY the block marked as CURRENT from ${sourceLanguage} to ${targetLanguage}.
Use previous and next blocks ONLY as semantic context — do NOT translate them.
Do NOT include information that appears only in context blocks.
Do NOT explain the translation.
Do NOT return markdown.
Do NOT alter timestamps or indices.
Do NOT merge dialogue from different blocks.
Do NOT add content that does not exist in the CURRENT block.
Preserve meaning, tone, intent, and register of the speech.
Prioritize natural, idiomatic language over literal translation. Avoid overly formal, archaic, uncommon, or dictionary-like vocabulary when a more natural alternative exists. Write as a native speaker would naturally speak in the target language, especially for dialogue and subtitles. When multiple translations are correct, always choose the most fluent, conversational, and widely used expression while preserving the original meaning and tone.
When ambiguous, use context to choose the best translation, but the final response must contain ONLY the CURRENT block translation.

Respond in strict JSON format:
{"translatedText": "translated text here"}`;

  const contextPayload = {
    previousBlocks: context.previousContext.map(formatPreviousBlock),
    currentBlock: {
      index: context.currentCue.index,
      originalText: context.currentCue.originalText,
      role: "CURRENT",
    },
    nextBlocks: context.nextContext.map(formatNextBlock),
  };

  let userContent = `Translate the CURRENT block below.

Context (for reference only — do NOT translate context blocks):
${JSON.stringify(contextPayload, null, 2)}`;

  if (glossary?.trim()) {
    userContent += `\n\nGlossary (use these translations consistently):\n${glossary.trim()}`;
  }

  if (styleInstructions?.trim()) {
    userContent += `\n\nStyle instructions:\n${styleInstructions.trim()}`;
  }

  if (leakageRetry) {
    userContent += `\n\nIMPORTANT: Your previous translation leaked context from surrounding blocks. Translate ONLY the CURRENT block.`;
    if (previousAttempt) {
      userContent += `\nPrevious invalid attempt: "${previousAttempt}"`;
    }
    if (validationErrors?.length) {
      userContent += `\nValidation errors: ${validationErrors.join("; ")}`;
    }
    userContent += `\nDo NOT include dialogue, names, or phrases from previous or next blocks unless they also appear in the CURRENT block.`;
  }

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];
}
