import { useMemo, useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";
import type { SubtitleCue, TranslationJobPublic } from "@subtranslate-ai/shared";
import { formatDuration } from "../lib/formatDuration";
import type { ProgressSnapshot } from "../lib/progressHistory";

export type { ProgressSnapshot };

interface TranslationDashboardProps {
  cues: SubtitleCue[];
  job: TranslationJobPublic | null;
  progressHistory: ProgressSnapshot[];
  elapsedSeconds?: number | null;
}

const STATUS_COLORS = {
  translated: "#4ade80",
  pending: "#64748b",
  inProgress: "#60a5fa",
  needs_review: "#fb923c",
  failed: "#f87171",
};

const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#1a1f2e",
  border: "1px solid #374151",
  borderRadius: "6px",
  color: "#e2e8f0",
};

function countStatuses(cues: SubtitleCue[]) {
  const counts = {
    translated: 0,
    pending: 0,
    inProgress: 0,
    needs_review: 0,
    failed: 0,
  };

  for (const cue of cues) {
    switch (cue.status) {
      case "translated":
        counts.translated++;
        break;
      case "pending":
        counts.pending++;
        break;
      case "translating":
      case "retrying":
        counts.inProgress++;
        break;
      case "needs_review":
        counts.needs_review++;
        break;
      case "failed":
        counts.failed++;
        break;
    }
  }

  return counts;
}

