import type { SubtitleCue } from "@subtranslate-ai/shared";

const TIMESTAMP_PATTERN =
  /^(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})$/;

export class SrtParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SrtParseError";
  }
}

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function splitBlocks(content: string): string[] {
  return content
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function parseBlock(block: string, blockNumber: number): Omit<SubtitleCue, "id" | "status"> {
  const lines = block.split("\n");

  if (lines.length < 3) {
    throw new SrtParseError(
      `Block ${blockNumber}: expected at least 3 lines (index, timestamp, text), got ${lines.length}.`,
    );
  }

  const index = lines[0].trim();
  if (!/^\d+$/.test(index)) {
    throw new SrtParseError(
      `Block ${blockNumber}: invalid index "${index}". Expected a numeric index.`,
    );
  }

  const timestampMatch = lines[1].trim().match(TIMESTAMP_PATTERN);
  if (!timestampMatch) {
    throw new SrtParseError(
      `Block ${blockNumber}: invalid timestamp line "${lines[1].trim()}". Expected format HH:MM:SS,mmm --> HH:MM:SS,mmm.`,
    );
  }

  const originalText = lines.slice(2).join("\n").trim();
  if (!originalText) {
    throw new SrtParseError(`Block ${blockNumber}: subtitle text is empty.`);
  }

  return {
    index,
    startTime: timestampMatch[1],
    endTime: timestampMatch[2],
    originalText,
  };
}

export function parseSrt(content: string): SubtitleCue[] {
  const normalized = normalizeLineEndings(content);
  if (!normalized) {
    throw new SrtParseError("SRT file is empty.");
  }

  const blocks = splitBlocks(normalized);
  if (blocks.length === 0) {
    throw new SrtParseError("No subtitle blocks found in SRT file.");
  }

  return blocks.map((block, id) => {
    const parsed = parseBlock(block, id + 1);
    return {
      id,
      ...parsed,
      status: "pending" as const,
    };
  });
}

export function serializeSrt(cues: SubtitleCue[]): string {
  return cues
    .map((cue) => {
      const text = cue.translatedText ?? cue.originalText;
      return `${cue.index}\n${cue.startTime} --> ${cue.endTime}\n${text}`;
    })
    .join("\n\n")
    .concat("\n");
}

export function validateSrtFilename(filename: string): void {
  if (!filename.toLowerCase().endsWith(".srt")) {
    throw new SrtParseError("Only .srt files are accepted.");
  }
}
