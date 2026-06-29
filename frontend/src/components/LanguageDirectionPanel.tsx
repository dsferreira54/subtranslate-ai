import { useCallback, useEffect, useState } from "react";
import type { SubtitleCue } from "@subtranslate-ai/shared";
import { detectLanguageFromCues } from "../lib/detectLanguage";
import { LanguageSearchSelect } from "./LanguageSearchSelect";

interface LanguageDirectionPanelProps {
  sourceLanguage: string;
  targetLanguage: string;
  onSourceChange: (code: string) => void;
  onTargetChange: (code: string) => void;
  cues: SubtitleCue[];
  detectNotice?: string | null;
  onDetectNoticeClear?: () => void;
  disabled?: boolean;
}

function languageCodeBadge(code: string): string {
  return code.toUpperCase();
}

export function LanguageDirectionPanel({
  sourceLanguage,
  targetLanguage,
  onSourceChange,
  onTargetChange,
  cues,
  detectNotice,
  onDetectNoticeClear,
  disabled,
}: LanguageDirectionPanelProps) {
  const [detecting, setDetecting] = useState(false);
  const [detectMessage, setDetectMessage] = useState<string | null>(detectNotice ?? null);

  useEffect(() => {
    setDetectMessage(detectNotice ?? null);
  }, [detectNotice]);

  const swapLanguages = () => {
    onSourceChange(targetLanguage);
    onTargetChange(sourceLanguage);
  };

  const runAutoDetect = useCallback(() => {
    if (cues.length === 0) {
      setDetectMessage("Upload an SRT file first.");
      return;
    }

    setDetecting(true);
    setDetectMessage(null);

    try {
      const result = detectLanguageFromCues(cues);
      if (!result) {
        setDetectMessage("Could not detect language. Try adding more subtitle text or select manually.");
        return;
      }

      onSourceChange(result.code);
      setDetectMessage(`Detected: ${result.label} (${result.confidence} confidence)`);
    } finally {
      setDetecting(false);
    }
  }, [cues, onSourceChange]);

  return (
    <section className="card language-direction-panel">
      <div className="language-direction-header">
        <h2>Translation Direction</h2>
        <p className="hint">Choose the source and target languages for your subtitles</p>
      </div>

      <div className="language-direction-flow">
        <div className="language-direction-side source">
          <span className="language-direction-tag">From</span>
          <span className="language-direction-code">{languageCodeBadge(sourceLanguage)}</span>
          <label className="language-direction-label">
            Source Language
            <LanguageSearchSelect
              value={sourceLanguage}
              disabled={disabled}
              placeholder="Search source language..."
              onChange={(code) => {
                onSourceChange(code);
                setDetectMessage(null);
                onDetectNoticeClear?.();
              }}
            />
          </label>
          <button
            type="button"
            className="btn language-detect-btn"
            disabled={disabled || detecting || cues.length === 0}
            onClick={runAutoDetect}
          >
            {detecting ? "Detecting..." : "Auto-detect"}
          </button>
          {detectMessage && (
            <p className={`detect-message ${detectMessage.startsWith("Detected") ? "success" : ""}`}>
              {detectMessage}
            </p>
          )}
        </div>

        <div className="language-direction-center">
          <div className="language-direction-arrow" aria-hidden="true">
            <svg viewBox="0 0 64 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M4 16H48M48 16L38 8M48 16L38 24"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <button
            type="button"
            className="btn language-swap-btn"
            disabled={disabled}
            onClick={swapLanguages}
            title="Swap source and target languages"
          >
            <span className="swap-icon" aria-hidden="true">⇄</span>
            Swap
          </button>
        </div>

        <div className="language-direction-side target">
          <span className="language-direction-tag">To</span>
          <span className="language-direction-code">{languageCodeBadge(targetLanguage)}</span>
          <label className="language-direction-label">
            Target Language
            <LanguageSearchSelect
              value={targetLanguage}
              disabled={disabled}
              placeholder="Search target language..."
              onChange={onTargetChange}
            />
          </label>
        </div>
      </div>
    </section>
  );
}
