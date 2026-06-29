import ISO6391 from "iso-639-1";

export interface LanguageOption {
  code: string;
  label: string;
}

/** Common BCP-47 regional variants not covered as separate ISO 639-1 codes. */
const REGIONAL_VARIANTS: LanguageOption[] = [
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "pt-PT", label: "Portuguese (Portugal)" },
  { code: "zh-CN", label: "Chinese (Simplified)" },
  { code: "zh-TW", label: "Chinese (Traditional)" },
  { code: "zh-HK", label: "Chinese (Hong Kong)" },
  { code: "en-US", label: "English (United States)" },
  { code: "en-GB", label: "English (United Kingdom)" },
  { code: "es-419", label: "Spanish (Latin America)" },
  { code: "es-ES", label: "Spanish (Spain)" },
  { code: "fr-CA", label: "French (Canada)" },
  { code: "fr-FR", label: "French (France)" },
];

function formatLabel(code: string, name: string, nativeName: string): string {
  if (nativeName && nativeName !== name) {
    return `${name} (${nativeName}) — ${code}`;
  }
  return `${name} — ${code}`;
}

let cachedLanguages: LanguageOption[] | null = null;

export function getAllLanguages(): LanguageOption[] {
  if (cachedLanguages) return cachedLanguages;

  const isoLanguages: LanguageOption[] = ISO6391.getAllCodes().map((code) => {
    const name = ISO6391.getName(code);
    const nativeName = ISO6391.getNativeName(code);
    return {
      code,
      label: formatLabel(code, name, nativeName),
    };
  });

  const regional = REGIONAL_VARIANTS.map((v) => ({
    code: v.code,
    label: `${v.label} — ${v.code}`,
  }));

  const seen = new Set<string>();
  const merged: LanguageOption[] = [];

  for (const lang of [...regional, ...isoLanguages]) {
    if (!seen.has(lang.code)) {
      seen.add(lang.code);
      merged.push(lang);
    }
  }

  cachedLanguages = merged.sort((a, b) =>
    a.label.localeCompare(b.label, "en", { sensitivity: "base" }),
  );

  return cachedLanguages;
}

export function findLanguageLabel(code: string): string {
  return getAllLanguages().find((l) => l.code === code)?.label ?? code;
}

export function filterLanguages(query: string): LanguageOption[] {
  const all = getAllLanguages();
  const q = query.trim().toLowerCase();
  if (!q) return all;

  return all.filter(
    (l) =>
      l.label.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q),
  );
}
