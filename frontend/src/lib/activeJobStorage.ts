import type { ProgressSnapshot } from "./progressHistory";

const STORAGE_KEY = "subtranslate-ai-active-job";

export interface ActiveJobSession {
  jobId: string;
  filename: string;
  startedAt: number;
  notificationSent: boolean;
  progressHistory: ProgressSnapshot[];
  elapsedSeconds: number | null;
}

export function getActiveJobSession(): ActiveJobSession | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveJobSession>;
    if (!parsed?.jobId || typeof parsed.jobId !== "string") return null;
    return {
      jobId: parsed.jobId,
      filename: typeof parsed.filename === "string" ? parsed.filename : "",
      startedAt: typeof parsed.startedAt === "number" ? parsed.startedAt : Date.now(),
      notificationSent: parsed.notificationSent === true,
      progressHistory: Array.isArray(parsed.progressHistory) ? parsed.progressHistory : [],
      elapsedSeconds: typeof parsed.elapsedSeconds === "number" ? parsed.elapsedSeconds : null,
    };
  } catch {
    return null;
  }
}

export function saveActiveJobSession(session: ActiveJobSession): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore quota errors — job still runs on the server.
  }
}

export function clearActiveJobSession(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
