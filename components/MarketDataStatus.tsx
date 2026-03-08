import { useI18n } from "@/components/i18n/I18nProvider";
import { formatCompactMarketStatus } from "@/lib/marketStatus";

interface MarketSourceStatus {
  label: string;
  loading: boolean;
  stale: boolean;
  error: string | null;
  fetchedAt: string | null;
}

interface MarketMetaItem {
  label: string;
  value: string;
  tone?: SourceTone;
}

type SourceTone = "ok" | "warning" | "error" | "loading" | "neutral";

function formatFreshness(
  timestamp: string | null,
  localeTag: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (!timestamp) return t("marketStatus.never");
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return t("marketStatus.justNow");
  if (minutes < 60) return t("marketStatus.minutesAgo", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("marketStatus.hoursAgo", { count: hours });
  return t("marketStatus.updatedAt", {
    value: new Date(timestamp).toLocaleString(localeTag),
  });
}

function getSourceTone(source: MarketSourceStatus): SourceTone {
  if (source.error) return "error";
  if (source.stale) return "warning";
  if (source.loading) return "loading";
  return "ok";
}

function describeSource(
  source: MarketSourceStatus,
  localeTag: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (source.loading) return t("marketStatus.refreshing");
  if (source.error) {
    return t("marketStatus.unavailable", {
      value: formatFreshness(source.fetchedAt, localeTag, t),
    });
  }
  if (source.stale) {
    return t("marketStatus.cached", {
      value: formatFreshness(source.fetchedAt, localeTag, t),
    });
  }
  return formatFreshness(source.fetchedAt, localeTag, t);
}

export default function MarketDataStatus({
  sources,
  metaItems = [],
}: {
  sources: MarketSourceStatus[];
  metaItems?: MarketMetaItem[];
}) {
  const { localeTag, t } = useI18n();
  const relevantSources = sources.filter(
    (source) => source.loading || source.error || source.fetchedAt,
  );

  if (relevantSources.length === 0 && metaItems.length === 0) return null;

  const hasError = relevantSources.some((source) => source.error);
  const hasStale = relevantSources.some((source) => source.stale);
  const isLoading = relevantSources.some((source) => source.loading);

  const summary = hasError
    ? t("marketStatus.partial")
    : hasStale
      ? t("marketStatus.showingCached")
      : isLoading
        ? t("marketStatus.refreshingMarket")
        : t("marketStatus.upToDate");

  const summaryTone: SourceTone = hasError
    ? "error"
    : hasStale
      ? "warning"
      : isLoading
        ? "loading"
        : "ok";

  const toneStyles: Record<
    SourceTone,
    { border: string; background: string; text: string; dot: string }
  > = {
    ok: {
      border: "rgba(34, 197, 94, 0.18)",
      background: "rgba(34, 197, 94, 0.08)",
      text: "#86efac",
      dot: "var(--green)",
    },
    warning: {
      border: "rgba(245, 158, 11, 0.22)",
      background: "rgba(245, 158, 11, 0.08)",
      text: "#fcd34d",
      dot: "var(--yellow)",
    },
    error: {
      border: "rgba(244, 63, 94, 0.22)",
      background: "rgba(244, 63, 94, 0.08)",
      text: "#fda4af",
      dot: "var(--red)",
    },
    loading: {
      border: "rgba(6, 182, 212, 0.2)",
      background: "rgba(6, 182, 212, 0.08)",
      text: "#67e8f9",
      dot: "var(--cyan)",
    },
    neutral: {
      border: "rgba(255, 255, 255, 0.1)",
      background: "rgba(255, 255, 255, 0.04)",
      text: "var(--muted)",
      dot: "rgba(255, 255, 255, 0.45)",
    },
  };

  return (
    <div
      style={{
        marginBottom: "0.9rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
        flexWrap: "wrap",
        padding: "0.55rem 0.75rem",
        borderRadius: "12px",
        border: "1px solid var(--card-border)",
        background: "rgba(255, 255, 255, 0.02)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.45rem",
          fontSize: "0.78rem",
          fontWeight: 600,
          color: "var(--muted)",
          whiteSpace: "nowrap",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: "0.45rem",
            height: "0.45rem",
            borderRadius: "999px",
            background: toneStyles[summaryTone].dot,
            boxShadow: `0 0 0 4px ${toneStyles[summaryTone].background}`,
            flexShrink: 0,
          }}
        />
        <span style={{ color: "var(--foreground)" }}>{summary}</span>
        {isLoading && !hasError && (
          <span style={{ color: "var(--muted)", fontWeight: 500 }}>
            {t("marketStatus.loadingNewPrices")}
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "flex-end",
          gap: "0.45rem",
          fontSize: "0.72rem",
        }}
      >
        {metaItems.map((item) => {
          const tone = item.tone ?? "neutral";

          return (
            <div
              key={item.label}
              title={`${item.label}: ${item.value}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.28rem 0.55rem",
                borderRadius: "999px",
                border: `1px solid ${toneStyles[tone].border}`,
                background: toneStyles[tone].background,
                color: toneStyles[tone].text,
                lineHeight: 1.2,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: "0.36rem",
                  height: "0.36rem",
                  borderRadius: "999px",
                  background: toneStyles[tone].dot,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "var(--foreground)" }}>{item.label}</span>
              <span style={{ color: "inherit" }}>{item.value}</span>
            </div>
          );
        })}
        {relevantSources.map((source) => {
          const tone = getSourceTone(source);
          const title = source.error
            ? `${source.label}: ${source.error}. ${formatFreshness(source.fetchedAt, localeTag, t)}`
            : `${source.label}: ${describeSource(source, localeTag, t)}`;

          return (
            <div
              key={source.label}
              title={title}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.28rem 0.55rem",
                borderRadius: "999px",
                border: `1px solid ${toneStyles[tone].border}`,
                background: toneStyles[tone].background,
                color: toneStyles[tone].text,
                lineHeight: 1.2,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: "0.36rem",
                  height: "0.36rem",
                  borderRadius: "999px",
                  background: toneStyles[tone].dot,
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "var(--foreground)" }}>{source.label}</span>
              <span style={{ color: "inherit" }}>
                {formatCompactMarketStatus(source, localeTag, t)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
