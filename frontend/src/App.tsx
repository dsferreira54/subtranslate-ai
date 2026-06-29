import { useCallback, useEffect, useRef, useState } from "react";
import type { SubtitleCue, TranslationJobPublic, TranslationSettings } from "@subtranslate-ai/shared";
import {
  DEFAULT_TRANSLATION_SETTINGS,
  startJob,
  cancelJob,
  pauseJob,
  resumeJob,
  subscribeToJobEvents,
  fetchReport,
} from "./api/client";
import { SrtUpload } from "./components/SrtUpload";
import { LlmConfigForm } from "./components/LlmConfigForm";
import { LanguageDirectionPanel } from "./components/LanguageDirectionPanel";
import { TranslationActionBar } from "./components/TranslationActionBar";
import { LogPanel } from "./components/LogPanel";
import { CuePreview } from "./components/CuePreview";
import { TranslationDashboard, type ProgressSnapshot } from "./components/TranslationDashboard";
import { getLlmConfigFromCookie, saveLlmConfigToCookie } from "./lib/llmConfigCookies";
import { detectLanguageFromCues } from "./lib/detectLanguage";
import { isTerminalJobStatus } from "./lib/formatDuration";
import {
  notifyTranslationFinished,
  requestNotificationPermission,
} from "./lib/jobNotifications";
import "./App.css";

export default function App() {
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [filename, setFilename] = useState<string>("");
  const [settings, setSettings] = useState<TranslationSettings>(DEFAULT_TRANSLATION_SETTINGS);
  const [apiKey, setApiKey] = useState("");
  const [configLoaded, setConfigLoaded] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<TranslationJobPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressHistory, setProgressHistory] = useState<ProgressSnapshot[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
  const [sourceDetectNotice, setSourceDetectNotice] = useState<string | null>(null);
  const jobStartRef = useRef<number | null>(null);
  const elapsedCapturedRef = useRef(false);
  const notificationSentRef = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const stored = getLlmConfigFromCookie();
    if (stored) {
      setSettings(stored.settings);
      setApiKey(stored.apiKey);
    }
    setConfigLoaded(true);
  }, []);

  useEffect(() => {
    if (!configLoaded) return;
    const timer = setTimeout(() => {
      saveLlmConfigToCookie(settings, apiKey);
    }, 400);
    return () => clearTimeout(timer);
  }, [settings, apiKey, configLoaded]);

  useEffect(() => {
    return () => unsubscribeRef.current?.();
  }, []);

  const handleParsed = useCallback((parsed: SubtitleCue[], name: string) => {
    setCues(parsed);
    setFilename(name);
    setJob(null);
    setJobId(null);
    setError(null);
    setProgressHistory([]);
    setElapsedSeconds(null);
    jobStartRef.current = null;
    elapsedCapturedRef.current = false;

    setSourceDetectNotice(null);

    const detected = detectLanguageFromCues(parsed);
    if (detected) {
      setSettings((prev) => ({ ...prev, sourceLanguage: detected.code }));
      setSourceDetectNotice(
        `Detected: ${detected.label} (${detected.confidence} confidence)`,
      );
    }
  }, []);

  const handleTranslate = async () => {
    setError(null);
    void requestNotificationPermission();
    try {
      const { jobId: newJobId } = await startJob(cues, settings, apiKey, filename);
      setJobId(newJobId);
      jobStartRef.current = Date.now();
      elapsedCapturedRef.current = false;
      notificationSentRef.current = false;
      setElapsedSeconds(null);
      setProgressHistory([{ timestamp: Date.now(), translated: 0, processed: 0, total: cues.length }]);

      unsubscribeRef.current?.();
      unsubscribeRef.current = subscribeToJobEvents(newJobId, {
        onJobUpdate: (updatedJob) => {
          setJob(updatedJob);
          if (
            jobStartRef.current &&
            isTerminalJobStatus(updatedJob.status) &&
            !elapsedCapturedRef.current
          ) {
            elapsedCapturedRef.current = true;
            const elapsed = Math.round((Date.now() - jobStartRef.current) / 1000);
            setElapsedSeconds(elapsed);
            if (!notificationSentRef.current) {
              notificationSentRef.current = true;
              notifyTranslationFinished(updatedJob, filename, elapsed);
            }
          }
          setProgressHistory((prev) => {
            const { translated, failed, needsReview, total } = updatedJob.progress;
            const processed = translated + failed + needsReview;
            const last = prev[prev.length - 1];
            if (last && last.processed === processed && last.total === total) {
              return prev;
            }
            return [...prev, { timestamp: Date.now(), translated, processed, total }].slice(-120);
          });
        },
        onEvent: (event) => {
          if (event.type === "error") {
            setError(String(event.data.message ?? "Translation error"));
          }
        },
        onError: (err) => setError(err.message),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start translation.");
    }
  };

  const handleExportReport = async () => {
    if (!jobId) return;
    try {
      const report = await fetchReport(jobId);
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename.replace(/\.srt$/i, "")}.review-report.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export report.");
    }
  };

  const isRunning = job?.status === "running";
  const canTranslate = cues.length > 0 && apiKey.trim().length > 0 && settings.model.trim().length > 0;
  const hasReviewItems = (job?.progress.needsReview ?? 0) > 0 || (job?.progress.failed ?? 0) > 0;
  const displayCues = job?.cues ?? cues;
  const displayLogs = job?.logs ?? [];

  return (
    <div className="app">
      <header>
        <h1>SubTranslate AI</h1>
        <p>LLM-powered subtitle translation — cue by cue with context awareness</p>
      </header>

      {error && <div className="banner error">{error}</div>}

      <main>
        <LlmConfigForm
          settings={settings}
          onChange={setSettings}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
          configLoaded={configLoaded}
          disabled={isRunning}
        />
        <SrtUpload
          onParsed={handleParsed}
          disabled={isRunning}
          filename={filename || undefined}
          cueCount={cues.length}
        />
        <LanguageDirectionPanel
          sourceLanguage={settings.sourceLanguage}
          targetLanguage={settings.targetLanguage}
          cues={cues}
          detectNotice={sourceDetectNotice}
          onDetectNoticeClear={() => setSourceDetectNotice(null)}
          disabled={isRunning}
          onSourceChange={(code) => setSettings((prev) => ({ ...prev, sourceLanguage: code }))}
          onTargetChange={(code) => setSettings((prev) => ({ ...prev, targetLanguage: code }))}
        />
        <TranslationActionBar
          cueCount={cues.length}
          jobId={jobId}
          job={job}
          canTranslate={canTranslate}
          hasReviewItems={hasReviewItems}
          elapsedSeconds={elapsedSeconds}
          onTranslate={handleTranslate}
          onCancel={() => jobId && cancelJob(jobId)}
          onPause={() => jobId && pauseJob(jobId)}
          onResume={() => jobId && resumeJob(jobId)}
          onExportReport={handleExportReport}
        />

        {displayCues.length > 0 && (
          <TranslationDashboard
            cues={displayCues}
            job={job}
            progressHistory={progressHistory}
            elapsedSeconds={elapsedSeconds}
          />
        )}

        <LogPanel logs={displayLogs} />
        <CuePreview cues={displayCues} />
      </main>
    </div>
  );
}
