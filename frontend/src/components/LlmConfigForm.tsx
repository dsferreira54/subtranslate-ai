import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_TRANSLATION_SETTINGS,
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
  disabled?: boolean;
}

export function LlmConfigForm({
  settings,
  onChange,
  apiKey,
  onApiKeyChange,
  disabled,
}: LlmConfigFormProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

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

  return (
    <section className="card">
      <h2>LLM Configuration</h2>
      <p className="hint config-persist-hint">Settings are saved automatically in browser cookies.</p>
      <div className="form-grid">
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
          <input
            type="password"
            value={apiKey}
            disabled={disabled}
            placeholder="sk-..."
            autoComplete="off"
            onChange={(e) => onApiKeyChange(e.target.value)}
            onBlur={() => void loadModels()}
          />
        </label>

        <label>
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
          <span className="hint">Subtitle blocks translated at the same time (1 = sequential)</span>
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
      </div>
    </section>
  );
}

export { DEFAULT_TRANSLATION_SETTINGS };
