import type { TranslationJobPublic } from "@subtranslate-ai/shared";

export interface ProgressSnapshot {
  timestamp: number;
  translated: number;
  processed: number;
  total: number;
}

export function snapshotFromJob(job: TranslationJobPublic, timestamp = Date.now()): ProgressSnapshot {
  const { translated, failed, needsReview, total } = job.progress;
  return {
    timestamp,
    translated,
    processed: translated + failed + needsReview,
    total,
  };
}

export function appendProgressSnapshot(
  prev: ProgressSnapshot[],
  job: TranslationJobPublic,
): ProgressSnapshot[] {
  const next = snapshotFromJob(job);
  const last = prev[prev.length - 1];
  if (last && last.processed === next.processed && last.total === next.total) {
    return prev;
  }
  return [...prev, next].slice(-120);
}
