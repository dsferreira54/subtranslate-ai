import type { SubtitleCue, CueStatus } from "@subtranslate-ai/shared";

interface CuePreviewProps {
  cues: SubtitleCue[];
}

const STATUS_LABELS: Record<CueStatus, string> = {
  pending: "Pending",
  translating: "Translating",
  translated: "Translated",
  retrying: "Retrying",
  failed: "Failed",
  needs_review: "Needs Review",
};

export function CuePreview({ cues }: CuePreviewProps) {
  if (cues.length === 0) return null;

  return (
    <section className="card">
      <h2>Preview ({cues.length} cues)</h2>
      <div className="cue-table-wrapper">
        <table className="cue-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Original</th>
              <th>Translated</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {cues.map((cue) => (
              <tr key={cue.id} className={`status-${cue.status}`}>
                <td>{cue.index}</td>
                <td className="text-cell">{cue.originalText}</td>
                <td className="text-cell">
                  {cue.translatedText ?? "—"}
                  {cue.error && <div className="cue-error">{cue.error}</div>}
                </td>
                <td>
                  <span className={`badge badge-${cue.status}`}>
                    {STATUS_LABELS[cue.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
