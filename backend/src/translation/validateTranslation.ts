import type { SubtitleCue } from "@subtranslate-ai/shared";

export interface ValidationResult {
  valid: boolean;
  reasons: string[];
}

const TIMESTAMP_PATTERN = /\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/;
const INDEX_LINE_PATTERN = /^\d+$/m;

const STOPWORDS = new Set([
  "that", "this", "with", "from", "have", "been", "were", "will", "would",
  "could", "should", "about", "into", "your", "their", "there", "what",
  "when", "where", "which", "while", "because", "though", "through",
  "para", "como", "mais", "muito", "isso", "essa", "esse", "aqui", "onde",
  "quando", "porque", "sobre", "entre", "depois", "antes", "também",
]);

const LENGTH_RATIO_THRESHOLD = 2.5;

function extractSignificantTokens(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
  return new Set(tokens);
}

/**
 * Validates that a translation does not leak content from surrounding context blocks.
 */
export function validateTranslation(
  translatedText: string,
  currentCue: SubtitleCue,
  previousContext: SubtitleCue[],
  nextContext: SubtitleCue[],
): ValidationResult {
  const reasons: string[] = [];
  const trimmed = translatedText.trim();
  const original = currentCue.originalText.trim();

  // Empty translation
  if (!trimmed) {
    reasons.push("Translation is empty.");
  }

  // SRT artifacts leaked into translation
  if (TIMESTAMP_PATTERN.test(trimmed)) {
    reasons.push("Translation contains SRT timestamp markers.");
  }
  if (trimmed.includes("-->")) {
    reasons.push("Translation contains SRT arrow marker (-->).");
  }
  if (INDEX_LINE_PATTERN.test(trimmed) && !original.match(INDEX_LINE_PATTERN)) {
    reasons.push("Translation contains standalone index numbers.");
  }

  // Disproportionate length — often indicates merged context dialogue
  if (original.length > 0 && trimmed.length > original.length * LENGTH_RATIO_THRESHOLD) {
    reasons.push(
      `Translation is disproportionately longer than original (${trimmed.length} vs ${original.length} chars).`,
    );
  }

  // Multi-utterance aggregation: extra blank lines or too many sentences vs original
  const originalLines = original.split("\n").filter(Boolean).length;
  const translatedLines = trimmed.split("\n").filter(Boolean).length;
  if (trimmed.includes("\n\n")) {
    reasons.push("Translation contains blank lines suggesting merged blocks.");
  }
  const originalSentences = (original.match(/[.!?]+/g) ?? []).length || 1;
  const translatedSentences = (trimmed.match(/[.!?]+/g) ?? []).length || 1;
  if (translatedSentences > originalSentences + 1 && translatedLines > originalLines + 1) {
    reasons.push("Translation appears to aggregate multiple utterances.");
  }

  // Context-only term leakage: terms in translation that appear in context but not in current original
  const currentTokens = extractSignificantTokens(original);
  const translationTokens = extractSignificantTokens(trimmed);
  const contextOnlyTokens = new Set<string>();

  for (const cue of [...previousContext, ...nextContext]) {
    for (const token of extractSignificantTokens(cue.originalText)) {
      if (!currentTokens.has(token)) {
        contextOnlyTokens.add(token);
      }
    }
  }

  const leakedTerms: string[] = [];
  for (const token of translationTokens) {
    if (contextOnlyTokens.has(token) && !currentTokens.has(token)) {
      leakedTerms.push(token);
    }
  }

  if (leakedTerms.length >= 2) {
    reasons.push(
      `Translation contains terms likely from context blocks only: ${leakedTerms.slice(0, 5).join(", ")}.`,
    );
  }

  return { valid: reasons.length === 0, reasons };
}

export function parseTranslationResponse(content: string): string {
  const trimmed = content.trim();

  // Try direct JSON parse
  try {
    const parsed = JSON.parse(trimmed) as { translatedText?: string };
    if (typeof parsed.translatedText === "string") {
      return parsed.translatedText.trim();
    }
  } catch {
    // fall through to regex extraction
  }

  // Fallback: extract JSON object from markdown or mixed content
  const jsonMatch = trimmed.match(/\{[\s\S]*"translatedText"[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]) as { translatedText?: string };
    if (typeof parsed.translatedText === "string") {
      return parsed.translatedText.trim();
    }
  }

  throw new Error("Invalid JSON response: missing translatedText field.");
}
