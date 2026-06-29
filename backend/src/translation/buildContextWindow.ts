import type { SubtitleCue } from "@subtranslate-ai/shared";

export interface ContextWindow {
  previousContext: SubtitleCue[];
  currentCue: SubtitleCue;
  nextContext: SubtitleCue[];
}

/**
 * Builds a sliding context window around the cue at `cueIndex`.
 *
 * Edge cases:
 * - First cue: no previous context, up to N next cues available.
 * - Last cue: up to N previous cues, no next context.
 * - Short files: window shrinks to however many cues exist on each side.
 */
export function buildContextWindow(
  cues: SubtitleCue[],
  cueIndex: number,
  windowSize: number,
): ContextWindow {
  const start = Math.max(0, cueIndex - windowSize);
  const end = Math.min(cues.length - 1, cueIndex + windowSize);

  return {
    previousContext: cues.slice(start, cueIndex),
    currentCue: cues[cueIndex],
    nextContext: cues.slice(cueIndex + 1, end + 1),
  };
}
