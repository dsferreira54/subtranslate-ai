import type { TranslationJobPublic } from "@subtranslate-ai/shared";
import { getJob, subscribeToJobEvents, type JobEventHandlers } from "../api/client";
import { isTerminalJobStatus } from "./formatDuration";
import { appendProgressSnapshot, type ProgressSnapshot } from "./progressHistory";

export interface JobSubscriptionCallbacks {
  onJobUpdate: (job: TranslationJobPublic) => void;
  onProgressHistory: (updater: (prev: ProgressSnapshot[]) => ProgressSnapshot[]) => void;
  onError: (message: string) => void;
  onTerminal: (job: TranslationJobPublic, elapsedSeconds: number) => void;
  getStartedAt: () => number | null;
  isElapsedCaptured: () => boolean;
  markElapsedCaptured: () => void;
  isNotificationSent: () => boolean;
  markNotificationSent: () => void;
  notifyFinished: (job: TranslationJobPublic, filename: string, elapsedSeconds: number) => void;
  filename: string;
}

export function attachJobSubscription(
  jobId: string,
  callbacks: JobSubscriptionCallbacks,
): () => void {
  const handlers: JobEventHandlers = {
    onJobUpdate: (updatedJob) => {
      callbacks.onJobUpdate(updatedJob);
      callbacks.onProgressHistory((prev) => appendProgressSnapshot(prev, updatedJob));

      const startedAt = callbacks.getStartedAt();
      if (
        startedAt &&
        isTerminalJobStatus(updatedJob.status) &&
        !callbacks.isElapsedCaptured()
      ) {
        callbacks.markElapsedCaptured();
        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        callbacks.onTerminal(updatedJob, elapsed);

        if (!callbacks.isNotificationSent()) {
          callbacks.markNotificationSent();
          callbacks.notifyFinished(updatedJob, callbacks.filename, elapsed);
        }
      }
    },
    onEvent: (event) => {
      if (event.type === "error") {
        callbacks.onError(String(event.data.message ?? "Translation error"));
      }
    },
    onError: async (err) => {
      try {
        const job = await getJob(jobId);
        callbacks.onJobUpdate(job);
        if (isTerminalJobStatus(job.status)) return;
      } catch {
        callbacks.onError(err.message);
      }
    },
  };

  return subscribeToJobEvents(jobId, handlers, { autoReconnect: true });
}
