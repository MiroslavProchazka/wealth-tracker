"use client";

import { useEffect, useMemo, useState } from "react";
import * as Evolu from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useDashboardStatus } from "@/components/DashboardStatusContext";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useEvolu } from "@/lib/evolu";
import { withMarketApiHeaders } from "@/lib/marketApiKeys";
import { formatCompactMarketStatus } from "@/lib/marketStatus";

export default function SidebarStatusSync() {
  const evolu = useEvolu();
  const { localeTag, t } = useI18n();
  const { setItems: setSidebarStatusItems } = useDashboardStatus();
  const [todayKey, setTodayKey] = useState(
    new Date().toISOString().split("T")[0],
  );

  const evoluReady = useMemo(() => {
    try {
      return typeof evolu.createQuery === "function";
    } catch {
      return false;
    }
  }, [evolu]);

  const cryptoQ = useMemo(
    () =>
      evolu.createQuery((db) =>
        db
          .selectFrom("cryptoHolding")
          .select(["symbol"])
          .where("isDeleted", "is not", Evolu.sqliteTrue)
          .where("deleted", "is not", Evolu.sqliteTrue),
      ),
    [evolu],
  );

  const stockQ = useMemo(
    () =>
      evolu.createQuery((db) =>
        db
          .selectFrom("stockHolding")
          .select(["ticker"])
          .where("isDeleted", "is not", Evolu.sqliteTrue)
          .where("deleted", "is not", Evolu.sqliteTrue),
      ),
    [evolu],
  );

  const cryptos = useQuery(cryptoQ);
  const stocks = useQuery(stockQ);

  const [cryptoStatus, setCryptoStatus] = useState({
    loading: false,
    stale: false,
    error: null as string | null,
    fetchedAt: null as string | null,
  });
  const [stockStatus, setStockStatus] = useState({
    loading: false,
    stale: false,
    error: null as string | null,
    fetchedAt: null as string | null,
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      const today = new Date().toISOString().split("T")[0];
      setTodayKey((current) => (current === today ? current : today));
    }, 60_000);

    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const symbols = cryptos
      .map((item) => (item.symbol as string).toUpperCase())
      .filter(Boolean);

    if (symbols.length === 0) return;

    fetch(
      `/api/crypto/prices?symbols=${encodeURIComponent(symbols.join(","))}`,
      withMarketApiHeaders(),
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
        setCryptoStatus({
          loading: false,
          stale: Boolean(data.stale),
          error: null,
          fetchedAt: data.fetchedAt ?? null,
        });
      })
      .catch((error: Error) => {
        setCryptoStatus((current) => ({
          ...current,
          loading: false,
          error: error.message,
        }));
      });
  }, [cryptos]);

  useEffect(() => {
    const tickers = stocks
      .map((item) => (item.ticker as string).toUpperCase())
      .filter(Boolean);

    if (tickers.length === 0) return;

    fetch(
      `/api/stocks/prices?tickers=${encodeURIComponent(tickers.join(","))}`,
      withMarketApiHeaders(),
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
        setStockStatus({
          loading: false,
          stale: Boolean(data.stale),
          error: null,
          fetchedAt: data.fetchedAt ?? null,
        });
      })
      .catch((error: Error) => {
        setStockStatus((current) => ({
          ...current,
          loading: false,
          error: error.message,
        }));
      });
  }, [stocks]);

  const sidebarStatusItems = useMemo(
    () => [
      {
        label: t("common.today"),
        value: new Date(todayKey).toLocaleDateString(localeTag, {
          weekday: "long",
          day: "numeric",
          month: "long",
        }),
        tone: "ok" as const,
      },
      {
        label: t("dashboard.evoluStatus"),
        value: evoluReady ? "OK" : t("dashboard.offline"),
        tone: evoluReady ? ("ok" as const) : ("error" as const),
      },
      {
        label: t("dashboard.cryptoPrices"),
        value:
          cryptos.length > 0
            ? formatCompactMarketStatus(cryptoStatus, localeTag, t)
            : t("marketStatus.compactNever"),
        tone:
          cryptos.length === 0
            ? ("neutral" as const)
            : cryptoStatus.error
              ? ("error" as const)
              : cryptoStatus.stale
                ? ("warning" as const)
                : cryptoStatus.loading
                  ? ("loading" as const)
                  : ("ok" as const),
      },
      {
        label: t("dashboard.stockPrices"),
        value:
          stocks.length > 0
            ? formatCompactMarketStatus(stockStatus, localeTag, t)
            : t("marketStatus.compactNever"),
        tone:
          stocks.length === 0
            ? ("neutral" as const)
            : stockStatus.error
              ? ("error" as const)
              : stockStatus.stale
                ? ("warning" as const)
                : stockStatus.loading
                  ? ("loading" as const)
                  : ("ok" as const),
      },
    ],
    [cryptoStatus, cryptos.length, evoluReady, localeTag, stockStatus, stocks.length, t, todayKey],
  );

  useEffect(() => {
    setSidebarStatusItems(sidebarStatusItems);
  }, [setSidebarStatusItems, sidebarStatusItems]);

  return null;
}
