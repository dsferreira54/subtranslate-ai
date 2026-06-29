import { describe, expect, it } from "vitest";
import { parseSrt, serializeSrt, SrtParseError } from "../srtParser.js";

const SAMPLE_SRT = `1
00:00:01,000 --> 00:00:03,000
Hello, world!

2
00:00:04,000 --> 00:00:06,000
How are you?
`;

describe("parseSrt", () => {
  it("parses valid SRT content", () => {
    const cues = parseSrt(SAMPLE_SRT);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({
      id: 0,
      index: "1",
      startTime: "00:00:01,000",
      endTime: "00:00:03,000",
      originalText: "Hello, world!",
      status: "pending",
    });
    expect(cues[1].originalText).toBe("How are you?");
  });

  it("handles multi-line subtitle text", () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
Line one
Line two
`;
    const cues = parseSrt(srt);
    expect(cues[0].originalText).toBe("Line one\nLine two");
  });

  it("rejects empty files", () => {
    expect(() => parseSrt("")).toThrow(SrtParseError);
  });

  it("rejects invalid timestamp", () => {
    const srt = `1
invalid timestamp
Hello
`;
    expect(() => parseSrt(srt)).toThrow(/invalid timestamp/i);
  });

  it("rejects invalid index", () => {
    const srt = `abc
00:00:01,000 --> 00:00:03,000
Hello
`;
    expect(() => parseSrt(srt)).toThrow(/invalid index/i);
  });
});

describe("serializeSrt", () => {
  it("preserves indices and timestamps", () => {
    const cues = parseSrt(SAMPLE_SRT);
    cues[0].translatedText = "Olá, mundo!";
    cues[1].translatedText = "Como vai você?";

    const output = serializeSrt(cues);
    expect(output).toContain("1\n00:00:01,000 --> 00:00:03,000\nOlá, mundo!");
    expect(output).toContain("2\n00:00:04,000 --> 00:00:06,000\nComo vai você?");
  });

  it("falls back to original text when translation is missing", () => {
    const cues = parseSrt(SAMPLE_SRT);
    const output = serializeSrt(cues);
    expect(output).toContain("Hello, world!");
  });

  it("round-trips structure", () => {
    const cues = parseSrt(SAMPLE_SRT);
    const reparsed = parseSrt(serializeSrt(cues));
    expect(reparsed.map((c) => c.index)).toEqual(cues.map((c) => c.index));
    expect(reparsed.map((c) => c.startTime)).toEqual(cues.map((c) => c.startTime));
  });
});
