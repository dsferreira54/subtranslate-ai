import type { TranslationJobPublic } from "@subtranslate-ai/shared";
import { formatDuration } from "../lib/formatDuration";

interface TranslationActionBarProps {
  cueCount: number;
  jobId: string | null;
  job: TranslationJobPublic | null;
  canTranslate: boolean;
  hasReviewItems: boolean;
  elapsedSeconds?: number | null;
  onTranslate: () => void;
  onCancel: () => void;
  onPause: () => void;
  onResume: () => void;
  onExportReport: () => void;
}

type ActionStatus = "ready" | "running" | "paused" | "completed" | "cancelled" | "failed";

function getStatus(job: TranslationJobPublic | null): ActionStatus {
  switch (job?.status) {
    case "running":
      return "running";
    case "paused":
      return "paused";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "failed":
      return "failed";
    default:
      return "ready";
  }
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v14.72a1 1 0 0 0 1.5.86l11.04-7.36a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 6h12v12H6V6z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M12 4v10m0 0l3.5-3.5M12 14l-3.5-3.5M5 20h14" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M7 17h10M12 4v10m0 0l3-3m-3 3l-3-3" />
    </svg>
  );
}

export function TranslationActionBar({
  cueCount,
  jobId,
  job,
  canTranslate,
  hasReviewItems,
  elapsedSeconds,
  onTranslate,
  onCancel,
  onPause,
  onResume,
  onExportReport,
}: TranslationActionBarProps) {
  if (cueCount === 0) return null;

  const status = getStatus(job);
  const isRunning = status === "running";
  const isPaused = status === "paused";
  const isActive = isRunning || isPaused;
  const isFinished = status === "completed" || status === "cancelled" || status === "failed";

  const total = job?.progress.total ?? cueCount;
  const translated = job?.progress.translated ?? 0;
  const failed = job?.progress.failed ?? 0;
  const needsReview = job?.progress.needsReview ?? 0;
  const done = translated + failed + needsReview;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  const primaryLabel = isPaused ? "Resume" : isRunning ? "Pause" : "Start";
  const primaryIcon = isPaused || !isRunning ? <PlayIcon /> : <PauseIcon />;
  const primaryAction = isPaused ? onResume : isRunning ? onPause : onTranslate;
  const primaryDisabled = isRunning || isPaused ? false : !canTranslate;
  const downloadReady = !!jobId;

  return (
    <section className={`card translation-action-bar status-${status}`}>
      <div className="translation-action-toolbar">
        <div className="translation-action-controls" role="group" aria-label="Translation controls">
          <div className="translation-action-controls-group">
            <button
              type="button"
              className="translation-action-btn is-primary"
              onClick={primaryAction}
              disabled={primaryDisabled}
            >
              {primaryIcon}
              <span>{primaryLabel}</span>
            </button>

            {isActive && (
              <button type="button" className="translation-action-btn is-stop" onClick={onCancel}>
                <StopIcon />
                <span>Stop</span>
              </button>
            )}
          </div>

          <span className="translation-action-divider" aria-hidden="true" />

          <div className="translation-action-controls-group">
            <a
              className={`translation-action-btn is-download${downloadReady ? " is-ready" : ""}`}
            href={downloadReady ? `/api/jobs/${jobId}/download` : undefined}
            download={downloadReady || undefined}
            aria-disabled={!downloadReady}
            title="Download current progress — untranslated cues keep the original text"
            tabIndex={downloadReady ? 0 : -1}
              onClick={(e) => {
                if (!downloadReady) e.preventDefault();
              }}
            >
              <DownloadIcon />
              <span>Download</span>
            </a>

            {hasReviewItems && (
              <button type="button" className="translation-action-btn is-export" onClick={onExportReport}>
                <ExportIcon />
                <span>Report</span>
              </button>
            )}
          </div>
        </div>

        <div className="translation-action-meter">
          <div className="translation-action-meter-head">
            <div className="translation-action-meter-labels">
              <span className="meter-count">
                <strong>{translated}</strong>
                <span className="meter-sep">/</span>
                {total}
              </span>
              <span className="meter-caption">cues translated</span>
              {failed > 0 && <span className="meter-chip is-failed">{failed} failed</span>}
              {needsReview > 0 && <span className="meter-chip is-review">{needsReview} review</span>}
              {isFinished && elapsedSeconds != null && (
                <span className="meter-chip is-time">{formatDuration(elapsedSeconds)}</span>
              )}
            </div>
            <span className="translation-action-percent" aria-label={`${percent} percent complete`}>
              {percent}<span className="translation-action-percent-sign">%</span>
            </span>
          </div>

          <div
            className={`translation-action-track${isRunning ? " is-active" : ""}`}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="translation-action-track-fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}