function formatElapsed(ts: number, start: number): string {
  const sec = Math.round((ts - start) / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function formatClockTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function FullscreenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function TranslationDashboard({ cues, job, progressHistory, elapsedSeconds }: TranslationDashboardProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const total = cues.length;
  const statusCounts = useMemo(() => countStatuses(cues), [cues]);

  const progressPieData = useMemo(() => {
    if (total === 0) return [];
    return [
      { name: "Translated", value: statusCounts.translated, color: STATUS_COLORS.translated },
      { name: "Pending", value: statusCounts.pending, color: STATUS_COLORS.pending },
      { name: "In Progress", value: statusCounts.inProgress, color: STATUS_COLORS.inProgress },
      { name: "Needs Review", value: statusCounts.needs_review, color: STATUS_COLORS.needs_review },
      { name: "Failed", value: statusCounts.failed, color: STATUS_COLORS.failed },
    ].filter((d) => d.value > 0);
  }, [statusCounts, total]);

  const translatedPercent = total > 0 ? Math.round((statusCounts.translated / total) * 100) : 0;
  const completedPercent =
    total > 0
      ? Math.round(
          ((statusCounts.translated + statusCounts.failed + statusCounts.needs_review) / total) * 100,
        )
      : 0;

  const barData = useMemo(
    () =>
      Object.entries(statusCounts).map(([status, count]) => ({
        status: status === "inProgress" ? "In Progress" : status.replace("_", " "),
        count,
        fill:
          status === "inProgress"
            ? STATUS_COLORS.inProgress
            : STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? "#94a3b8",
      })),
    [statusCounts],
  );

  const timelineData = useMemo(() => {
    if (progressHistory.length === 0) return [];
    const start = progressHistory[0].timestamp;
    return progressHistory.map((p) => ({
      time: formatElapsed(p.timestamp, start),
      translated: p.translated,
      processed: p.processed,
      percent: p.total > 0 ? Math.round((p.translated / p.total) * 100) : 0,
    }));
  }, [progressHistory]);

  const tokenData = useMemo(() => {
    if (!job) return [];
    const { promptTokens, completionTokens } = job.tokenUsage;
    if (promptTokens === 0 && completionTokens === 0) return [];
    return [
      { name: "Prompt", value: promptTokens, color: "#818cf8" },
      { name: "Completion", value: completionTokens, color: "#38bdf8" },
    ];
  }, [job]);

  const charStats = useMemo(() => {
    let original = 0;
    let translated = 0;
    for (const cue of cues) {
      original += cue.originalText.length;
      if (cue.translatedText) translated += cue.translatedText.length;
    }
    return { original, translated };
  }, [cues]);

  const timeEstimate = useMemo(() => {
    if (!job || progressHistory.length < 2) return null;

    const start = progressHistory[0].timestamp;
    const latest = progressHistory[progressHistory.length - 1].timestamp;
    const elapsedSec = (latest - start) / 1000;

    const { translated, failed, needsReview, total } = job.progress;
    const processed = translated + failed + needsReview;
    const remaining = total - processed;

    if (processed <= 0 || remaining <= 0 || elapsedSec <= 0) return null;

    const avgSecPerCue = elapsedSec / processed;
    const etaSec = remaining * avgSecPerCue;
    const totalEstSec = elapsedSec + etaSec;
    const completionAt = new Date(Date.now() + etaSec * 1000);

    return {
      elapsedSec,
      etaSec,
      totalEstSec,
      avgSecPerCue,
      processed,
      remaining,
      completionAt,
    };
  }, [job, progressHistory]);

  const timeBarData = useMemo(() => {
    if (!timeEstimate) return [];
    return [
      { name: "Elapsed", seconds: timeEstimate.elapsedSec, fill: "#4ade80" },
      { name: "Est. remaining", seconds: timeEstimate.etaSec, fill: "#374151" },
    ];
  }, [timeEstimate]);

  const estimatedCostUsd = job?.tokenUsage.estimatedCostUsd ?? 0;

  const totalTimeDisplay = useMemo(() => {
    if (elapsedSeconds != null) return formatDuration(elapsedSeconds);
    if (progressHistory.length >= 2) {
      const start = progressHistory[0].timestamp;
      const latest = progressHistory[progressHistory.length - 1].timestamp;
      return formatDuration(Math.round((latest - start) / 1000));
    }
    return "—";
  }, [elapsedSeconds, progressHistory]);

  useEffect(() => {
    if (!isFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isFullscreen]);

  if (total === 0) return null;

  const renderPieLabel = ({
    name,
    percent,
  }: {
    name?: string;
    percent?: number;
  }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`;

  const renderSummary = (showAll: boolean) => {
    if (!showAll) {
      return (
        <div className="dashboard-summary">
          <div className="stat-card highlight">
            <span className="stat-value">{translatedPercent}%</span>
            <span className="stat-label">Translated</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{completedPercent}%</span>
            <span className="stat-label">Processed</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{statusCounts.translated}/{total}</span>
            <span className="stat-label">Cues done</span>
          </div>
          <div className="stat-card highlight">
            <span className="stat-value">{totalTimeDisplay}</span>
            <span className="stat-label">Total time</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">${estimatedCostUsd.toFixed(4)}</span>
            <span className="stat-label">Est. cost</span>
          </div>
        </div>
      );
    }

    return (
      <div className="dashboard-summary">
        <div className="stat-card highlight">
          <span className="stat-value">{translatedPercent}%</span>
          <span className="stat-label">Translated</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{completedPercent}%</span>
          <span className="stat-label">Processed</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{statusCounts.translated}/{total}</span>
          <span className="stat-label">Cues done</span>
        </div>
        {timeEstimate && job?.status === "running" && (
          <>
            <div className="stat-card eta">
              <span className="stat-value">{formatDuration(timeEstimate.etaSec)}</span>
              <span className="stat-label">Est. remaining</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{formatDuration(timeEstimate.avgSecPerCue)}</span>
              <span className="stat-label">Avg per cue</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{formatClockTime(timeEstimate.completionAt)}</span>
              <span className="stat-label">Est. completion</span>
            </div>
          </>
        )}
        <div className="stat-card highlight">
          <span className="stat-value">{totalTimeDisplay}</span>
          <span className="stat-label">Total time</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">${estimatedCostUsd.toFixed(4)}</span>
          <span className="stat-label">Est. cost</span>
        </div>
      </div>
    );
  };

  const renderProgressChart = () => (
    <div className="chart-card">
      <h3>Progress Breakdown</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={progressPieData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={95}
            paddingAngle={2}
            dataKey="value"
            label={renderPieLabel}
            labelLine={{ stroke: "#64748b" }}
          >
            {progressPieData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} stroke="#1a1f2e" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value, name) => {
              const n = Number(value ?? 0);
              return [`${n} cues (${total > 0 ? Math.round((n / total) * 100) : 0}%)`, String(name ?? "")];
            }}
          />
          <Legend wrapperStyle={{ color: "#94a3b8", fontSize: "0.8rem" }} />
        </PieChart>
      </ResponsiveContainer>
      <p className="chart-center-label">{translatedPercent}% translated</p>
    </div>
  );

  const renderStatusChart = () => (
    <div className="chart-card">
      <h3>Status by Count</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={barData} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis type="number" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="status"
            stroke="#64748b"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            width={90}
          />
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {barData.map((entry) => (
              <Cell key={entry.status} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const renderTimeEstimateChart = () =>
    timeEstimate && timeBarData.length > 0 && job?.status === "running" ? (
      <div className="chart-card chart-wide">
        <h3>Time Estimate</h3>
        <p className="hint chart-subtitle">
          {timeEstimate.remaining} cues remaining · avg {formatDuration(timeEstimate.avgSecPerCue)}/cue
        </p>
        <div className="time-estimate-bar">
          <div
            className="time-estimate-elapsed"
            style={{
              width: `${Math.min(100, (timeEstimate.elapsedSec / timeEstimate.totalEstSec) * 100)}%`,
            }}
            title={`Elapsed: ${formatDuration(timeEstimate.elapsedSec)}`}
          />
          <div
            className="time-estimate-remaining"
            style={{
              width: `${Math.min(100, (timeEstimate.etaSec / timeEstimate.totalEstSec) * 100)}%`,
            }}
            title={`Est. remaining: ${formatDuration(timeEstimate.etaSec)}`}
          />
        </div>
        <div className="time-estimate-labels">
          <span>Elapsed: {formatDuration(timeEstimate.elapsedSec)}</span>
          <span>Remaining: {formatDuration(timeEstimate.etaSec)}</span>
          <span>Total est.: {formatDuration(timeEstimate.totalEstSec)}</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={timeBarData} layout="vertical" margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              type="number"
              stroke="#64748b"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              tickFormatter={(v) => formatDuration(Number(v))}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#64748b"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              width={110}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value) => formatDuration(Number(value ?? 0))}
            />
            <Bar dataKey="seconds" radius={[0, 4, 4, 0]}>
              {timeBarData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    ) : null;

  const renderSpeedChart = () =>
    timelineData.length > 1 ? (
      <div className="chart-card chart-wide">
        <h3>Translation Speed</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={timelineData} margin={{ left: 0, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="time" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis
              yAxisId="left"
              stroke="#64748b"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              allowDecimals={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#64748b"
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              unit="%"
              domain={[0, 100]}
            />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ color: "#94a3b8", fontSize: "0.8rem" }} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="translated"
              name="Cues translated"
              stroke="#4ade80"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="percent"
              name="Translated %"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={false}
              strokeDasharray="4 4"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    ) : null;

  const renderTokenChart = () =>
    tokenData.length > 0 ? (
      <div className="chart-card">
        <h3>Token Usage</h3>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={tokenData}
              cx="50%"
              cy="50%"
              outerRadius={85}
              dataKey="value"
              label={({ name, value }) => `${name}: ${value.toLocaleString()}`}
            >
              {tokenData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} stroke="#1a1f2e" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value) => Number(value ?? 0).toLocaleString()}
            />
            <Legend wrapperStyle={{ color: "#94a3b8", fontSize: "0.8rem" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    ) : null;

  const renderCharChart = () =>
    charStats.original > 0 || charStats.translated > 0 ? (
      <div className="chart-card">
        <h3>Character Volume</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={[
              { name: "Original", chars: charStats.original, fill: "#94a3b8" },
              { name: "Translated", chars: charStats.translated, fill: "#4ade80" },
            ]}
            margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value) => Number(value ?? 0).toLocaleString()}
            />
            <Bar dataKey="chars" radius={[4, 4, 0, 0]}>
              {[{ fill: "#94a3b8" }, { fill: "#4ade80" }].map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    ) : null;

  const renderCharts = (showAll: boolean) => (
    <div className="charts-grid">
      {renderProgressChart()}
      {showAll && renderStatusChart()}
      {showAll && renderTimeEstimateChart()}
      {showAll && renderSpeedChart()}
      {showAll && renderTokenChart()}
      {showAll && renderCharChart()}
    </div>
  );

  const renderDashboardContent = (showAll: boolean) => (
    <>
      {renderSummary(showAll)}
      {renderCharts(showAll)}
    </>
  );

  return (
    <>
      <section className="card dashboard">
        <div className="dashboard-header">
          <h2>Translation Dashboard</h2>
          <button
            type="button"
            className="btn secondary btn-sm dashboard-fullscreen-btn"
            onClick={() => setIsFullscreen(true)}
            aria-label="View all metrics in fullscreen"
          >
            <FullscreenIcon />
            All metrics
          </button>
        </div>
        {renderDashboardContent(false)}
      </section>

      {isFullscreen && (
        <div
          className="dashboard-fullscreen"
          role="dialog"
          aria-modal="true"
          aria-label="All translation metrics"
        >
          <div className="dashboard-fullscreen-panel card dashboard">
            <div className="dashboard-header">
              <h2>All Metrics</h2>
              <button
                type="button"
                className="btn secondary btn-sm dashboard-fullscreen-btn"
                onClick={() => setIsFullscreen(false)}
                aria-label="Close fullscreen metrics"
              >
                <CloseIcon />
                Close
              </button>
            </div>
            {renderDashboardContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
