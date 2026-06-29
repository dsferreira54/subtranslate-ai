import {
  DEFAULT_TRANSLATION_SETTINGS,
  type JobEvent,
  type ParseSrtResponse,
  type SubtitleCue,
  type TranslationJobPublic,
  type TranslationSettings,
  type CreateJobRequest,
  type ReviewReport,
  type ListModelsRequest,
  type ModelInfo,
} from "@subtranslate-ai/shared";

const API_BASE = "/api";

export async function parseSrt(file: File): Promise<ParseSrtResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/parse`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to parse SRT file.");
  return data;
}

export async function startJob(
  cues: SubtitleCue[],
  settings: TranslationSettings,
  apiKey: string,
  filename?: string,
): Promise<{ jobId: string }> {
  const body: CreateJobRequest = { cues, settings, apiKey, filename };
  const res = await fetch(`${API_BASE}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to start translation job.");
  return data;
}

export async function getJob(jobId: string): Promise<TranslationJobPublic> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Job not found.");
  return data;
}

export async function cancelJob(jobId: string): Promise<void> {
  await fetch(`${API_BASE}/jobs/${jobId}/cancel`, { method: "POST" });
}

export async function pauseJob(jobId: string): Promise<void> {
  await fetch(`${API_BASE}/jobs/${jobId}/pause`, { method: "POST" });
}

export async function resumeJob(jobId: string): Promise<void> {
  await fetch(`${API_BASE}/jobs/${jobId}/resume`, { method: "POST" });
}

export function getDownloadUrl(jobId: string): string {
  return `${API_BASE}/jobs/${jobId}/download`;
}

export async function fetchModels(
  provider: ListModelsRequest["provider"],
  apiKey: string,
  customBaseUrl?: string,
): Promise<ModelInfo[]> {
  const body: ListModelsRequest = { provider, apiKey, customBaseUrl };
  const res = await fetch(`${API_BASE}/models`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    const message =
      (typeof data.error === "string" && data.error) ||
      (typeof data.message === "string" && data.message) ||
      "Failed to fetch models.";
    throw new Error(message);
  }
  return data.models;
}

export async function fetchReport(jobId: string): Promise<ReviewReport> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/report`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to fetch report.");
  return data;
}

export interface JobEventHandlers {
  onEvent?: (event: JobEvent) => void;
  onJobUpdate?: (job: TranslationJobPublic) => void;
  onError?: (error: Error) => void;
}

export function subscribeToJobEvents(
  jobId: string,
  handlers: JobEventHandlers,
): () => void {
  const source = new EventSource(`${API_BASE}/jobs/${jobId}/events`);

  const handleMessage = (event: MessageEvent) => {
    try {
      const parsed: JobEvent = JSON.parse(event.data);
      handlers.onEvent?.(parsed);

      if (parsed.type === "jobStatus" && parsed.data.job) {
        handlers.onJobUpdate?.(parsed.data.job as TranslationJobPublic);
      }

      if (
        parsed.type === "progress" ||
        parsed.type === "cueComplete" ||
        parsed.type === "cueStart" ||
        parsed.type === "cueRetry" ||
        parsed.type === "cueNeedsReview" ||
        parsed.type === "cueFailed" ||
        parsed.type === "complete"
      ) {
        getJob(jobId)
          .then((job) => handlers.onJobUpdate?.(job))
          .catch((err) => handlers.onError?.(err));
      }
    } catch (err) {
      handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  for (const eventType of [
    "jobStatus", "cueStart", "cueComplete", "cueRetry",
    "cueNeedsReview", "cueFailed", "progress", "log", "complete", "error",
  ]) {
    source.addEventListener(eventType, handleMessage);
  }

  source.onerror = () => {
    handlers.onError?.(new Error("Lost connection to translation server."));
  };

  return () => source.close();
}

export { DEFAULT_TRANSLATION_SETTINGS };
