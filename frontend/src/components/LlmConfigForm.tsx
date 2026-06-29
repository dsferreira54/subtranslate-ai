import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_TRANSLATION_SETTINGS,
  DEFAULT_SYSTEM_PROMPT_TEMPLATE,
  LLM_PROVIDERS,
  type TranslationSettings,
  type LlmProviderId,
  type ModelInfo,
} from "@subtranslate-ai/shared";
import { fetchModels } from "../api/client";

const MODELS_DEBOUNCE_MS = 600;
const MIN_API_KEY_LENGTH = 8;

interface LlmConfigFormProps {
  settings: TranslationSettings;
  onChange: (settings: TranslationSettings) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  configLoaded?: boolean;
  disabled?: boolean;
}

function isConfigComplete(settings: TranslationSettings, apiKey: string): boolean {
  return apiKey.trim().length >= MIN_API_KEY_LENGTH && settings.model.trim().length > 0;
}

function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length === 0) return "No API key";
  if (trimmed.length <= 4) return "••••";
  return `•••• ${trimmed.slice(-4)}`;
}

export function LlmConfigForm({
  settings,
  onChange,
  apiKey,
  onApiKeyChange,
  configLoaded = true,
  disabled,
}: LlmConfigFormProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [prefsInitialized, setPrefsInitialized] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const fetchIdRef = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const configured = isConfigComplete(settings, apiKey);
  const providerLabel = LLM_PROVIDERS.find((p) => p.id === settings.provider)?.label ?? settings.provider;

  useEffect(() => {
    if (!configLoaded || prefsInitialized) return;
    setExpanded(!isConfigComplete(settings, apiKey));
    setPrefsInitialized(true);
  }, [configLoaded, settings, apiKey, prefsInitialized]);

  const update = <K extends keyof TranslationSettings>(key: K, value: TranslationSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const pickDefaultModel = useCallback(
    (available: ModelInfo[], provider: LlmProviderId, current: string): string => {
      if (available.some((m) => m.id === current)) return current;
      const providerDefault = LLM_PROVIDERS.find((p) => p.id === provider)?.defaultModel;
      if (providerDefault && available.some((m) => m.id === providerDefault)) {
        return providerDefault;
      }
      return available[0]?.id ?? current;
    },
    [],
  );

  const loadModels = useCallback(async () => {
    const trimmedKey = apiKey.trim();
    if (trimmedKey.length < MIN_API_KEY_LENGTH) {
      setModels([]);
      setModelsError(null);
      return;
    }
    if (settings.provider === "custom" && !settings.customBaseUrl?.trim()) {
      setModels([]);
      setModelsError(null);
      return;
    }

    const fetchId = ++fetchIdRef.current;
    setModelsLoading(true);
    setModelsError(null);

    try {
      const result = await fetchModels(
        settings.provider,
        trimmedKey,
        settings.customBaseUrl,
      );

      if (fetchId !== fetchIdRef.current) return;

      setModels(result);
      const current = settingsRef.current;
      const nextModel = pickDefaultModel(result, current.provider, current.model);
      if (nextModel !== current.model) {
        onChange({ ...current, model: nextModel });
      }
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      setModels([]);
      setModelsError(err instanceof Error ? err.message : "Failed to load models.");
    } finally {
      if (fetchId === fetchIdRef.current) {
        setModelsLoading(false);
      }
    }
  }, [apiKey, settings.provider, settings.customBaseUrl, onChange, pickDefaultModel]);

  useEffect(() => {
    const timer = setTimeout(loadModels, MODELS_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [loadModels]);

  const handleProviderChange = (provider: LlmProviderId) => {
    const info = LLM_PROVIDERS.find((p) => p.id === provider);
    onChange({
      ...settings,
      provider,
      model: info?.defaultModel ?? settings.model,
    });
  };

  const canLoadModels =
    apiKey.trim().length >= MIN_API_KEY_LENGTH &&
    (settings.provider !== "custom" || !!settings.customBaseUrl?.trim());

  const showProminent = expanded && !configured;

  if (!configLoaded) {
    return (
      <section className="card llm-config">
        <div className="llm-config-header">
          <div className="llm-config-heading">
            <h2>LLM Configuration</h2>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`card llm-config${expanded ? " is-expanded" : " is-collapsed"}${showProminent ? " is-prominent" : ""}`}
    >
      <div className="llm-config-header">
        <div className="llm-config-heading">
          <h2>LLM Configuration</h2>
          {showProminent ? (
            <p className="llm-config-lead">Connect your provider and API key to start translating.</p>
          ) : !expanded && configured ? (
            <p className="llm-config-summary">
              <span>{providerLabel}</span>
              <span className="llm-config-summary-sep">·</span>
              <span>{settings.model}</span>
              <span className="llm-config-summary-sep">·</span>
              <span>{maskApiKey(apiKey)}</span>
            </p>
          ) : (
            <p className="hint config-persist-hint">Settings are saved automatically in browser cookies.</p>
          )}
        </div>

        {configured && (
          <button
            type="button"
            className="btn secondary btn-sm llm-config-toggle"
            disabled={disabled}
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
          >
            {expanded ? "Minimize" : "Edit"}
          </button>
        )}
      </div>

      {expanded && (
        <div className="llm-config-body">
          <div className="llm-config-essential form-grid">
            <label>
              Provider
              <select
                value={settings.provider}
                disabled={disabled}
                onChange={(e) => handleProviderChange(e.target.value as LlmProviderId)}
              >
                {LLM_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </label>

            <label>
              API Key
              <div className="api-key-row">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  disabled={disabled}
                  placeholder="sk-..."
                  autoComplete="off"
                  onChange={(e) => onApiKeyChange(e.target.value)}
                  onBlur={() => void loadModels()}
                />
                <button
                  type="button"
                  className="btn secondary btn-sm api-key-toggle"
                  disabled={disabled || apiKey.length === 0}
                  onClick={() => setShowApiKey((visible) => !visible)}
                  aria-label={showApiKey ? "Hide API key" : "Show API key"}
                  title={showApiKey ? "Hide API key" : "Show API key"}
                >
                  {showApiKey ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M3 3l18 18M10.58 10.58A2 2 0 0 0 12 15a2 2 0 0 0 1.42-3.42M9.88 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 7-.64 1.4-1.63 2.66-2.86 3.68M6.53 6.53A10.8 10.8 0 0 0 3 11c1.73 3.89 6 7 9 7 1.05 0 2.05-.22 2.98-.62" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            <label className="full-width">
              Model
              <div className="model-select-row">
                <select
                  value={settings.model}
                  disabled={disabled || modelsLoading || models.length === 0}
                  onChange={(e) => update("model", e.target.value)}
                >
                  {models.length === 0 ? (
                    <option value={settings.model}>
                      {canLoadModels
                        ? modelsLoading
                          ? "Loading models..."
                          : "No models loaded"
                        : "Enter API key to load models"}
                    </option>
                  ) : (
                    models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name && m.name !== m.id ? `${m.name} (${m.id})` : m.id}
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  className="btn secondary btn-sm"
                  disabled={disabled || modelsLoading || !canLoadModels}
                  onClick={loadModels}
                  title="Refresh model list"
                >
                  {modelsLoading ? "..." : "↻"}
                </button>
              </div>
              {modelsLoading && <span className="hint">Fetching available models...</span>}
              {modelsError && <span className="error">{modelsError}</span>}
              {!modelsLoading && models.length > 0 && (
                <span className="hint">{models.length} models available</span>
              )}
            </label>

            {settings.provider === "custom" && (
              <label className="full-width">
                Custom Base URL
                <input
                  type="url"
                  value={settings.customBaseUrl ?? ""}
                  disabled={disabled}
                  placeholder="https://api.example.com/v1"
                  onChange={(e) => update("customBaseUrl", e.target.value)}
                />
              </label>
            )}
          </div>

          <details className="llm-config-advanced">
            <summary>Advanced settings</summary>
            <div className="form-grid llm-config-advanced-grid">
              <label>
                Context Window Size
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={settings.contextWindowSize}
                  disabled={disabled}
                  onChange={(e) => update("contextWindowSize", Number(e.target.value))}
                />
              </label>

              <label>
                Temperature
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={settings.temperature}
                  disabled={disabled}
                  onChange={(e) => update("temperature", Number(e.target.value))}
                />
              </label>

              <label>
                Max Retries per Cue
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={settings.maxRetries}
                  disabled={disabled}
                  onChange={(e) => update("maxRetries", Number(e.target.value))}
                />
              </label>

              <label>
                Parallel Cues
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={settings.parallelism ?? 1}
                  disabled={disabled}
                  onChange={(e) => update("parallelism", Number(e.target.value))}
                />
                <span className="hint">Blocks translated at the same time (1 = sequential)</span>
              </label>

              <label className="full-width">
                Glossary (optional)
                <textarea
                  rows={3}
                  value={settings.glossary ?? ""}
                  disabled={disabled}
                  placeholder="term = translation (one per line)"
                  onChange={(e) => update("glossary", e.target.value)}
                />
              </label>

              <label className="full-width">
                Style Instructions (optional)
                <textarea
                  rows={2}
                  value={settings.styleInstructions ?? ""}
                  disabled={disabled}
                  placeholder="e.g. Natural translation, avoid excessive literalness"
                  onChange={(e) => update("styleInstructions", e.target.value)}
                />
              </label>

              <div className="full-width llm-config-system-prompt">
                <div className="llm-config-system-prompt-header">
                  <span className="llm-config-system-prompt-label">System prompt</span>
                  {(settings.systemPrompt ?? DEFAULT_SYSTEM_PROMPT_TEMPLATE) !== DEFAULT_SYSTEM_PROMPT_TEMPLATE && (
                    <button
                      type="button"
                      className="btn secondary btn-sm"
                      disabled={disabled}
                      onClick={() => update("systemPrompt", DEFAULT_SYSTEM_PROMPT_TEMPLATE)}
                    >
                      Reset to default
                    </button>
                  )}
                </div>
                <textarea
                  rows={8}
                  value={settings.systemPrompt ?? DEFAULT_SYSTEM_PROMPT_TEMPLATE}
                  disabled={disabled}
                  spellCheck={false}
                  onChange={(e) => update("systemPrompt", e.target.value)}
                />
                <span className="hint">
                  Use {"{{sourceLanguage}}"} and {"{{targetLanguage}}"} placeholders for the selected languages.
                </span>
              </div>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}

export { DEFAULT_TRANSLATION_SETTINGS };
