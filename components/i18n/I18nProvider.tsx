"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import czMessages from "@/messages/cz.json";
import enMessages from "@/messages/en.json";
import {
  DEFAULT_LANGUAGE,
  type AppLanguage,
  INTL_LOCALES,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
} from "@/lib/i18n/config";

type TranslationValue = string | TranslationTree;

interface TranslationTree {
  [key: string]: TranslationValue;
}

const MESSAGES: Record<AppLanguage, TranslationTree> = {
  cz: czMessages,
  en: enMessages,
};

interface I18nContextValue {
  language: AppLanguage;
  localeTag: string;
  setLanguage: (language: AppLanguage) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

function isSupportedLanguage(value: string | null): value is AppLanguage {
  return value !== null && SUPPORTED_LANGUAGES.includes(value as AppLanguage);
}

function resolveMessage(messages: TranslationTree, key: string): string | null {
  const parts = key.split(".");
  let current: TranslationValue | undefined = messages;

  for (const part of parts) {
    if (!current || typeof current === "string") return null;
    current = current[part];
  }

  return typeof current === "string" ? current : null;
}

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;

  return template.replace(/\{(\w+)\}/g, (_, token: string) =>
    vars[token] !== undefined ? String(vars[token]) : `{${token}}`,
  );
}

const defaultContextValue: I18nContextValue = {
  language: DEFAULT_LANGUAGE,
  localeTag: INTL_LOCALES[DEFAULT_LANGUAGE],
  setLanguage: () => {},
  t: (key, vars) => {
    const resolved =
      resolveMessage(MESSAGES[DEFAULT_LANGUAGE], key) ??
      key;
    return interpolate(resolved, vars);
  },
};

const I18nContext = createContext<I18nContextValue>(defaultContextValue);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    if (typeof window === "undefined") return DEFAULT_LANGUAGE;
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isSupportedLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  });

  useEffect(() => {
    document.documentElement.lang = INTL_LOCALES[language];
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const value = useMemo<I18nContextValue>(() => {
    const messages = MESSAGES[language];

    return {
      language,
      localeTag: INTL_LOCALES[language],
      setLanguage: setLanguageState,
      t: (key, vars) => {
        const resolved =
          resolveMessage(messages, key) ??
          resolveMessage(MESSAGES[DEFAULT_LANGUAGE], key) ??
          key;
        return interpolate(resolved, vars);
      },
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
