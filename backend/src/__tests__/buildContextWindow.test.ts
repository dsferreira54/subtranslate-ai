import { describe, expect, it } from "vitest";
import { buildContextWindow } from "../translation/buildContextWindow.js";
import type { SubtitleCue } from "@subtranslate-ai/shared";

function makeCue(id: number, text: string): SubtitleCue {
  return {
    id,
    index: String(id + 1),
    startTime: "00:00:01,000",
    endTime: "00:00:03,000",
    originalText: text,
    status: "pending",
  };
}

describe("buildContextWindow", () => {
  const cues = Array.from({ length: 5 }, (_, i) => makeCue(i, `Cue ${i + 1}`));

  it("returns full window for middle cue", () => {
    const window = buildContextWindow(cues, 2, 10);
    expect(window.previousContext).toHaveLength(2);
    expect(window.currentCue.id).toBe(2);
    expect(window.nextContext).toHaveLength(2);
  });

  it("handles first cue with no previous context", () => {
    const window = buildContextWindow(cues, 0, 10);
    expect(window.previousContext).toHaveLength(0);
    expect(window.nextContext).toHaveLength(4);
  });

  it("handles last cue with no next context", () => {
    const window = buildContextWindow(cues, 4, 10);
    expect(window.previousContext).toHaveLength(4);
    expect(window.nextContext).toHaveLength(0);
  });

  it("respects window size limit", () => {
    const manyCues = Array.from({ length: 30 }, (_, i) => makeCue(i, `Cue ${i}`));
    const window = buildContextWindow(manyCues, 15, 3);
    expect(window.previousContext).toHaveLength(3);
    expect(window.nextContext).toHaveLength(3);
  });
});
