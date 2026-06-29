import { DEFAULT_SYSTEM_PROMPT_TEMPLATE } from "./defaultSystemPrompt.js";

export type CueStatus =
  | "pending"
  | "translating"
  | "translated"
  | "retrying"
  | "failed"
  | "needs_review";

export interface SubtitleCue {
  id: number;
  index: string;
  startTime: string;
  endTime: string;
  originalText: string;
  translatedText?: string;
  status: CueStatus;
  error?: string;
}

export type LlmProviderId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "deepseek"
  | "custom";

export interface TranslationSettings {
  provider: LlmProviderId;
  model: string;
  sourceLanguage: string;
  targetLanguage: string;
  contextWindowSize: number;
  temperature: number;
  maxRetries: number;
  parallelism: number;
  glossary?: string;
  styleInstructions?: string;
  systemPrompt?: string;
  customBaseUrl?: string;
}

export const DEFAULT_TRANSLATION_SETTINGS: TranslationSettings = {
  provider: "openai",
  model: "gpt-4o-mini",
  sourceLanguage: "en",
  targetLanguage: "pt-BR",
  contextWindowSize: 10,
  temperature: 0.2,
  maxRetries: 3,
  parallelism: 1,
  systemPrompt: DEFAULT_SYSTEM_PROMPT_TEMPLATE,
};

export type JobStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "cancelled"
  | "failed";

export interface TranslationJobPublic {
  id: string;
  status: JobStatus;
  cues: SubtitleCue[];
  settings: TranslationSettings;
  progress: {
    total: number;
    translated: number;
    failed: number;
    needsReview: number;
  };
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    estimatedCostUsd: number;
  };
  logs: string[];
  filename?: string;
}

export interface CreateJobRequest {
  cues: SubtitleCue[];
  settings: TranslationSettings;
  apiKey: string;
  filename?: string;
}

export interface ParseSrtResponse {
  cues: SubtitleCue[];
  filename: string;
}

export interface ModelInfo {
  id: string;
  name?: string;
}

export interface ListModelsRequest {
  provider: LlmProviderId;
  apiKey: string;
  customBaseUrl?: string;
}

export interface ListModelsResponse {
  models: ModelInfo[];
}

export type JobEventType =
  | "cueStart"
  | "cueComplete"
  | "cueRetry"
  | "cueNeedsReview"
  | "cueFailed"
  | "progress"
  | "log"
  | "jobStatus"
  | "complete"
  | "error";

export interface JobEvent {
  type: JobEventType;
  jobId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface ReviewReportEntry {
  id: number;
  index: string;
  startTime: string;
  endTime: string;
  originalText: string;
  translatedText?: string;
  status: CueStatus;
  error?: string;
}

export interface ReviewReport {
  jobId: string;
  filename?: string;
  generatedAt: string;
  entries: ReviewReportEntry[];
}

export const LLM_PROVIDERS: { id: LlmProviderId; label: string; defaultModel: string }[] = [
  { id: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini" },
  { id: "anthropic", label: "Anthropic Claude", defaultModel: "claude-3-5-haiku-latest" },
  { id: "gemini", label: "Google Gemini", defaultModel: "gemini-2.0-flash" },
  { id: "openrouter", label: "OpenRouter", defaultModel: "openai/gpt-4o-mini" },
  { id: "deepseek", label: "DeepSeek", defaultModel: "deepseek-v4-flash" },
  { id: "custom", label: "Custom (OpenAI-compatible)", defaultModel: "gpt-4o-mini" },
];
