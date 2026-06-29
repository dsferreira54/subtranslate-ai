import { formatDuration } from "../lib/formatDuration";

interface DownloadBarProps {
  jobId: string | null;
  canDownload: boolean;
  onExportReport: () => void;
  hasReviewItems: boolean;
  elapsedSeconds?: number | null;
  jobStatus?: string;
}

export function DownloadBar({
  jobId,
  canDownload,
  onExportReport,
  hasReviewItems,
  elapsedSeconds,
  jobStatus,
}: DownloadBarProps) {
  if (!jobId) return null;

  const isFinished =
    jobStatus === "completed" || jobStatus === "cancelled" || jobStatus === "failed";

  return (
    <section className="card download-bar">
      {isFinished && elapsedSeconds != null && (
        <div className="completion-banner">
          <span className="completion-banner-label">
            {jobStatus === "completed" ? "Translation complete" : "Translation ended"}
          </span>
          <span className="completion-banner-time">
            Time spent: <strong>{formatDuration(elapsedSeconds)}</strong>
          </span>
        </div>
      )}
      <div className="controls">
        {canDownload && (
          <a
            className="btn primary"
            href={`/api/jobs/${jobId}/download`}
            download
          >
            Download Translated SRT
          </a>
        )}
        {hasReviewItems && (
          <button className="btn secondary" onClick={onExportReport}>
            Export Review Report
          </button>
        )}
      </div>
    </section>
  );
}
