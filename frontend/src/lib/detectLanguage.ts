import { franc } from "franc-min";
import langs from "langs";
import { findLanguageLabel } from "./languages";

const MIN_SAMPLE_LENGTH = 20;
const MAX_SAMPLE_CHARS = 10_000;

export interface DetectLanguageResult {
  code: string;
  label: string;
  iso639_3: string;
  confidence: "high" | "medium" | "low";
}

function sampleSubtitleText(cues: { originalText: string }[]): string {
  const parts: string[] = [];
  let length = 0;

  for (const cue of cues) {
    if (length >= MAX_SAMPLE_CHARS) break;
    parts.push(cue.originalText);
    length += cue.originalText.length;
  }

  return parts.join("\n");
}

function refinePortugueseVariant(text: string, code: string): string {
  if (code !== "pt") return code;
  const lower = text.toLowerCase();
  const brMarkers = /\b(você|voce|né|tá|pra|cê|beleza|aí|então)\b/;
  return brMarkers.test(lower) ? "pt-BR" : "pt";
}

function refineChineseVariant(text: string, code: string): string {
  if (code !== "zh") return code;
  if (/[體國臺灣說話們這個為]/u.test(text)) return "zh-TW";
  return "zh-CN";
}

function confidenceFromSampleSize(charCount: number): DetectLanguageResult["confidence"] {
  if (charCount >= 400) return "high";
  if (charCount >= 120) return "medium";
  return "low";
}

export function detectLanguageFromCues(
  cues: { originalText: string }[],
): DetectLanguageResult | null {
  const text = sampleSubtitleText(cues).trim();
  if (text.length < MIN_SAMPLE_LENGTH) return null;

  const iso639_3 = franc(text, { minLength: 10 });
  if (iso639_3 === "und") return null;

  const lang = langs.where("3", iso639_3);
  const baseCode = lang?.["1"];
  if (!baseCode) return null;

  let code = refinePortugueseVariant(text, baseCode);
  code = refineChineseVariant(text, code);

  return {
    code,
    label: findLanguageLabel(code),
    iso639_3,
    confidence: confidenceFromSampleSize(text.length),
  };
}
