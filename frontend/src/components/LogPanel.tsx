import { useEffect, useRef } from "react";

interface LogPanelProps {
  logs: string[];
}

export function LogPanel({ logs }: LogPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || logs.length === 0) return;

    // Scroll only the log panel internally — never the whole page
    if (logs.length > prevLengthRef.current) {
      panel.scrollTop = panel.scrollHeight;
    }
    prevLengthRef.current = logs.length;
  }, [logs]);

  return (
    <section className="card">
      <h2>Logs</h2>
      <div className="log-panel" ref={panelRef}>
        {logs.length === 0 ? (
          <p className="hint">No log entries yet.</p>
        ) : (
          logs.map((line, i) => (
            <div key={i} className="log-line">{line}</div>
          ))
        )}
      </div>
    </section>
  );
}
