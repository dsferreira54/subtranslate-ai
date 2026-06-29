import { formatDuration } from "../lib/formatDuration";

interface ProgressBarProps {
  total: number;
  translated: number;
  failed: number;
  needsReview: number;
  estimatedCostUsd: number;
  promptTokens: number;
  completionTokens: number;
  elapsedSeconds?: number | null;
  jobStatus?: string;
}

export function ProgressBar({
  total,
  translated,
  failed,
  needsReview,
  estimatedCostUsd,
  promptTokens,
  completionTokens,
  elapsedSeconds,
  jobStatus,
}: ProgressBarProps) {
  const done = translated + failed + needsReview;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const isFinished =
    jobStatus === "completed" || jobStatus === "cancelled" || jobStatus === "failed";

  return (
    <section className="card">
      <h2>Progress</h2>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="progress-stats">
        <span>{translated} / {total} translated</span>
        <span>{percent}%</span>
        {failed > 0 && <span className="stat-failed">{failed} failed</span>}
        {needsReview > 0 && <span className="stat-review">{needsReview} need review</span>}
      </div>
      {isFinished && elapsedSeconds != null && (
        <p className="completion-time">
          Total time: <strong>{formatDuration(elapsedSeconds)}</strong>
        </p>
      )}
      {(promptTokens > 0 || completionTokens > 0) && (
        <p className="hint">
          Tokens: {promptTokens.toLocaleString()} prompt + {completionTokens.toLocaleString()} completion
          {estimatedCostUsd > 0 && ` · Est. cost: $${estimatedCostUsd.toFixed(4)}`}
        </p>
      )}
    </section>
  );
}
