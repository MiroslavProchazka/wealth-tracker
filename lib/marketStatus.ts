export interface CompactMarketStatusInput {
  loading: boolean;
  stale: boolean;
  error: string | null;
  fetchedAt: string | null;
}

type Translate = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

function formatCompactFreshness(
  timestamp: string | null,
  localeTag: string,
  t: Translate,
): string {
  if (!timestamp) return t("marketStatus.compactNever");

  const diffMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));

  if (minutes < 1) return t("marketStatus.compactJustNow");
  if (minutes < 60) return t("marketStatus.compactMinutesAgo", { count: minutes });

  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("marketStatus.compactHoursAgo", { count: hours });

  return t("marketStatus.compactUpdatedAt", {
    value: new Date(timestamp).toLocaleString(localeTag, {
      day: "numeric",
      month: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  });
}

export function formatCompactMarketStatus(
  status: CompactMarketStatusInput,
  localeTag: string,
  t: Translate,
): string {
  if (status.loading) return t("marketStatus.compactLoading");

  if (status.error) {
    return status.fetchedAt
      ? t("marketStatus.compactErrorWithTime", {
          value: formatCompactFreshness(status.fetchedAt, localeTag, t),
        })
      : t("marketStatus.compactError");
  }

  return formatCompactFreshness(status.fetchedAt, localeTag, t);
}
