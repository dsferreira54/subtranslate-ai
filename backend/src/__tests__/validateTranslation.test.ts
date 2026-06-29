import { describe, expect, it } from "vitest";
import { validateTranslation, parseTranslationResponse } from "../translation/validateTranslation.js";
import type { SubtitleCue } from "@subtranslate-ai/shared";

function makeCue(id: number, text: string, translated?: string): SubtitleCue {
  return {
    id,
    index: String(id + 1),
    startTime: "00:00:01,000",
    endTime: "00:00:03,000",
    originalText: text,
    translatedText: translated,
    status: "pending",
  };
}

describe("validateTranslation", () => {
  const current = makeCue(1, "Hello there.");

  it("accepts valid translation", () => {
    const result = validateTranslation("Olá.", current, [], []);
    expect(result.valid).toBe(true);
  });

  it("rejects empty translation", () => {
    const result = validateTranslation("", current, [], []);
    expect(result.valid).toBe(false);
  });

  it("rejects SRT timestamp in translation", () => {
    const result = validateTranslation(
      "00:00:01,000 --> 00:00:03,000",
      current,
      [],
      [],
    );
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes("timestamp"))).toBe(true);
  });

  it("rejects disproportionately long translation", () => {
    const long = "A".repeat(500);
    const result = validateTranslation(long, current, [], []);
    expect(result.valid).toBe(false);
  });

  it("detects context-only term leakage", () => {
    const previous = [makeCue(0, "The secret codeword is Xylophone.")];
    const result = validateTranslation(
      "Xylophone is here.",
      makeCue(1, "Hello."),
      previous,
      [],
    );
    expect(result.valid).toBe(false);
  });
});

describe("parseTranslationResponse", () => {
  it("parses valid JSON", () => {
    const text = parseTranslationResponse('{"translatedText": "Olá."}');
    expect(text).toBe("Olá.");
  });

  it("extracts JSON from mixed content", () => {
    const text = parseTranslationResponse('Here is the result: {"translatedText": "Olá."}');
    expect(text).toBe("Olá.");
  });

  it("throws on invalid response", () => {
    expect(() => parseTranslationResponse("not json")).toThrow();
  });
});
