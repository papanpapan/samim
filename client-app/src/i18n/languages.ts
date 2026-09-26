/** Only fully translated UI languages. Incomplete packs stay out of the picker. */
export const LANGUAGES = [
  { code: 'bn', label: 'বাংলা', flag: '🇧🇩', speech: 'bn-IN' },
  { code: 'en', label: 'English', flag: '🇬🇧', speech: 'en-US' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const SUPPORTED = new Set<string>(LANGUAGES.map((l) => l.code));

export function isSupportedLanguage(code: string | null | undefined): code is LanguageCode {
  return !!code && SUPPORTED.has(code);
}

export function speechLocale(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.speech ?? 'en-US';
}
