import {
  DEFAULT_TRANSLATION_SETTINGS,
  type TranslationSettings,
} from "@subtranslate-ai/shared";

const COOKIE_NAME = "subtranslate-ai-llm-config";
const COOKIE_MAX_AGE_SEC = 365 * 24 * 60 * 60; // 1 year

export interface StoredLlmConfig {
  settings: TranslationSettings;
  apiKey: string;
}

function mergeWithDefaults(settings: Partial<TranslationSettings>): TranslationSettings {
  return { ...DEFAULT_TRANSLATION_SETTINGS, ...settings };
}

function parseCookieValue(raw: string): StoredLlmConfig | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredLlmConfig>;
    if (!parsed || typeof parsed !== "object") return null;

    return {
      settings: mergeWithDefaults(parsed.settings ?? {}),
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
    };
  } catch {
    return null;
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function getLlmConfigFromCookie(): StoredLlmConfig | null {
  if (typeof document === "undefined") return null;

  const current = readCookie(COOKIE_NAME);
  if (!current) return null;

  return parseCookieValue(current);
}

export function saveLlmConfigToCookie(settings: TranslationSettings, apiKey: string): void {
  if (typeof document === "undefined") return;

  const payload: StoredLlmConfig = { settings, apiKey };
  const encoded = encodeURIComponent(JSON.stringify(payload));

  // Cookie size limit is ~4KB; truncate glossary/style if needed
  if (encoded.length > 3800) {
    const trimmed: StoredLlmConfig = {
      settings: {
        ...settings,
        glossary: settings.glossary?.slice(0, 500),
        styleInstructions: settings.styleInstructions?.slice(0, 500),
        systemPrompt: settings.systemPrompt?.slice(0, 1200),
      },
      apiKey,
    };
    document.cookie = buildCookie(encodeURIComponent(JSON.stringify(trimmed)));
    return;
  }

  document.cookie = buildCookie(encoded);
}

function buildCookie(encodedValue: string): string {
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodedValue}; Path=/; Max-Age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure}`;
}

export function clearLlmConfigCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}
