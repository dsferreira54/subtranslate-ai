import { useCallback, useRef, useState } from "react";
import { parseSrt } from "../api/client";
import type { SubtitleCue } from "@subtranslate-ai/shared";

interface SrtUploadProps {
  onParsed: (cues: SubtitleCue[], filename: string) => void;
  disabled?: boolean;
  filename?: string;
  cueCount?: number;
}

export function SrtUpload({ onParsed, disabled, filename, cueCount = 0 }: SrtUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".srt")) {
        setError("Only .srt files are accepted.");
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const result = await parseSrt(file);
        onParsed(result.cues, result.filename);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse file.");
      } finally {
        setLoading(false);
      }
    },
    [onParsed],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const hasFile = !!filename;

  return (
    <section className="card srt-upload">
      <h2>Upload SRT File</h2>
      <div
        className={`dropzone${hasFile ? " has-file" : ""}${dragOver ? " drag-over" : ""}${disabled ? " disabled" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".srt"
          hidden
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {loading ? (
          <p className="dropzone-message">Parsing file...</p>
        ) : hasFile ? (
          <div className="dropzone-file-row">
            <span className="upload-file-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </span>
            <div className="dropzone-file-text">
              <span className="upload-file-name">{filename}</span>
              {cueCount > 0 && (
                <span className="upload-file-meta">{cueCount} cues</span>
              )}
            </div>
            <span className="dropzone-replace-hint">Click or drop to replace</span>
          </div>
        ) : (
          <p className="dropzone-message">
            Drop an <strong>.srt</strong> file here or click to browse
          </p>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
