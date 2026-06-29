interface TranslationControlsProps {
  onTranslate: () => void;
  onCancel: () => void;
  onPause: () => void;
  onResume: () => void;
  canTranslate: boolean;
  isRunning: boolean;
  isPaused: boolean;
  hasJob: boolean;
}

export function TranslationControls({
  onTranslate,
  onCancel,
  onPause,
  onResume,
  canTranslate,
  isRunning,
  isPaused,
  hasJob,
}: TranslationControlsProps) {
  return (
    <section className="card controls">
      <button
        className="btn primary"
        onClick={onTranslate}
        disabled={!canTranslate || isRunning}
      >
        Translate
      </button>

      {hasJob && isRunning && !isPaused && (
        <button className="btn secondary" onClick={onPause}>
          Pause
        </button>
      )}

      {hasJob && isPaused && (
        <button className="btn secondary" onClick={onResume}>
          Resume
        </button>
      )}

      {hasJob && (isRunning || isPaused) && (
        <button className="btn danger" onClick={onCancel}>
          Cancel
        </button>
      )}
    </section>
  );
}
