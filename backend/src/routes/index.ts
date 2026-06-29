import type { FastifyInstance } from "fastify";
import { parseSrt, serializeSrt, validateSrtFilename, SrtParseError } from "../srtParser.js";
import { jobStore } from "../jobs/jobStore.js";
import { createProvider } from "../llmProviders/index.js";
import { translateSrtDocument } from "../translation/translateSrtDocument.js";
import { redactSecrets } from "../llmProviders/base.js";
import type { CreateJobRequest, ListModelsRequest } from "@subtranslate-ai/shared";
import { listModels } from "../llmProviders/listModels.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/parse", async (request, reply) => {
    const data = await request.file({ limits: { fileSize: MAX_FILE_SIZE } });
    if (!data) {
      return reply.status(400).send({ error: "No file uploaded." });
    }

    const filename = data.filename;
    try {
      validateSrtFilename(filename);
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof SrtParseError ? error.message : "Invalid file.",
      });
    }

    const buffer = await data.toBuffer();
    const content = buffer.toString("utf-8");

    try {
      const cues = parseSrt(content);
      return { cues, filename };
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof SrtParseError ? error.message : "Failed to parse SRT file.",
      });
    }
  });

  app.post<{ Body: ListModelsRequest }>("/api/models", async (request, reply) => {
    const { provider, apiKey, customBaseUrl } = request.body;

    if (!apiKey?.trim()) {
      return reply.status(400).send({ error: "API key is required." });
    }
    if (provider === "custom" && !customBaseUrl?.trim()) {
      return reply.status(400).send({ error: "Custom provider requires a base URL." });
    }

    try {
      const models = await listModels(provider, apiKey.trim(), customBaseUrl);
      return { models };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to list models";
      return reply.status(502).send({
        error: redactSecrets(message, apiKey),
      });
    }
  });

  app.post<{ Body: CreateJobRequest }>("/api/jobs", async (request, reply) => {
    const { cues, settings, apiKey, filename } = request.body;

    if (!cues?.length) {
      return reply.status(400).send({ error: "No cues provided." });
    }
    if (!apiKey?.trim()) {
      return reply.status(400).send({ error: "API key is required." });
    }
    if (!settings?.model?.trim()) {
      return reply.status(400).send({ error: "Model is required." });
    }
    if (settings.provider === "custom" && !settings.customBaseUrl?.trim()) {
      return reply.status(400).send({ error: "Custom provider requires a base URL." });
    }

    const job = jobStore.createJob(cues, settings, apiKey.trim(), filename);
    jobStore.setStatus(job.id, "running");

    // Start translation asynchronously
    runTranslation(job.id).catch((error) => {
      const message = error instanceof Error ? error.message : "Translation failed";
      jobStore.emit(job.id, "error", {
        message: redactSecrets(message, apiKey),
      });
      jobStore.setStatus(job.id, "failed");
    });

    return { jobId: job.id };
  });

  app.get<{ Params: { id: string } }>("/api/jobs/:id", async (request, reply) => {
    const job = jobStore.getJob(request.params.id);
    if (!job) return reply.status(404).send({ error: "Job not found." });
    return jobStore.toPublic(job);
  });

  app.get<{ Params: { id: string } }>("/api/jobs/:id/events", async (request, reply) => {
    const jobId = request.params.id;
    const job = jobStore.getJob(jobId);
    if (!job) return reply.status(404).send({ error: "Job not found." });

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const send = (event: { type: string; jobId: string; timestamp: string; data: Record<string, unknown> }) => {
      reply.raw.write(`event: ${event.type}\n`);
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // Send current state snapshot
    send({
      type: "jobStatus",
      jobId,
      timestamp: new Date().toISOString(),
      data: { job: jobStore.toPublic(job) },
    });

    const unsubscribe = jobStore.subscribe(jobId, send);

    await new Promise<void>((resolve) => {
      request.raw.on("close", () => {
        unsubscribe();
        resolve();
      });
    });
  });

  app.post<{ Params: { id: string } }>("/api/jobs/:id/cancel", async (request, reply) => {
    const ok = jobStore.cancel(request.params.id);
    if (!ok) return reply.status(404).send({ error: "Job not found." });
    jobStore.emit(request.params.id, "log", { message: "Cancellation requested." });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/api/jobs/:id/pause", async (request, reply) => {
    const ok = jobStore.pause(request.params.id);
    if (!ok) return reply.status(400).send({ error: "Job not found or not running." });
    jobStore.emit(request.params.id, "log", { message: "Translation paused." });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/api/jobs/:id/resume", async (request, reply) => {
    const ok = jobStore.resume(request.params.id);
    if (!ok) return reply.status(400).send({ error: "Job not found." });
    jobStore.emit(request.params.id, "log", { message: "Translation resumed." });
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>("/api/jobs/:id/download", async (request, reply) => {
    const job = jobStore.getJob(request.params.id);
    if (!job) return reply.status(404).send({ error: "Job not found." });

    // Safe while the job is still running: serializeSrt uses translated text when available,
    // otherwise falls back to the original cue text.
    const content = serializeSrt(job.cues);
    const filename = job.filename?.replace(/\.srt$/i, "") ?? "translated";
    reply.header("Content-Type", "text/plain; charset=utf-8");
    reply.header("Content-Disposition", `attachment; filename="${filename}.translated.srt"`);
    return content;
  });

  app.get<{ Params: { id: string } }>("/api/jobs/:id/report", async (request, reply) => {
    const report = jobStore.buildReport(request.params.id);
    if (!report) return reply.status(404).send({ error: "Job not found." });
    return report;
  });
}

async function runTranslation(jobId: string): Promise<void> {
  const job = jobStore.getJob(jobId);
  const apiKey = jobStore.getApiKey(jobId);
  if (!job || !apiKey) return;

  const provider = createProvider(job.settings.provider, apiKey, job.settings.customBaseUrl);

  await translateSrtDocument({
    cues: job.cues,
    settings: job.settings,
    provider,
    apiKey,
    controls: {
      isCancelled: () => job.cancelled,
      isPaused: () => job.paused,
      waitIfPaused: () => jobStore.waitIfPaused(jobId),
    },
    onEvent: (event) => {
      jobStore.emit(jobId, event.type as Parameters<typeof jobStore.emit>[1], event.data);
    },
  });

  if (!job.cancelled && job.status !== "failed") {
    jobStore.setStatus(jobId, "completed");
  }

  jobStore.deleteSecrets(jobId);
}
