interface MarketSourceStatus {
  label: string;
  loading: boolean;
  stale: boolean;
  error: string | null;
  fetchedAt: string | null;
}

function formatFreshness(timestamp: string | null): string {
  if (!timestamp) return "No successful refresh yet";
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Updated ${hours} h ago`;
  return `Updated ${new Date(timestamp).toLocaleString("cs-CZ")}`;
}

export default function MarketDataStatus({
  sources,
}: {
  sources: MarketSourceStatus[];
}) {
  const relevantSources = sources.filter(
    (source) => source.loading || source.error || source.fetchedAt,
  );

  if (relevantSources.length === 0) return null;

  const hasError = relevantSources.some((source) => source.error);
  const hasStale = relevantSources.some((source) => source.stale);
  const isLoading = relevantSources.some((source) => source.loading);

  const accent = hasError ? "#f59e0b" : hasStale ? "#f59e0b" : "#10b981";
  const background = hasError
    ? "rgba(245,158,11,0.08)"
    : hasStale
      ? "rgba(245,158,11,0.06)"
      : "rgba(16,185,129,0.06)";

  return (
    <div
      style={{
        marginBottom: "1rem",
        padding: "0.85rem 1rem",
        borderRadius: "10px",
        border: `1px solid ${accent}33`,
        background,
      }}
    >
      <div style={{ fontSize: "0.82rem", fontWeight: 700, marginBottom: "0.45rem" }}>
        {hasError
          ? "Market data is partially unavailable"
          : hasStale
            ? "Showing cached market data"
            : "Market data is up to date"}
      </div>
      <div style={{ display: "grid", gap: "0.25rem", fontSize: "0.78rem", color: "var(--muted)" }}>
        {relevantSources.map((source) => (
          <div key={source.label}>
            {source.label}:{" "}
            {source.loading
              ? "Refreshing…"
              : source.error
                ? `Live fetch failed (${source.error}). ${formatFreshness(source.fetchedAt)}`
                : source.stale
                  ? `Cached data. ${formatFreshness(source.fetchedAt)}`
                  : formatFreshness(source.fetchedAt)}
          </div>
        ))}
        {isLoading && <div>New prices are still loading.</div>}
      </div>
    </div>
  );
}
