import type { TranslationJobPublic } from "@subtranslate-ai/shared";
import { formatDuration } from "./formatDuration";

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!isNotificationSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

function buildNotificationContent(
  job: TranslationJobPublic,
  filename: string,
  elapsedSeconds?: number | null,
): { title: string; body: string } {
  const name = filename || job.filename || "subtitles";
  const { translated, failed, needsReview, total } = job.progress;
  const stats = `${translated}/${total} translated`;
  const extras: string[] = [];
  if (needsReview > 0) extras.push(`${needsReview} need review`);
  if (failed > 0) extras.push(`${failed} failed`);
  const detail = extras.length > 0 ? `${stats} · ${extras.join(", ")}` : stats;
  const time =
    elapsedSeconds != null ? ` · ${formatDuration(elapsedSeconds)}` : "";

  switch (job.status) {
    case "completed":
      return {
        title: "Translation complete",
        body: `${name} — ${detail}${time}`,
      };
    case "cancelled":
      return {
        title: "Translation cancelled",
        body: `${name} — ${detail}${time}`,
      };
    case "failed":
      return {
        title: "Translation failed",
        body: `${name} — ${detail}${time}`,
      };
    default:
      return {
        title: "Translation finished",
        body: `${name} — ${detail}${time}`,
      };
  }
}

export function notifyTranslationFinished(
  job: TranslationJobPublic,
  filename: string,
  elapsedSeconds?: number | null,
): void {
  if (!isNotificationSupported() || Notification.permission !== "granted") return;

  const { title, body } = buildNotificationContent(job, filename, elapsedSeconds);

  try {
    const notification = new Notification(title, {
      body,
      tag: `subtranslate-job-${job.id}`,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Ignore if notifications are blocked or fail silently.
  }
}
