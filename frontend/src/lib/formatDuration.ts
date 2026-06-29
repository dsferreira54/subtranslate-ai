export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (m === 0 && rem === 0) return `${h}h`;
  if (rem === 0) return `${h}h ${m}m`;
  return `${h}h ${m}m ${rem}s`;
}

export function isTerminalJobStatus(status: string | undefined): boolean {
  return status === "completed" || status === "cancelled" || status === "failed";
}
