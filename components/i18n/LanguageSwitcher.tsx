"use client";

import { useI18n } from "@/components/i18n/I18nProvider";
import {
  LANGUAGE_FLAGS,
  LANGUAGE_LABELS,
  type AppLanguage,
} from "@/lib/i18n/config";

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  return (
    <div
      title={t("common.language")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        padding: "0.25rem",
        borderRadius: "999px",
        border: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      {(["cz", "en"] as AppLanguage[]).map((option) => {
        const active = option === language;

        return (
          <button
            key={option}
            onClick={() => setLanguage(option)}
            aria-label={`${t("common.language")}: ${LANGUAGE_LABELS[option]}`}
            style={{
              border: "none",
              cursor: "pointer",
              borderRadius: "999px",
              minWidth: "42px",
              padding: "0.35rem 0.55rem",
              fontSize: "1rem",
              fontWeight: 700,
              lineHeight: 1,
              background: active ? "var(--accent)" : "transparent",
              color: active ? "#fff" : "var(--text-2)",
              transition: "all 0.15s ease",
            }}
          >
            {LANGUAGE_FLAGS[option]}
          </button>
        );
      })}
    </div>
  );
}
