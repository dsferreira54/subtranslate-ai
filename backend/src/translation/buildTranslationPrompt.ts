import type { TranslationSettings } from "@subtranslate-ai/shared";
import { resolveSystemPrompt } from "@subtranslate-ai/shared";
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
  const { sourceLanguage, targetLanguage, glossary, styleInstructions, systemPrompt } = settings;

  const systemPromptContent = resolveSystemPrompt(systemPrompt, sourceLanguage, targetLanguage);

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
    { role: "system", content: systemPromptContent },
    { role: "user", content: userContent },
  ];
}
