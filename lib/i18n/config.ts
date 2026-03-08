export const LANGUAGE_STORAGE_KEY = "wealthTracker_language";

export const SUPPORTED_LANGUAGES = ["cz", "en"] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = "cz";

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  cz: "CZ",
  en: "EN",
};

export const LANGUAGE_FLAGS: Record<AppLanguage, string> = {
  cz: "🇨🇿",
  en: "🇬🇧",
};

export const INTL_LOCALES: Record<AppLanguage, string> = {
  cz: "cs-CZ",
  en: "en-US",
};
