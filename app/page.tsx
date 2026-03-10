"use client";

import { useEffect, useMemo, useState } from "react";
import * as Evolu from "@evolu/common";
import { useQuery } from "@evolu/react";
import {
  NET_WORTH_SNAPSHOT_SCHEMA_VERSION,
  PORTFOLIO_NOTES_FEATURE_ENABLED_KEY,
  SNAPSHOT_AUTOMATION_SETTINGS_KEY,
  TAG_CLOUD_FEATURE_ENABLED_KEY,
  TARGET_ALLOCATION_FEATURE_ENABLED_KEY,
  useEvolu,
} from "@/lib/evolu";
import { formatCurrency } from "@/lib/currencies";
import StatCard from "@/components/StatCard";
import Modal from "@/components/Modal";
import FormField from "@/components/FormField";
import { useI18n } from "@/components/i18n/I18nProvider";
import { readMarketApiKeys, withMarketApiHeaders } from "@/lib/marketApiKeys";
import Link from "next/link";
import { seedDemoAccount } from "@/lib/demoData";
import {
  getOnboardingChoice,
  isDemoModeEnabled,
  setDemoModeEnabled,
  setOnboardingChoice,
} from "@/lib/demoMode";
import {
  ASSET_CLASSES,
  DEFAULT_ALLOCATION_TARGETS,
  DEFAULT_SNAPSHOT_AUTOMATION_SETTINGS,
  parseTags,
} from "@/lib/portfolio";
import {
  ArrowUp,
  ArrowDown,
  Landmark,
  Bitcoin,
  Home,
  TrendingUp,
} from "lucide-react";

