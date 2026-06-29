import { useCallback, useEffect, useRef, useState } from "react";
import type { SubtitleCue, TranslationJobPublic, TranslationSettings } from "@subtranslate-ai/shared";
import {
  DEFAULT_TRANSLATION_SETTINGS,
  startJob,
  cancelJob,
  pauseJob,
  resumeJob,
  fetchReport,
  getJob,
} from "./api/client";
import { SrtUpload } from "./components/SrtUpload";
import { LlmConfigForm } from "./components/LlmConfigForm";
import { LanguageDirectionPanel } from "./components/LanguageDirectionPanel";
import { TranslationActionBar } from "./components/TranslationActionBar";
import { LogPanel } from "./components/LogPanel";
import { CuePreview } from "./components/CuePreview";
import { TranslationDashboard } from "./components/TranslationDashboard";
import { getLlmConfigFromCookie, saveLlmConfigToCookie } from "./lib/llmConfigCookies";
import { detectLanguageFromCues } from "./lib/detectLanguage";
import { isTerminalJobStatus } from "./lib/formatDuration";
import {
  notifyTranslationFinished,
  requestNotificationPermission,
} from "./lib/jobNotifications";
import {
  clearActiveJobSession,
  getActiveJobSession,
  saveActiveJobSession,
} from "./lib/activeJobStorage";
import { attachJobSubscription } from "./lib/jobSubscription";
import { appendProgressSnapshot, type ProgressSnapshot } from "./lib/progressHistory";
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
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
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

  const connectToJob = useCallback((activeJobId: string, activeFilename: string) => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = attachJobSubscription(activeJobId, {
      filename: activeFilename,
      getStartedAt: () => jobStartRef.current,
      isElapsedCaptured: () => elapsedCapturedRef.current,
      markElapsedCaptured: () => {
        elapsedCapturedRef.current = true;
      },
      isNotificationSent: () => notificationSentRef.current,
      markNotificationSent: () => {
        notificationSentRef.current = true;
      },
      notifyFinished: notifyTranslationFinished,
      onJobUpdate: setJob,
      onProgressHistory: setProgressHistory,
      onError: (message) => setError(message),
      onTerminal: (_updatedJob, elapsed) => setElapsedSeconds(elapsed),
    });
  }, []);

  const restoreJobSession = useCallback(
    async (session: ReturnType<typeof getActiveJobSession>) => {
      if (!session) return;

      try {
        const restoredJob = await getJob(session.jobId);
        setJobId(session.jobId);
        setFilename(session.filename || restoredJob.filename || "");
        setCues(restoredJob.cues);
        setSettings(restoredJob.settings);
        setJob(restoredJob);
        setError(null);

        jobStartRef.current = session.startedAt;
        notificationSentRef.current = session.notificationSent;
        elapsedCapturedRef.current = session.elapsedSeconds !== null;

        const history =
          session.progressHistory.length > 0
            ? session.progressHistory
            : [appendProgressSnapshot([], restoredJob)[0]].filter(Boolean);

        const mergedHistory = appendProgressSnapshot(history, restoredJob);
        setProgressHistory(mergedHistory);

        if (session.elapsedSeconds !== null) {
          setElapsedSeconds(session.elapsedSeconds);
        } else if (isTerminalJobStatus(restoredJob.status)) {
          const elapsed = Math.round((Date.now() - session.startedAt) / 1000);
          setElapsedSeconds(elapsed);
          elapsedCapturedRef.current = true;
          if (!session.notificationSent) {
            notificationSentRef.current = true;
            notifyTranslationFinished(restoredJob, session.filename, elapsed);
          }
        }

        if (!isTerminalJobStatus(restoredJob.status)) {
          setResumeNotice("Reconnected to your translation — progress continues on the server.");
          connectToJob(session.jobId, session.filename || restoredJob.filename || "");
        } else {
          setResumeNotice("Restored your previous translation session.");
        }
      } catch {
        clearActiveJobSession();
      }
    },
    [connectToJob],
  );

  useEffect(() => {
    if (!configLoaded) return;
    const session = getActiveJobSession();
    if (!session) return;
    void restoreJobSession(session);
  }, [configLoaded, restoreJobSession]);

  useEffect(() => {
    if (!jobId) return;
    const timer = setTimeout(() => {
      saveActiveJobSession({
        jobId,
        filename,
        startedAt: jobStartRef.current ?? Date.now(),
        notificationSent: notificationSentRef.current,
        progressHistory,
        elapsedSeconds,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [jobId, filename, progressHistory, elapsedSeconds, job?.status]);

  const handleParsed = useCallback((parsed: SubtitleCue[], name: string) => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    clearActiveJobSession();

    setCues(parsed);
    setFilename(name);
    setJob(null);
    setJobId(null);
    setError(null);
    setResumeNotice(null);
    setProgressHistory([]);
    setElapsedSeconds(null);
    jobStartRef.current = null;
    elapsedCapturedRef.current = false;
    notificationSentRef.current = false;

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
    setResumeNotice(null);
    void requestNotificationPermission();
    try {
      const { jobId: newJobId } = await startJob(cues, settings, apiKey, filename);
      setJobId(newJobId);
      jobStartRef.current = Date.now();
      elapsedCapturedRef.current = false;
      notificationSentRef.current = false;
      setElapsedSeconds(null);
      setProgressHistory([{ timestamp: Date.now(), translated: 0, processed: 0, total: cues.length }]);

      saveActiveJobSession({
        jobId: newJobId,
        filename,
        startedAt: jobStartRef.current,
        notificationSent: false,
        progressHistory: [{ timestamp: Date.now(), translated: 0, processed: 0, total: cues.length }],
        elapsedSeconds: null,
      });

      connectToJob(newJobId, filename);
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
      {resumeNotice && (
        <div className="banner info">
          {resumeNotice}
          <button
            type="button"
            className="banner-dismiss"
            onClick={() => setResumeNotice(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

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
