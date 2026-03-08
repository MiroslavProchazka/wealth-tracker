import { describe, expect, it, vi } from "vitest";
import { formatCompactMarketStatus } from "@/lib/marketStatus";

const translations: Record<string, string> = {
  "marketStatus.compactNever": "—",
  "marketStatus.compactJustNow": "↻ teď",
  "marketStatus.compactMinutesAgo": "↻ {count} min",
  "marketStatus.compactHoursAgo": "↻ {count} h",
  "marketStatus.compactUpdatedAt": "↻ {value}",
  "marketStatus.compactLoading": "…",
  "marketStatus.compactError": "!",
  "marketStatus.compactErrorWithTime": "! {value}",
};

const t = (key: string, vars?: Record<string, string | number>) => {
  const template = translations[key] ?? key;
  if (!vars) return template;

  return Object.entries(vars).reduce(
    (result, [name, value]) => result.replace(`{${name}}`, String(value)),
    template,
  );
};

describe("formatCompactMarketStatus", () => {
  it("vrací krátký refresh text pro čerstvá data", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-08T12:00:00Z"));

    expect(
      formatCompactMarketStatus(
        {
          loading: false,
          stale: false,
          error: null,
          fetchedAt: "2026-03-08T11:56:00Z",
        },
        "cs-CZ",
        t,
      ),
    ).toBe("↻ 4 min");

    vi.useRealTimers();
  });

  it("u chyby zachová krátkou informaci o posledním úspěchu", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-08T12:00:00Z"));

    expect(
      formatCompactMarketStatus(
        {
          loading: false,
          stale: false,
          error: "network",
          fetchedAt: "2026-03-08T10:00:00Z",
        },
        "cs-CZ",
        t,
      ),
    ).toBe("! ↻ 2 h");

    vi.useRealTimers();
  });

  it("pro loading vrací jen minimalistický symbol", () => {
    expect(
      formatCompactMarketStatus(
        {
          loading: true,
          stale: false,
          error: null,
          fetchedAt: null,
        },
        "cs-CZ",
        t,
      ),
    ).toBe("…");
  });
});
