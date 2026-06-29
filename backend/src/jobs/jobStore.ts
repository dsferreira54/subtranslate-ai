import { randomUUID } from "node:crypto";
import type {
  JobEvent,
  JobStatus,
  SubtitleCue,
  TranslationJobPublic,
  TranslationSettings,
  ReviewReport,
} from "@subtranslate-ai/shared";
import type { TokenUsage } from "../llmProviders/base.js";

const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour

interface InternalJob {
  id: string;
  status: JobStatus;
  cues: SubtitleCue[];
  settings: TranslationSettings;
  filename?: string;
  progress: TranslationJobPublic["progress"];
  tokenUsage: TokenUsage & { estimatedCostUsd: number };
  logs: string[];
  cancelled: boolean;
  paused: boolean;
  pauseResolvers: Array<() => void>;
  subscribers: Set<(event: JobEvent) => void>;
  createdAt: number;
}

class JobStore {
  private jobs = new Map<string, InternalJob>();
  private secrets = new Map<string, string>();

  constructor() {
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  createJob(
    cues: SubtitleCue[],
    settings: TranslationSettings,
    apiKey: string,
    filename?: string,
  ): InternalJob {
    const id = randomUUID();
    const job: InternalJob = {
      id,
      status: "idle",
      cues: structuredClone(cues),
      settings,
      filename,
      progress: { total: cues.length, translated: 0, failed: 0, needsReview: 0 },
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
      logs: [],
      cancelled: false,
      paused: false,
      pauseResolvers: [],
      subscribers: new Set(),
      createdAt: Date.now(),
    };
    this.jobs.set(id, job);
    this.secrets.set(id, apiKey);
    return job;
  }

  getJob(id: string): InternalJob | undefined {
    return this.jobs.get(id);
  }

  getApiKey(id: string): string | undefined {
    return this.secrets.get(id);
  }

  deleteSecrets(id: string): void {
    this.secrets.delete(id);
  }

  toPublic(job: InternalJob): TranslationJobPublic {
    return {
      id: job.id,
      status: job.status,
      cues: job.cues,
      settings: job.settings,
      progress: job.progress,
      tokenUsage: {
        promptTokens: job.tokenUsage.promptTokens,
        completionTokens: job.tokenUsage.completionTokens,
        estimatedCostUsd: job.tokenUsage.estimatedCostUsd,
      },
      logs: job.logs,
      filename: job.filename,
    };
  }

  subscribe(jobId: string, callback: (event: JobEvent) => void): () => void {
    const job = this.jobs.get(jobId);
    if (!job) return () => {};
    job.subscribers.add(callback);
    return () => job.subscribers.delete(callback);
  }

  emit(jobId: string, type: JobEvent["type"], data: Record<string, unknown>): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const event: JobEvent = {
      type,
      jobId,
      timestamp: new Date().toISOString(),
      data,
    };

    if (type === "log" && typeof data.message === "string") {
      job.logs.push(`[${event.timestamp}] ${data.message}`);
    }

    if (type === "progress") {
      job.progress = {
        total: (data.total as number) ?? job.progress.total,
        translated: (data.translated as number) ?? job.progress.translated,
        failed: (data.failed as number) ?? job.progress.failed,
        needsReview: (data.needsReview as number) ?? job.progress.needsReview,
      };
      if (data.tokenUsage) {
        const usage = data.tokenUsage as TokenUsage;
        job.tokenUsage.promptTokens = usage.promptTokens;
        job.tokenUsage.completionTokens = usage.completionTokens;
        job.tokenUsage.totalTokens = usage.totalTokens;
      }
      if (typeof data.estimatedCostUsd === "number") {
        job.tokenUsage.estimatedCostUsd = data.estimatedCostUsd;
      }
    }

    if (type === "cueStart" || type === "cueComplete" || type === "cueRetry" ||
        type === "cueNeedsReview" || type === "cueFailed") {
      const cueId = data.cueId as number;
      const cue = job.cues.find((c) => c.id === cueId);
      if (cue) {
        if (data.status) cue.status = data.status as SubtitleCue["status"];
        if (data.translatedText !== undefined) cue.translatedText = data.translatedText as string;
        if (data.error !== undefined) cue.error = data.error as string;
      }
    }

    if (type === "complete") {
      job.status = "completed";
    }
    if (type === "error") {
      job.status = "failed";
    }

    for (const sub of job.subscribers) {
      sub(event);
    }
  }

  cancel(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    job.cancelled = true;
    job.status = "cancelled";
    this.resume(jobId);
    return true;
  }

  pause(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== "running") return false;
    job.paused = true;
    job.status = "paused";
    return true;
  }

  resume(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    job.paused = false;
    if (job.status === "paused") job.status = "running";
    for (const resolve of job.pauseResolvers) resolve();
    job.pauseResolvers = [];
    return true;
  }

  waitIfPaused(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || !job.paused) return Promise.resolve();
    return new Promise((resolve) => job.pauseResolvers.push(resolve));
  }

  setStatus(jobId: string, status: JobStatus): void {
    const job = this.jobs.get(jobId);
    if (job) job.status = status;
  }

  buildReport(jobId: string): ReviewReport | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    const entries = job.cues
      .filter((c) => c.status === "failed" || c.status === "needs_review")
      .map((c) => ({
        id: c.id,
        index: c.index,
        startTime: c.startTime,
        endTime: c.endTime,
        originalText: c.originalText,
        translatedText: c.translatedText,
        status: c.status,
        error: c.error,
      }));

    return {
      jobId: job.id,
      filename: job.filename,
      generatedAt: new Date().toISOString(),
      entries,
    };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, job] of this.jobs) {
      if (now - job.createdAt > JOB_TTL_MS) {
        this.jobs.delete(id);
        this.secrets.delete(id);
      }
    }
  }
}

export const jobStore = new JobStore();
export type { InternalJob };