export default function Dashboard() {
  const evolu = useEvolu();
  const { localeTag, t } = useI18n();

  const assetClassLabels: Record<string, string> = {
    Property: t("dashboard.assetClass_property"),
    Savings: t("dashboard.assetClass_savings"),
    Stocks: t("dashboard.assetClass_stocks"),
    Crypto: t("dashboard.assetClass_crypto"),
  };
  const dashboardAssetClasses = ASSET_CLASSES.filter(
    (assetClass) => assetClass !== "Receivables",
  );

  // ── Queries ────────────────────────────────────────────────────────────────
  const cryptoQ = useMemo(
    () =>
      evolu.createQuery((db) =>
        db
          .selectFrom("cryptoHolding")
          .select(["symbol", "amount", "tags"])
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
          .select(["ticker", "shares", "currency", "tags"])
          .where("isDeleted", "is not", Evolu.sqliteTrue)
          .where("deleted", "is not", Evolu.sqliteTrue),
      ),
    [evolu],
  );
  const propertyQ = useMemo(
    () =>
      evolu.createQuery((db) =>
        db
          .selectFrom("property")
          .select(["estimatedValue", "remainingLoan", "tags"])
          .where("isDeleted", "is not", Evolu.sqliteTrue)
          .where("deleted", "is not", Evolu.sqliteTrue),
      ),
    [evolu],
  );
  const savingsQ = useMemo(
    () =>
      evolu.createQuery((db) =>
        db
          .selectFrom("savingsAccount")
          .select(["balance", "tags"])
          .where("isDeleted", "is not", Evolu.sqliteTrue)
          .where("deleted", "is not", Evolu.sqliteTrue),
      ),
    [evolu],
  );
  const allocationQ = useMemo(
    () =>
      evolu.createQuery((db) =>
        db
          .selectFrom("allocationTarget")
          .selectAll()
          .where("isDeleted", "is not", Evolu.sqliteTrue)
          .where("deleted", "is not", Evolu.sqliteTrue),
      ),
    [evolu],
  );
  const noteQ = useMemo(
    () =>
      evolu.createQuery((db) =>
        db
          .selectFrom("portfolioNote")
          .selectAll()
          .where("isDeleted", "is not", Evolu.sqliteTrue)
          .where("deleted", "is not", Evolu.sqliteTrue)
          .orderBy("noteDate", "desc")
          .orderBy("createdAt", "desc")
          .limit(5),
      ),
    [evolu],
  );
  const snapshotQ = useMemo(
    () =>
      evolu.createQuery((db) =>
        db
          .selectFrom("netWorthSnapshot")
          .select(["snapshotDate", "netWorth", "schemaVersion"])
          .where("isDeleted", "is not", Evolu.sqliteTrue)
          .where("deleted", "is not", Evolu.sqliteTrue)
          .orderBy("snapshotDate", "desc")
          .limit(2),
      ),
    [evolu],
  );

  const cryptos = useQuery(cryptoQ);
  const stocks = useQuery(stockQ);
  const properties = useQuery(propertyQ);
  const savings = useQuery(savingsQ);
  const allocationTargets = useQuery(allocationQ);
  const portfolioNotes = useQuery(noteQ);
  const snapshots = useQuery(snapshotQ);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteForm, setNoteForm] = useState({
    title: "",
    body: "",
    tags: "",
  });
  const [autoSnapshotMsg, setAutoSnapshotMsg] = useState<string | null>(null);
  const [onboardingChoice, setOnboardingChoiceState] = useState<
    "demo" | "manual" | null
  >(null);
  const [startingDemo, setStartingDemo] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [onboardingMessage, setOnboardingMessage] = useState<string | null>(null);
  const [demoModeEnabled, setDemoModeEnabledState] = useState(false);
  const [targetAllocationEnabled] = useState(
    () => {
      if (typeof window === "undefined") return false;
      try {
        const stored = window.localStorage.getItem(
          TARGET_ALLOCATION_FEATURE_ENABLED_KEY,
        );
        return stored ? JSON.parse(stored) === true : false;
      } catch {
        return false;
      }
    },
  );
  const [portfolioNotesEnabled] = useState(
    () => {
      if (typeof window === "undefined") return false;
      try {
        const stored = window.localStorage.getItem(
          PORTFOLIO_NOTES_FEATURE_ENABLED_KEY,
        );
        return stored ? JSON.parse(stored) === true : false;
      } catch {
        return false;
      }
    },
  );
  const [tagCloudEnabled] = useState(
    () => {
      if (typeof window === "undefined") return false;
      try {
        const stored = window.localStorage.getItem(
          TAG_CLOUD_FEATURE_ENABLED_KEY,
        );
        return stored ? JSON.parse(stored) === true : false;
      } catch {
        return false;
      }
    },
  );
  const [todayKey, setTodayKey] = useState(
    new Date().toISOString().split("T")[0],
  );

  // ── Live prices ────────────────────────────────────────────────────────────
  const [cryptoPrices, setCryptoPrices] = useState<
    Record<string, { czk: number }>
  >({});
  const [stockPrices, setStockPrices] = useState<
    Record<string, { czk: number }>
  >({});
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
  const [hasCustomMarketKeys] = useState(() => {
    if (typeof window === "undefined") return false;
    const keys = readMarketApiKeys();
    return Boolean(keys.coingecko || keys.yahooFinance);
  });
  const [compactCurrency, setCompactCurrency] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 768px)").matches;
  });

  useEffect(() => {
    setOnboardingChoiceState(getOnboardingChoice());
    setDemoModeEnabledState(isDemoModeEnabled());
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const today = new Date().toISOString().split("T")[0];
      setTodayKey((current) => (current === today ? current : today));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const onChange = (event: MediaQueryListEvent) =>
      setCompactCurrency(event.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", onChange);
      return () => mediaQuery.removeEventListener("change", onChange);
    }

    mediaQuery.addListener(onChange);
    return () => mediaQuery.removeListener(onChange);
  }, []);

  useEffect(() => {
    const symbols = cryptos
      .map((c) => (c.symbol as string).toUpperCase())
      .filter(Boolean);
    if (symbols.length === 0) return;
    fetch(
      `/api/crypto/prices?symbols=${encodeURIComponent(symbols.join(","))}`,
      withMarketApiHeaders(),
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
        if (d.prices) setCryptoPrices(d.prices);
        setCryptoStatus({
          loading: false,
          stale: Boolean(d.stale),
          error: null,
          fetchedAt: d.fetchedAt ?? null,
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
      .map((s) => (s.ticker as string).toUpperCase())
      .filter(Boolean);
    if (tickers.length === 0) return;
    fetch(
      `/api/stocks/prices?tickers=${encodeURIComponent(tickers.join(","))}`,
      withMarketApiHeaders(),
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
        if (d.prices) setStockPrices(d.prices);
        setStockStatus({
          loading: false,
          stale: Boolean(d.stale),
          error: null,
          fetchedAt: d.fetchedAt ?? null,
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

  // ── Computed values ────────────────────────────────────────────────────────
  const cryptoValue = cryptos.reduce((s, c) => {
    const symbol = (c.symbol as string).toUpperCase();
    const price = cryptoPrices[symbol]?.czk ?? 0;
    return s + (c.amount as number) * price;
  }, 0);

  const stocksValue = stocks.reduce((s, st) => {
    const ticker = (st.ticker as string).toUpperCase();
    const price = stockPrices[ticker]?.czk ?? 0;
    return s + (st.shares as number) * price;
  }, 0);

  const propertyValue = properties.reduce(
    (s, p) => s + (p.estimatedValue as number),
    0,
  );
  const mortgageDebt = properties.reduce(
    (s, p) => s + ((p.remainingLoan as number) ?? 0),
    0,
  );
  const savingsValue = savings.reduce((s, sv) => s + (sv.balance as number), 0);

  const totalAssets = cryptoValue + stocksValue + propertyValue + savingsValue;
  const totalLiabilities = mortgageDebt;
  const netWorth = totalAssets - totalLiabilities;
  const prevSnapshot = snapshots[1];
  const currentSnapshot = snapshots[0];
  const comparableSnapshots =
    currentSnapshot &&
    prevSnapshot &&
    (currentSnapshot.schemaVersion as number | null) ===
      NET_WORTH_SNAPSHOT_SCHEMA_VERSION &&
    (prevSnapshot.schemaVersion as number | null) ===
      NET_WORTH_SNAPSHOT_SCHEMA_VERSION;
  const change = comparableSnapshots
    ? netWorth - (prevSnapshot.netWorth as number)
    : 0;

  const allocationItems = [
    {
      label: "Property",
      value: propertyValue,
      color: "#8b5cf6",
      href: "/property",
    },
    {
      label: "Savings",
      value: savingsValue,
      color: "#10b981",
      href: "/savings",
    },
    { label: "Stocks", value: stocksValue, color: "#f59e0b", href: "/stocks" },
    { label: "Crypto", value: cryptoValue, color: "#f97316", href: "/crypto" },
  ].filter((i) => i.value > 0);
  const secondaryStatCards = [
    {
      key: "Savings",
      label: t("dashboard.savings"),
      value: savingsValue,
      sub: undefined as string | undefined,
      accent: "var(--green)",
      icon: <Landmark size={16} />,
      href: "/savings",
    },
    {
      key: "Property",
      label: t("dashboard.property"),
      value: propertyValue,
      sub: t("dashboard.propertiesCount", { count: properties.length }),
      accent: "#8b5cf6",
      icon: <Home size={16} />,
      href: "/property",
    },
    {
      key: "Stocks",
      label: t("dashboard.assetClass_stocks"),
      value: stocksValue,
      sub: t("dashboard.assetsCount", { count: stocks.length }),
      accent: "#f59e0b",
      icon: <TrendingUp size={16} />,
      href: "/stocks",
    },
    {
      key: "Crypto",
      label: t("dashboard.crypto"),
      value: cryptoValue,
      sub: t("dashboard.assetsCount", { count: cryptos.length }),
      accent: "#f97316",
      icon: <Bitcoin size={16} />,
      href: "/crypto",
    },
  ].sort((a, b) => b.value - a.value);
  const total = allocationItems.reduce((s, i) => s + i.value, 0) || 1;
  const targetMap = ASSET_CLASSES.reduce<
    Record<(typeof ASSET_CLASSES)[number], number>
  >(
    (acc, assetClass) => {
      const existing = allocationTargets.find(
        (row) => String(row.assetClass) === assetClass,
      );
      acc[assetClass] =
        typeof existing?.targetPercent === "number"
          ? (existing.targetPercent as number)
          : DEFAULT_ALLOCATION_TARGETS[assetClass];
      return acc;
    },
    { ...DEFAULT_ALLOCATION_TARGETS },
  );
  const actualMap = {
    Property: propertyValue,
    Savings: savingsValue,
    Stocks: stocksValue,
    Crypto: cryptoValue,
    Receivables: 0,
  };
  const allocationComparison = dashboardAssetClasses.map((assetClass) => {
    const actualPercent =
      totalAssets > 0 ? (actualMap[assetClass] / totalAssets) * 100 : 0;
    const targetPercent = targetMap[assetClass];
    return {
      assetClass,
      actualPercent,
      targetPercent,
      diffPercent: actualPercent - targetPercent,
      actualValue: actualMap[assetClass],
    };
  });
  const allTags = [
    ...cryptos.flatMap((row) =>
      parseTags((row as { tags?: string | null }).tags ?? null),
    ),
    ...stocks.flatMap((row) =>
      parseTags((row as { tags?: string | null }).tags ?? null),
    ),
    ...properties.flatMap((row) =>
      parseTags((row as { tags?: string | null }).tags ?? null),
    ),
    ...savings.flatMap((row) =>
      parseTags((row as { tags?: string | null }).tags ?? null),
    ),
    ...portfolioNotes.flatMap((row) =>
      parseTags((row.tags as string | null) ?? null),
    ),
  ];
  const tagCloud = [...new Set(allTags)].slice(0, 20);
  const pricingReady =
    (cryptos.length === 0 ||
      cryptoStatus.fetchedAt !== null ||
      cryptoStatus.error !== null) &&
    (stocks.length === 0 ||
      stockStatus.fetchedAt !== null ||
      stockStatus.error !== null);
  const hasMarketTrackedAssets = cryptos.length > 0 || stocks.length > 0;
  const hasMarketFetchIssues =
    (cryptos.length > 0 &&
      (cryptoStatus.error !== null || cryptoStatus.fetchedAt === null)) ||
    (stocks.length > 0 &&
      (stockStatus.error !== null || stockStatus.fetchedAt === null));
  const marketDataNeedsSetup =
    hasMarketFetchIssues || (!hasMarketTrackedAssets && !hasCustomMarketKeys);
  const hasAnyPortfolioData =
    cryptos.length > 0 ||
    stocks.length > 0 ||
    properties.length > 0 ||
    savings.length > 0 ||
    snapshots.length > 0;
  const showOnboardingChoice = !hasAnyPortfolioData && onboardingChoice === null;

  useEffect(() => {
    if (!pricingReady) return;
    if (totalAssets <= 0 && totalLiabilities <= 0) return;

    let automation = DEFAULT_SNAPSHOT_AUTOMATION_SETTINGS;
    try {
      const stored = localStorage.getItem(SNAPSHOT_AUTOMATION_SETTINGS_KEY);
      if (stored) automation = { ...automation, ...JSON.parse(stored) };
    } catch {
      automation = DEFAULT_SNAPSHOT_AUTOMATION_SETTINGS;
    }

    if (!automation.dailyOnOpen) return;
    const alreadyToday =
      currentSnapshot && String(currentSnapshot.snapshotDate) === todayKey;
    if (alreadyToday) return;

    evolu.insert("netWorthSnapshot", {
      snapshotDate: todayKey,
      totalAssets,
      totalLiabilities,
      netWorth,
      cryptoValue,
      stocksValue,
      propertyValue,
      savingsValue,
      receivablesValue: 0,
      schemaVersion: NET_WORTH_SNAPSHOT_SCHEMA_VERSION as never,
      deleted: Evolu.sqliteFalse,
    } as never);
    const showTimeout = window.setTimeout(() => {
      setAutoSnapshotMsg(t("dashboard.automaticSnapshot", { date: todayKey }));
    }, 0);
    const clearTimeoutId = window.setTimeout(
      () => setAutoSnapshotMsg(null),
      5000,
    );
    return () => {
      window.clearTimeout(showTimeout);
      window.clearTimeout(clearTimeoutId);
    };
  }, [
    cryptoValue,
    currentSnapshot,
    evolu,
    netWorth,
    pricingReady,
    propertyValue,
    savingsValue,
    stocksValue,
    t,
    todayKey,
    totalAssets,
    totalLiabilities,
  ]);

  function resetNoteForm() {
    setEditingNoteId(null);
    setNoteError(null);
    setNoteForm({ title: "", body: "", tags: "" });
  }

  function handleSaveNote(e: React.FormEvent) {
    e.preventDefault();
    const fields = {
      noteDate: new Date().toISOString().split("T")[0],
      title: noteForm.title.trim(),
      body: noteForm.body.trim(),
      tags: noteForm.tags.trim() || null,
    };
    if (editingNoteId) {
      evolu.update("portfolioNote", {
        id: editingNoteId as never,
        ...fields,
      } as never);
    } else {
      const result = evolu.insert("portfolioNote", {
        ...fields,
        deleted: Evolu.sqliteFalse,
      } as never);
      if (!result.ok) {
        setNoteError(t("dashboard.noteSaveError"));
        return;
      }
    }
    resetNoteForm();
    setShowNoteModal(false);
  }

  function handleStartEditNote(note: {
    id: unknown;
    title: unknown;
    body: unknown;
    tags: unknown;
  }) {
    setEditingNoteId(note.id as string);
    setNoteForm({
      title: (note.title as string) ?? "",
      body: (note.body as string) ?? "",
      tags: (note.tags as string) ?? "",
    });
    setShowNoteModal(true);
  }

  function handleDeleteNote(id: string) {
    evolu.update("portfolioNote", {
      id: id as never,
      deleted: Evolu.sqliteTrue,
    } as never);
  }

  function handleStartManualMode() {
    setOnboardingChoice("manual");
    setDemoModeEnabled(false);
    setOnboardingChoiceState("manual");
    setDemoModeEnabledState(false);
    setOnboardingMessage(t("dashboard.manualAccountReady"));
  }

  function handleStartDemoMode() {
    setStartingDemo(true);
    setOnboardingError(null);
    try {
      if (hasAnyPortfolioData) {
        setOnboardingChoiceState(getOnboardingChoice());
        setOnboardingError(t("dashboard.demoAccountBlocked"));
        return;
      }
      seedDemoAccount(evolu);
      setDemoModeEnabled(true);
      setOnboardingChoice("demo");
      setOnboardingChoiceState("demo");
      setDemoModeEnabledState(true);
      setOnboardingMessage(t("dashboard.demoAccountReady"));
    } catch {
      setOnboardingError(t("dashboard.demoAccountError"));
    } finally {
      setStartingDemo(false);
    }
  }

  return (
    <div>
      {autoSnapshotMsg && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            border: "1px solid rgba(59,130,246,0.25)",
            background: "rgba(59,130,246,0.08)",
            color: "var(--muted)",
            fontSize: "0.8rem",
          }}
        >
          {autoSnapshotMsg}
        </div>
      )}
      <div style={{ marginBottom: "2rem" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "1.75rem",
            fontWeight: 700,
            letterSpacing: "-0.025em",
          }}
        >
          {t("sidebar.dashboard")}
        </h1>
      </div>
      {showOnboardingChoice && (
        <div
          className="card"
          style={{
            marginBottom: "1.25rem",
            borderColor: "rgba(59,130,246,0.32)",
            background:
              "linear-gradient(135deg, rgba(59,130,246,0.13) 0%, rgba(16,185,129,0.1) 100%)",
          }}
        >
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: "1rem", fontWeight: 700 }}>
              {t("dashboard.onboardingTitle")}
            </div>
            <div style={{ fontSize: "0.83rem", color: "var(--muted)", marginTop: "0.35rem" }}>
              {t("dashboard.onboardingSubtitle")}
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "0.8rem",
            }}
          >
            <div
              style={{
                border: "1px solid rgba(34,197,94,0.28)",
                borderRadius: "10px",
                padding: "0.85rem",
                background: "rgba(16,185,129,0.08)",
              }}
            >
              <div style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem" }}>
                {t("dashboard.onboardingDemoTitle")}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "0.8rem" }}>
                {t("dashboard.onboardingDemoBody")}
              </div>
              <button
                className="btn-primary"
                onClick={handleStartDemoMode}
                disabled={startingDemo}
              >
                {startingDemo
                  ? t("dashboard.onboardingDemoLoading")
                  : t("dashboard.onboardingDemoAction")}
              </button>
            </div>
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: "10px",
                padding: "0.85rem",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem" }}>
                {t("dashboard.onboardingManualTitle")}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "0.8rem" }}>
                {t("dashboard.onboardingManualBody")}
              </div>
              <button className="btn-ghost" onClick={handleStartManualMode}>
                {t("dashboard.onboardingManualAction")}
              </button>
            </div>
          </div>
        </div>
      )}
      {!showOnboardingChoice && onboardingMessage && (
        <div
          className="card"
          style={{
            marginBottom: "1rem",
            borderColor: "rgba(34,197,94,0.22)",
            background: "rgba(34,197,94,0.08)",
            color: "var(--text)",
            fontSize: "0.82rem",
          }}
        >
          {onboardingMessage}
        </div>
      )}
      {onboardingError && (
        <div
          className="card"
          style={{
            marginBottom: "1rem",
            borderColor: "rgba(239,68,68,0.26)",
            background: "rgba(239,68,68,0.09)",
            color: "var(--text)",
            fontSize: "0.82rem",
          }}
        >
          {onboardingError}
        </div>
      )}
      {demoModeEnabled && !showOnboardingChoice && (
        <div
          className="card"
          style={{
            marginBottom: "1.25rem",
            borderColor: "rgba(6,182,212,0.26)",
            background:
              "linear-gradient(130deg, rgba(6,182,212,0.12) 0%, rgba(59,130,246,0.08) 100%)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.8rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: "0.82rem" }}>
            <strong>{t("dashboard.demoModeBadgeTitle")}</strong>{" "}
            <span style={{ color: "var(--muted)" }}>
              {t("dashboard.demoModeBadgeBody")}
            </span>
          </div>
          <Link href="/account#market-data" className="btn-ghost">
            {t("dashboard.openMarketSettings")}
          </Link>
        </div>
      )}
      {marketDataNeedsSetup && (
        <div
          className="card"
          style={{
            marginBottom: "1.25rem",
            borderColor: "rgba(245,158,11,0.28)",
            background:
              "linear-gradient(130deg, rgba(245,158,11,0.1) 0%, rgba(99,102,241,0.06) 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: "0.93rem", fontWeight: 700, marginBottom: "0.2rem" }}>
              {t("dashboard.marketDataSetupTitle")}
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
              {!hasCustomMarketKeys && !hasMarketTrackedAssets
                ? t("dashboard.marketDataSetupBodyNoKeysNoHoldings")
                : hasCustomMarketKeys
                  ? t("dashboard.marketDataSetupBodyWithKeys")
                  : t("dashboard.marketDataSetupBodyNoKeys")}
            </div>
          </div>
          <Link href="/account#market-data" className="btn-primary">
            {t("dashboard.openMarketSettings")}
          </Link>
        </div>
      )}
      {/* ── Net Worth hero card ─────────────────────────────────── */}
      <div
        className="card"
        style={{
          marginBottom: "1.5rem",
          background:
            "linear-gradient(135deg, var(--surface) 0%, var(--surface-3) 100%)",
          borderColor: "var(--accent-glow)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative radial glow */}
        <div
          style={{
            position: "absolute",
            top: "-50px",
            right: "-50px",
            width: "200px",
            height: "200px",
            background:
              "radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--muted)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {t("dashboard.netWorth")}
        </div>
        <div
          className="net-worth-value"
          style={{
            fontSize: "3rem",
            fontWeight: 800,
            color: "var(--foreground)",
            margin: "0.5rem 0",
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            fontFeatureSettings: '"tnum"',
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatCurrency(netWorth, "CZK", compactCurrency)}
        </div>
        {change !== 0 && (
          <div
            style={{
              fontSize: "0.9rem",
              color: change >= 0 ? "var(--green)" : "var(--red)",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            {change >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            {t("dashboard.changeFromLastSnapshot", {
              value: formatCurrency(Math.abs(change), "CZK", compactCurrency),
            })}
          </div>
        )}
        {change === 0 && (
          <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            {t("dashboard.saveSnapshotPrefix")}{" "}
            <Link href="/history" style={{ color: "var(--accent)" }}>
              {t("dashboard.historyLink")}
            </Link>{" "}
            {t("dashboard.saveSnapshotSuffix")}
          </div>
        )}
      </div>

      {/* ── Stat cards ─────────────────────────────────────────── */}
      <div
        className="stat-grid"
        style={{
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          marginBottom: "1rem",
        }}
      >
        <StatCard
          label={t("dashboard.totalAssets")}
          value={formatCurrency(totalAssets, "CZK", compactCurrency)}
          accent="var(--green)"
          icon={<ArrowUp size={16} />}
        />
        <StatCard
          label={t("dashboard.totalLiabilities")}
          value={formatCurrency(totalLiabilities, "CZK", compactCurrency)}
          accent="var(--red)"
          icon={<ArrowDown size={16} />}
        />
      </div>

      <div className="stat-grid">
        {secondaryStatCards.map((card) => (
          <StatCard
            key={card.key}
            label={card.label}
            value={formatCurrency(card.value, "CZK", compactCurrency)}
            sub={card.sub}
            accent={card.accent}
            icon={card.icon}
            href={card.href}
          />
        ))}
      </div>

      {targetAllocationEnabled && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h2
            style={{ margin: "0 0 1.25rem", fontSize: "1rem", fontWeight: 700 }}
          >
            {t("dashboard.targetVsActual")}
          </h2>
          <div style={{ display: "grid", gap: "0.85rem" }}>
            {allocationComparison.map((item) => (
              <div key={item.assetClass}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "1rem",
                    fontSize: "0.8rem",
                    marginBottom: "0.3rem",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {assetClassLabels[item.assetClass] ?? item.assetClass}
                  </span>
                  <span style={{ color: "var(--muted)" }}>
                    {t("dashboard.actual")} {item.actualPercent.toFixed(1)}% ·{" "}
                    {t("dashboard.target")} {item.targetPercent.toFixed(1)}% ·{" "}
                    <span
                      style={{
                        color:
                          Math.abs(item.diffPercent) <= 2
                            ? "var(--green)"
                            : item.diffPercent > 0
                              ? "var(--yellow)"
                              : "var(--accent)",
                      }}
                    >
                      {item.diffPercent >= 0 ? "+" : ""}
                      {item.diffPercent.toFixed(1)} pp
                    </span>
                  </span>
                </div>
                <div
                  style={{
                    position: "relative",
                    height: "8px",
                    background: "var(--surface-3)",
                    borderRadius: "999px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: `${Math.min(100, item.actualPercent)}%`,
                      background:
                        "linear-gradient(90deg, #3b82f6 0%, #10b981 100%)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: `${Math.min(100, item.targetPercent)}%`,
                      top: "-2px",
                      bottom: "-2px",
                      width: "2px",
                      background: "#f59e0b",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bottom row ─────────────────────────────────────────── */}
      <div style={{ marginBottom: "1.5rem" }}>
        {/* Asset Allocation */}
        <div className="card" style={{ padding: "1.5rem 1.5rem 1.6rem" }}>
          <h2
            style={{ margin: "0 0 1.4rem", fontSize: "1.15rem", fontWeight: 700 }}
          >
            {t("dashboard.assetAllocation")}
          </h2>
          {allocationItems.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
              {t("dashboard.noAssetsYet")}
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              {allocationItems.map((item) => {
                const pct = (item.value / total) * 100;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    style={{ textDecoration: "none" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.92rem",
                            color: "var(--foreground)",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.6rem",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: "10px",
                              height: "10px",
                              borderRadius: "50%",
                              background: item.color,
                              boxShadow: `0 0 8px ${item.color}80`,
                            }}
                          />
                          {assetClassLabels[item.label] ?? item.label}
                        </span>
                        <span
                          style={{
                            fontSize: "0.95rem",
                            color: "var(--muted)",
                            fontFeatureSettings: '"tnum"',
                            fontWeight: 500,
                          }}
                        >
                          {formatCurrency(item.value, "CZK", compactCurrency)} · {pct.toFixed(1)}
                          %
                        </span>
                      </div>
                      <div
                        style={{
                          height: "7px",
                          background: "var(--surface-3)",
                          borderRadius: "999px",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            background: `linear-gradient(90deg, ${item.color} 0%, ${item.color}88 100%)`,
                            borderRadius: "999px",
                            width: `${pct}%`,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {(portfolioNotesEnabled || tagCloudEnabled) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              portfolioNotesEnabled && tagCloudEnabled
                ? "minmax(0, 1.4fr) minmax(280px, 0.8fr)"
                : "minmax(0, 1fr)",
            gap: "1.5rem",
            marginTop: "1.5rem",
          }}
        >
          {portfolioNotesEnabled && (
          <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
              {t("dashboard.portfolioNotes")}
            </h2>
            <button
              className="btn-primary"
              onClick={() => setShowNoteModal(true)}
            >
              + {t("dashboard.addNote")}
            </button>
          </div>
          {portfolioNotes.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
              {t("dashboard.noNotes")}
            </p>
          ) : (
            <div style={{ display: "grid", gap: "0.85rem" }}>
              {portfolioNotes.map((note) => (
                <div
                  key={note.id as string}
                  style={{
                    padding: "0.9rem 1rem",
                    borderRadius: "10px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1rem",
                      marginBottom: "0.4rem",
                    }}
                  >
                    <strong>{note.title as string}</strong>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        className="btn-ghost"
                        onClick={() => handleStartEditNote(note)}
                        style={{ fontSize: "0.72rem" }}
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        className="btn-ghost"
                        onClick={() => handleDeleteNote(note.id as string)}
                        style={{ fontSize: "0.72rem" }}
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--muted)",
                      marginBottom: "0.45rem",
                    }}
                  >
                    {new Date(String(note.noteDate)).toLocaleDateString(
                      localeTag,
                    )}
                  </div>
                  <div style={{ fontSize: "0.84rem", lineHeight: 1.6 }}>
                    {note.body as string}
                  </div>
                  {parseTags((note.tags as string | null) ?? null).length >
                    0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.4rem",
                        marginTop: "0.65rem",
                      }}
                    >
                      {parseTags((note.tags as string | null) ?? null).map(
                        (tag) => (
                          <span
                            key={tag}
                            style={{
                              padding: "0.2rem 0.5rem",
                              borderRadius: "999px",
                              background: "rgba(59,130,246,0.12)",
                              color: "var(--accent)",
                              fontSize: "0.72rem",
                            }}
                          >
                            #{tag}
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
          )}

          {tagCloudEnabled && (
            <div className="card">
              <h2 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 700 }}>
                {t("dashboard.tagCloud")}
              </h2>
              {tagCloud.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                  {t("dashboard.noTags")}
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
                  {tagCloud.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        padding: "0.35rem 0.7rem",
                        borderRadius: "999px",
                        background: "rgba(16,185,129,0.1)",
                        border: "1px solid rgba(16,185,129,0.18)",
                        fontSize: "0.78rem",
                        color: "var(--foreground)",
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showNoteModal && (
        <Modal
          title={
            editingNoteId
              ? t("dashboard.editNote")
              : t("dashboard.addPortfolioNote")
          }
          onClose={() => {
            setShowNoteModal(false);
            resetNoteForm();
          }}
        >
          <form
            onSubmit={handleSaveNote}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <FormField
              label={t("dashboard.title")}
              name="title"
              value={noteForm.title}
              onChange={(e) =>
                setNoteForm((current) => ({
                  ...current,
                  title: e.target.value,
                }))
              }
              required
            />
            <FormField
              label={t("dashboard.body")}
              name="body"
              type="textarea"
              value={noteForm.body}
              onChange={(e) =>
                setNoteForm((current) => ({ ...current, body: e.target.value }))
              }
              required
            />
            <FormField
              label={t("common.tags")}
              name="tags"
              value={noteForm.tags}
              onChange={(e) =>
                setNoteForm((current) => ({ ...current, tags: e.target.value }))
              }
              placeholder={t("dashboard.noteTagsPlaceholder")}
            />
            {noteError && (
              <div style={{ fontSize: "0.8rem", color: "var(--red)" }}>
                {noteError}
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.75rem",
              }}
            >
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setShowNoteModal(false);
                  resetNoteForm();
                }}
              >
                {t("common.cancel")}
              </button>
              <button type="submit" className="btn-primary">
                {editingNoteId
                  ? t("history.saveChanges")
                  : t("common.saveNote")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
