"use client";
import { useEffect, useMemo, useState } from "react";
import * as Evolu from "@evolu/common";
import { useQuery } from "@evolu/react";
import {
  NET_WORTH_SNAPSHOT_SCHEMA_VERSION,
  useEvolu,
} from "@/lib/evolu";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
} from "recharts";
import { formatCurrency } from "@/lib/currencies";
import MarketDataStatus from "@/components/MarketDataStatus";
import Modal from "@/components/Modal";
import FormField from "@/components/FormField";
import { useI18n } from "@/components/i18n/I18nProvider";
import { withMarketApiHeaders } from "@/lib/marketApiKeys";

export default function HistoryPage() {
  const evolu = useEvolu();
  const { localeTag, t } = useI18n();
  const [snapping, setSnapping] = useState(false);
  const [view, setView] = useState<"networth" | "breakdown" | "asset-trend">("networth");
  const [autoSnapped, setAutoSnapped] = useState(false);
  const [autoSnapshotMsg, setAutoSnapshotMsg] = useState<string | null>(null);
  const [showCashflowModal, setShowCashflowModal] = useState(false);
  const [editingCashflowId, setEditingCashflowId] = useState<string | null>(null);
  const [cashflowError, setCashflowError] = useState<string | null>(null);
  const [cashflowForm, setCashflowForm] = useState({
    entryDate: new Date().toISOString().split("T")[0],
    type: "CONTRIBUTION",
    category: t("history.contribution"),
    amount: "",
    currency: "CZK",
    tags: "",
    notes: "",
  });

  // ── Queries ──────────────────────────────────────────────────────────────
  // Include symbol/ticker so we can look up live prices
  const cryptoQ = useMemo(() => evolu.createQuery((db) => db.selectFrom("cryptoHolding").select(["symbol", "amount"]).where("isDeleted", "is not", Evolu.sqliteTrue).where("deleted", "is not", Evolu.sqliteTrue)), [evolu]);
  const stockQ = useMemo(() => evolu.createQuery((db) => db.selectFrom("stockHolding").select(["ticker", "shares", "currency"]).where("isDeleted", "is not", Evolu.sqliteTrue).where("deleted", "is not", Evolu.sqliteTrue)), [evolu]);
  const propertyQ = useMemo(() => evolu.createQuery((db) => db.selectFrom("property").select(["estimatedValue", "remainingLoan"]).where("isDeleted", "is not", Evolu.sqliteTrue).where("deleted", "is not", Evolu.sqliteTrue)), [evolu]);
  const savingsQ = useMemo(() => evolu.createQuery((db) => db.selectFrom("savingsAccount").select(["balance"]).where("isDeleted", "is not", Evolu.sqliteTrue).where("deleted", "is not", Evolu.sqliteTrue)), [evolu]);
  const recQ = useMemo(() => evolu.createQuery((db) => db.selectFrom("receivable").select(["amount", "status"]).where("isDeleted", "is not", Evolu.sqliteTrue).where("deleted", "is not", Evolu.sqliteTrue)), [evolu]);
  const cashflowQ = useMemo(() => evolu.createQuery((db) => db.selectFrom("cashflowEntry").selectAll().where("isDeleted", "is not", Evolu.sqliteTrue).where("deleted", "is not", Evolu.sqliteTrue).orderBy("entryDate", "desc").orderBy("createdAt", "desc")), [evolu]);
  const snapshotQ = useMemo(() => evolu.createQuery((db) => db.selectFrom("netWorthSnapshot").selectAll().where("isDeleted", "is not", Evolu.sqliteTrue).where("deleted", "is not", Evolu.sqliteTrue).orderBy("snapshotDate", "asc").orderBy("createdAt", "asc")), [evolu]);

  const cryptos = useQuery(cryptoQ);
  const stocks = useQuery(stockQ);
  const properties = useQuery(propertyQ);
  const savings = useQuery(savingsQ);
  const receivables = useQuery(recQ);
  const cashflowEntries = useQuery(cashflowQ);
  const snapshots = useQuery(snapshotQ);

  // ── Live prices (same pattern as dashboard) ───────────────────────────────
  const [cryptoPrices, setCryptoPrices] = useState<Record<string, { czk: number }>>({});
  const [stockPrices, setStockPrices] = useState<Record<string, { czk: number }>>({});
  const [cryptoPricesLoaded, setCryptoPricesLoaded] = useState(false);
  const [stockPricesLoaded, setStockPricesLoaded] = useState(false);
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
  const pricesLoaded = cryptoPricesLoaded && stockPricesLoaded;

  useEffect(() => {
    const symbols = cryptos.map((c) => (c.symbol as string).toUpperCase()).filter(Boolean);
    if (symbols.length === 0) {
      setCryptoPricesLoaded(true);
      return;
    }
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
      })
      .finally(() => setCryptoPricesLoaded(true));
  }, [cryptos]);

  useEffect(() => {
    const tickers = stocks.map((s) => (s.ticker as string).toUpperCase()).filter(Boolean);
    if (tickers.length === 0) {
      setStockPricesLoaded(true);
      return;
    }
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
      })
      .finally(() => setStockPricesLoaded(true));
  }, [stocks]);

  // ── Computed values using live prices (same as dashboard) ─────────────────
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

  const propertyValue = properties.reduce((s, p) => s + (p.estimatedValue as number), 0);
  const mortgageDebt = properties.reduce((s, p) => s + ((p.remainingLoan as number) ?? 0), 0);
  const savingsValue = savings.reduce((s, sv) => s + (sv.balance as number), 0);
  const receivablesValue = receivables.filter((r) => String(r.status) !== "PAID").reduce((s, r) => s + (r.amount as number), 0);

  const currentNetWorth = cryptoValue + stocksValue + propertyValue + savingsValue + receivablesValue - mortgageDebt;

  // ── Snapshot ──────────────────────────────────────────────────────────────
  function takeSnapshot() {
    setSnapping(true);
    const totalAssets = cryptoValue + stocksValue + propertyValue + savingsValue + receivablesValue;
    const totalLiabilities = mortgageDebt;
    const netWorth = totalAssets - totalLiabilities;
    evolu.insert("netWorthSnapshot", {
      snapshotDate: new Date().toISOString().split("T")[0],
      totalAssets,
      totalLiabilities,
      netWorth,
      cryptoValue,
      stocksValue,
      propertyValue,
      savingsValue,
      receivablesValue,
      schemaVersion: NET_WORTH_SNAPSHOT_SCHEMA_VERSION as never,
      deleted: Evolu.sqliteFalse,
    } as never);
    setSnapping(false);
  }

  // ── Weekly auto-snapshot ──────────────────────────────────────────────────
  // Once prices are loaded, check if it has been ≥7 days since the last snapshot.
  // If yes, take one automatically so the user never has to remember.
  useEffect(() => {
    if (!pricesLoaded || autoSnapped) return;
    // Don't auto-create the very first snapshot — let the user do that intentionally.
    if (snapshots.length === 0) return;
    // Need at least one asset to record a meaningful snapshot.
    const hasAssets = cryptos.length > 0 || stocks.length > 0 || properties.length > 0 || savings.length > 0 || receivables.length > 0;
    if (!hasAssets) return;

    const lastSnapshot = snapshots[snapshots.length - 1];
    const lastDate = new Date(String(lastSnapshot.snapshotDate));
    const daysSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSince >= 7) {
      // Don't duplicate if there's already a snapshot from today.
      const today = new Date().toISOString().split("T")[0];
      const alreadyToday = snapshots.some((s) => String(s.snapshotDate) === today);
      if (!alreadyToday) {
        setAutoSnapped(true);
        takeSnapshot();
        setAutoSnapshotMsg(t("history.autoSnapshot", { days: Math.floor(daysSince) }));
        setTimeout(() => setAutoSnapshotMsg(null), 6000);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricesLoaded, snapshots.length, autoSnapped, cryptos.length, stocks.length, properties.length, savings.length, receivables.length]);

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData = snapshots.map((s) => ({
    date: new Date(String(s.snapshotDate)).toLocaleDateString(localeTag, { day: "2-digit", month: "short", year: "2-digit" }),
    [t("history.currentNetWorth")]: Math.round(s.netWorth as number),
    [t("history.assetsSeries")]: Math.round(s.totalAssets as number),
    [t("history.liabilitiesSeries")]: Math.round(s.totalLiabilities as number),
    [t("history.cryptoSeries")]: Math.round(s.cryptoValue as number),
    [t("history.stocksSeries")]: Math.round(s.stocksValue as number),
    [t("history.propertySeries")]: Math.round(s.propertyValue as number),
    [t("history.savingsSeries")]: Math.round(s.savingsValue as number),
    [t("history.receivablesSeries")]: Math.round(s.receivablesValue as number),
  }));

  const firstSnapshot = snapshots[0];
  const totalChange = firstSnapshot ? currentNetWorth - (firstSnapshot.netWorth as number) : 0;
  const latestSnapshot = snapshots[snapshots.length - 1];
  const nextAutoSnapshotDate = latestSnapshot
    ? new Date(new Date(String(latestSnapshot.snapshotDate)).getTime() + 7 * 24 * 60 * 60 * 1000)
    : null;
  const bestSnapshot = snapshots.reduce<typeof snapshots[number] | null>((best, snap) => {
    if (!best) return snap;
    return (snap.netWorth as number) > (best.netWorth as number) ? snap : best;
  }, null);
  const thirtyDayReference =
    [...snapshots]
      .reverse()
      .find((snap) => Date.now() - new Date(String(snap.snapshotDate)).getTime() >= 30 * 24 * 60 * 60 * 1000) ??
    firstSnapshot;
  const change30d = thirtyDayReference
    ? currentNetWorth - (thirtyDayReference.netWorth as number)
    : null;
  const averageSnapshotCadenceDays =
    snapshots.length < 2
      ? null
      : snapshots.slice(1).reduce((sum, snap, index) => {
          const prev = snapshots[index];
          const diff =
            new Date(String(snap.snapshotDate)).getTime() -
            new Date(String(prev.snapshotDate)).getTime();
          return sum + diff / (1000 * 60 * 60 * 24);
        }, 0) /
        (snapshots.length - 1);
  const signedCashflow = cashflowEntries.reduce((sum, entry) => {
    const amount = entry.amount as number;
    return sum + (String(entry.type) === "WITHDRAWAL" ? -amount : amount);
  }, 0);
  const contributionTotal = cashflowEntries
    .filter((entry) => String(entry.type) === "CONTRIBUTION")
    .reduce((sum, entry) => sum + (entry.amount as number), 0);
  const withdrawalTotal = cashflowEntries
    .filter((entry) => String(entry.type) === "WITHDRAWAL")
    .reduce((sum, entry) => sum + (entry.amount as number), 0);

  function handleCashflowChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    setCashflowForm((current) => ({ ...current, [e.target.name]: e.target.value }));
  }

  function resetCashflowForm() {
    setEditingCashflowId(null);
    setCashflowError(null);
    setCashflowForm({
      entryDate: new Date().toISOString().split("T")[0],
      type: "CONTRIBUTION",
      category: t("history.contribution"),
      amount: "",
      currency: "CZK",
      tags: "",
      notes: "",
    });
  }

  function handleSaveCashflow(e: React.FormEvent) {
    e.preventDefault();
    const fields = {
      entryDate: cashflowForm.entryDate,
      type: cashflowForm.type,
      category: cashflowForm.category.trim(),
      amount: parseFloat(cashflowForm.amount),
      currency: cashflowForm.currency,
      tags: cashflowForm.tags.trim() || null,
      notes: cashflowForm.notes.trim() || null,
    };
    if (editingCashflowId) {
      evolu.update("cashflowEntry", {
        id: editingCashflowId as never,
        ...fields,
      } as never);
    } else {
      const result = evolu.insert("cashflowEntry", {
        ...fields,
        deleted: Evolu.sqliteFalse,
      } as never);
      if (!result.ok) {
        setCashflowError(t("history.cashflowSaveError"));
        return;
      }
    }
    resetCashflowForm();
    setShowCashflowModal(false);
  }

  function handleStartEditCashflow(entry: {
    id: unknown;
    entryDate: unknown;
    type: unknown;
    category: unknown;
    amount: unknown;
    currency: unknown;
    tags: unknown;
    notes: unknown;
  }) {
    setEditingCashflowId(entry.id as string);
    setCashflowForm({
      entryDate: (entry.entryDate as string) ?? new Date().toISOString().split("T")[0],
      type: (entry.type as string) ?? "CONTRIBUTION",
      category: (entry.category as string) ?? "",
      amount: String(entry.amount as number),
      currency: (entry.currency as string) ?? "CZK",
      tags: (entry.tags as string) ?? "",
      notes: (entry.notes as string) ?? "",
    });
    setShowCashflowModal(true);
  }

  function handleDeleteCashflow(id: string) {
    evolu.update("cashflowEntry", { id: id as never, deleted: Evolu.sqliteTrue } as never);
  }

  function handleDeleteSnapshot(id: string, snapshotDate: string) {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        t("history.deleteSnapshotConfirm", {
          date: new Date(snapshotDate).toLocaleDateString(localeTag, { dateStyle: "medium" }),
        }),
      );
      if (!confirmed) return;
    }

    evolu.update("netWorthSnapshot", {
      id: id as never,
      deleted: Evolu.sqliteTrue,
    } as never);
  }

  return (
    <div>
      {autoSnapshotMsg && (
        <div style={{ background: "var(--surface-2)", border: "1px solid var(--accent)", borderRadius: "8px", padding: "0.6rem 1rem", marginBottom: "1rem", fontSize: "0.8rem", color: "var(--accent)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          📸 {autoSnapshotMsg}
        </div>
      )}

      <div className="page-header-row" style={{ marginBottom: "2rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>{t("history.title")}</h1>
          <p style={{ color: "var(--muted)", margin: "0.35rem 0 0", fontSize: "0.875rem" }}>{t("history.subtitle", { count: snapshots.length })}</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button className="btn-ghost" onClick={() => setShowCashflowModal(true)}>
            + {t("history.cashflow")}
          </button>
          <button className="btn-primary" onClick={takeSnapshot} disabled={snapping || !pricesLoaded}>{snapping ? t("common.saving") : !pricesLoaded ? t("history.loadingPrices") : `📸 ${t("history.takeSnapshot")}`}</button>
        </div>
      </div>

      <MarketDataStatus
        sources={[
          ...(cryptos.length > 0
            ? [{ label: t("dashboard.cryptoPrices"), ...cryptoStatus }]
            : []),
          ...(stocks.length > 0
            ? [{ label: t("dashboard.stockPrices"), ...stockStatus }]
            : []),
        ]}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: t("history.currentNetWorth"), value: formatCurrency(currentNetWorth, "CZK"), color: "var(--accent)" },
          { label: t("history.totalChange"), value: (totalChange >= 0 ? "+" : "") + formatCurrency(totalChange, "CZK"), color: totalChange >= 0 ? "var(--green)" : "var(--red)" },
          { label: t("history.since"), value: firstSnapshot ? new Date(String(firstSnapshot.snapshotDate)).toLocaleDateString(localeTag) : "—", color: "var(--muted)" },
          { label: t("history.snapshots"), value: String(snapshots.length), color: "var(--muted)" },
          { label: t("history.change30d"), value: change30d === null ? "—" : `${change30d >= 0 ? "+" : ""}${formatCurrency(change30d, "CZK")}`, color: change30d === null ? "var(--muted)" : change30d >= 0 ? "var(--green)" : "var(--red)" },
          { label: t("history.bestSnapshot"), value: bestSnapshot ? formatCurrency(bestSnapshot.netWorth as number, "CZK") : "—", color: "var(--accent)" },
          { label: t("history.avgCadence"), value: averageSnapshotCadenceDays === null ? "—" : `${averageSnapshotCadenceDays.toFixed(1)} d`, color: "var(--muted)" },
          { label: t("history.nextAutoSnapshot"), value: nextAutoSnapshotDate ? nextAutoSnapshotDate.toLocaleDateString(localeTag) : "—", color: "var(--muted)" },
          { label: t("history.netCashflow"), value: `${signedCashflow >= 0 ? "+" : ""}${formatCurrency(signedCashflow, "CZK")}`, color: signedCashflow >= 0 ? "var(--green)" : "var(--red)" },
        ].map((s) => (
          <div key={s.label} className="card">
            <div style={{ fontSize: "0.65rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>{s.label}</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        {(["networth", "breakdown", "asset-trend"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} style={{ padding: "0.4rem 1rem", borderRadius: "6px", border: "1px solid var(--card-border)", background: view === v ? "var(--accent)" : "transparent", color: view === v ? "white" : "var(--muted)", cursor: "pointer", fontSize: "0.8rem", fontWeight: 500 }}>
            {v === "networth" ? t("history.viewNetWorth") : v === "breakdown" ? t("history.viewBreakdown") : t("history.viewAssetTrends")}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        {snapshots.length < 2 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📊</div>
            <p>{t("history.takeAtLeastTwo")}</p>
            <p style={{ fontSize: "0.8rem" }}>{t("history.takeSnapshotHint")}</p>
          </div>
        ) : view === "networth" ? (
          <ResponsiveContainer width="100%" height={360}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
              <defs>
                <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                <linearGradient id="assetsGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: "8px" }} labelStyle={{ color: "#e2e8f0", fontWeight: 600 }} formatter={(value: number | undefined, name: string | undefined) => [formatCurrency(value ?? 0, "CZK"), name ?? ""]} />
              <Legend wrapperStyle={{ color: "#64748b", fontSize: "0.8rem" }} />
              <Area type="monotone" dataKey={t("history.assetsSeries")} stroke="#10b981" fill="url(#assetsGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey={t("history.currentNetWorth")} stroke="#3b82f6" fill="url(#netWorthGrad)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        ) : view === "breakdown" ? (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: "8px" }} formatter={(value: number | undefined, name: string | undefined) => [formatCurrency(value ?? 0, "CZK"), name ?? ""]} />
              <Legend wrapperStyle={{ color: "#64748b", fontSize: "0.8rem" }} />
              <Bar dataKey={t("history.propertySeries")} stackId="a" fill="#8b5cf6" radius={[0,0,0,0]} />
              <Bar dataKey={t("history.savingsSeries")} stackId="a" fill="#10b981" />
              <Bar dataKey={t("history.stocksSeries")} stackId="a" fill="#f59e0b" />
              <Bar dataKey={t("history.cryptoSeries")} stackId="a" fill="#f97316" />
              <Bar dataKey={t("history.receivablesSeries")} stackId="a" fill="#06b6d4" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: "8px" }} formatter={(value: number | undefined, name: string | undefined) => [formatCurrency(value ?? 0, "CZK"), name ?? ""]} />
              <Legend wrapperStyle={{ color: "#64748b", fontSize: "0.8rem" }} />
              <Line type="monotone" dataKey={t("history.propertySeries")} stroke="#8b5cf6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey={t("history.savingsSeries")} stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey={t("history.stocksSeries")} stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey={t("history.cryptoSeries")} stroke="#f97316" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey={t("history.receivablesSeries")} stroke="#06b6d4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>{t("history.manualCashflow")}</h2>
          <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
            {t("history.contributions")} {formatCurrency(contributionTotal, "CZK")} · {t("history.withdrawals")} {formatCurrency(withdrawalTotal, "CZK")}
          </div>
        </div>
        {cashflowEntries.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            {t("history.noCashflow")}
          </p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>{t("common.date")}</th><th>{t("common.type")}</th><th>{t("common.category")}</th><th>{t("common.amount")}</th><th>{t("common.notes")}</th><th>{t("common.actions")}</th></tr>
              </thead>
              <tbody>
                {cashflowEntries.map((entry) => (
                  <tr key={entry.id as string}>
                    <td style={{ color: "var(--muted)" }}>{new Date(String(entry.entryDate)).toLocaleDateString(localeTag)}</td>
                    <td>{String(entry.type) === "WITHDRAWAL" ? t("history.withdrawal") : t("history.contribution")}</td>
                    <td>{String(entry.category)}</td>
                    <td style={{ color: String(entry.type) === "WITHDRAWAL" ? "var(--red)" : "var(--green)", fontWeight: 600 }}>
                      {String(entry.type) === "WITHDRAWAL" ? "-" : "+"}
                      {formatCurrency(entry.amount as number, String(entry.currency))}
                    </td>
                    <td style={{ color: "var(--muted)" }}>{(entry.notes as string) ?? "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button className="btn-ghost" onClick={() => handleStartEditCashflow(entry)}>
                          {t("common.edit")}
                        </button>
                        <button className="btn-ghost" onClick={() => handleDeleteCashflow(entry.id as string)}>
                          {t("common.delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {snapshots.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--card-border)", fontWeight: 700, fontSize: "0.9rem" }}>{t("history.snapshotHistory")}</div>
          <div className="table-scroll">
          <table>
            <thead><tr><th>{t("common.date")}</th><th>{t("history.currentNetWorth")}</th><th>{t("history.assetsSeries")}</th><th>{t("history.liabilitiesSeries")}</th><th>{t("history.totalChange")}</th><th>{t("common.actions")}</th></tr></thead>
            <tbody>
              {[...snapshots].reverse().map((snap, idx, arr) => {
                const prev = arr[idx + 1];
                const change = prev ? (snap.netWorth as number) - (prev.netWorth as number) : null;
                return (
                  <tr key={snap.id as string}>
                    <td style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{new Date(String(snap.snapshotDate)).toLocaleDateString(localeTag, { dateStyle: "medium" })}</td>
                    <td style={{ fontWeight: 700 }}>{formatCurrency(snap.netWorth as number, "CZK")}</td>
                    <td style={{ color: "var(--green)" }}>{formatCurrency(snap.totalAssets as number, "CZK")}</td>
                    <td style={{ color: "var(--red)" }}>{formatCurrency(snap.totalLiabilities as number, "CZK")}</td>
                    <td style={{ color: change === null ? "var(--muted)" : change >= 0 ? "var(--green)" : "var(--red)", fontSize: "0.85rem" }}>
                      {change === null ? "—" : (change >= 0 ? "+" : "") + formatCurrency(change, "CZK")}
                    </td>
                    <td>
                      <button
                        className="btn-ghost"
                        onClick={() => handleDeleteSnapshot(snap.id as string, String(snap.snapshotDate))}
                        aria-label={t("history.deleteSnapshotConfirm", { date: String(snap.snapshotDate) })}
                      >
                        {t("common.delete")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {showCashflowModal && (
        <Modal
          title={editingCashflowId ? t("history.editCashflow") : t("history.addCashflow")}
          onClose={() => {
            setShowCashflowModal(false);
            resetCashflowForm();
          }}
        >
          <form onSubmit={handleSaveCashflow} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <FormField label={t("common.date")} name="entryDate" type="date" value={cashflowForm.entryDate} onChange={handleCashflowChange} required />
              <FormField
                label={t("common.type")}
                name="type"
                value={cashflowForm.type}
                onChange={handleCashflowChange}
                options={[
                  { value: "CONTRIBUTION", label: t("history.contribution") },
                  { value: "WITHDRAWAL", label: t("history.withdrawal") },
                ]}
              />
            </div>
            <FormField label={t("common.category")} name="category" value={cashflowForm.category} onChange={handleCashflowChange} required />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <FormField label={t("common.amount")} name="amount" type="number" value={cashflowForm.amount} onChange={handleCashflowChange} step="0.01" min="0" required />
              <FormField
                label={t("common.currency")}
                name="currency"
                value={cashflowForm.currency}
                onChange={handleCashflowChange}
                options={[
                  { value: "CZK", label: "CZK" },
                  { value: "EUR", label: "EUR" },
                  { value: "USD", label: "USD" },
                ]}
              />
            </div>
            <FormField label={t("common.tags")} name="tags" value={cashflowForm.tags} onChange={handleCashflowChange} placeholder={t("history.cashflowTagsPlaceholder")} />
            <FormField label={t("common.notes")} name="notes" type="textarea" value={cashflowForm.notes} onChange={handleCashflowChange} />
            {cashflowError && (
              <div style={{ fontSize: "0.8rem", color: "var(--red)" }}>
                {cashflowError}
              </div>
            )}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setShowCashflowModal(false);
                  resetCashflowForm();
                }}
              >
                {t("common.cancel")}
              </button>
              <button type="submit" className="btn-primary">
                {editingCashflowId ? t("history.saveChanges") : t("common.saveEntry")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
