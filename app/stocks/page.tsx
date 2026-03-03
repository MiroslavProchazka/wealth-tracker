"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Evolu from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEvolu } from "@/lib/evolu";
import Modal from "@/components/Modal";
import FormField from "@/components/FormField";
import { formatCurrency, formatPercent } from "@/lib/currencies";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

// ── Stock avatar ──────────────────────────────────────────────────────────────

const SECTOR_COLORS: Record<string, string> = {
  Technology: "#3b82f6",
  Healthcare: "#10b981",
  Finance: "#f59e0b",
  "Financial Services": "#f59e0b",
  Energy: "#f97316",
  Industrials: "#8b5cf6",
  "Consumer Cyclical": "#ec4899",
  "Consumer Defensive": "#06b6d4",
  "Communication Services": "#6366f1",
  Utilities: "#84cc16",
  "Real Estate": "#ef4444",
  "Basic Materials": "#a78bfa",
};

function tickerColor(ticker: string): string {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) hash = ticker.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 48%)`;
}

function StockAvatar({ ticker, size = 28 }: { ticker: string; size?: number }) {
  const label = ticker.length <= 4 ? ticker : ticker.slice(0, 3);
  const bg = tickerColor(ticker);
  return (
    <div style={{
      width: size, height: size, borderRadius: "7px",
      background: bg, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size <= 28 ? "0.5rem" : "0.65rem",
      fontWeight: 800, color: "white", letterSpacing: "-0.03em",
    }}>
      {label}
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface StockPrice {
  czk: number; usd: number; eur: number;
  originalPrice: number; originalCurrency: string;
  change24h: number; changeAbs: number;
  name: string;
  open: number | null; high: number | null; low: number | null;
  volume: number | null; marketCap: number | null;
  pe: number | null; dividendYield: number | null;
  week52High: number | null; week52Low: number | null;
  quoteType: string; exchange: string;
}

interface PriceAlert {
  id: string;
  ticker: string;
  direction: "above" | "below";
  threshold: number; // always in CZK
}

type DisplayCurrency = "CZK" | "USD" | "EUR";

const CURRENCY_KEY: Record<DisplayCurrency, "czk" | "usd" | "eur"> = {
  CZK: "czk", USD: "usd", EUR: "eur",
};

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const MIN_FETCH_INTERVAL_MS = 30 * 1000;
const ALERTS_STORAGE_KEY = "wealthTracker_stockAlerts";

const ALLOCATION_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
  "#ef4444", "#06b6d4", "#f97316", "#ec4899",
];

const EXCHANGE_OPTIONS = [
  { value: "", label: "Burza (volitelné)" },
  { value: "NASDAQ", label: "NASDAQ" },
  { value: "NYSE", label: "NYSE" },
  { value: "XETRA", label: "XETRA (DE)" },
  { value: "PSE", label: "PSE (Praha)" },
  { value: "LSE", label: "LSE (Londýn)" },
  { value: "EURONEXT", label: "Euronext" },
  { value: "WSE", label: "WSE (Varšava)" },
];

const SECTOR_OPTIONS = [
  { value: "", label: "Sektor (volitelné)" },
  { value: "Technology", label: "Technology" },
  { value: "Healthcare", label: "Healthcare" },
  { value: "Financial Services", label: "Financial Services" },
  { value: "Energy", label: "Energy" },
  { value: "Industrials", label: "Industrials" },
  { value: "Consumer Cyclical", label: "Consumer Cyclical" },
  { value: "Consumer Defensive", label: "Consumer Defensive" },
  { value: "Communication Services", label: "Communication Services" },
  { value: "Utilities", label: "Utilities" },
  { value: "Real Estate", label: "Real Estate" },
  { value: "Basic Materials", label: "Basic Materials" },
  { value: "ETF", label: "ETF / Index Fund" },
];

const emptyForm = {
  ticker: "", name: "", shares: "", currency: "USD",
  buyPrice: "", exchange: "", sector: "", notes: "",
};

const emptyAlert: { ticker: string; direction: "above" | "below"; threshold: string } = {
  ticker: "", direction: "above", threshold: "",
};

// ── Alert helpers ─────────────────────────────────────────────────────────────

function getAlerts(): PriceAlert[] {
  try { return JSON.parse(localStorage.getItem(ALERTS_STORAGE_KEY) ?? "[]"); }
  catch { return []; }
}
function saveAlerts(alerts: PriceAlert[]) {
  localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StocksPage() {
  const evolu = useEvolu();

  // Form & UI state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [searchResults, setSearchResults] = useState<{ symbol: string; name: string; exchange: string; quoteType: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Price state
  const [prices, setPrices] = useState<Record<string, StockPrice>>({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const lastFetchRef = useRef<number>(0);

  // Display currency
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("CZK");

  // Chart state
  const [chartTicker, setChartTicker] = useState<string | null>(null);
  const [chartDays, setChartDays] = useState(30);
  const [chartData, setChartData] = useState<{ date: string; price: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  // Alerts
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [firedAlerts, setFiredAlerts] = useState<PriceAlert[]>([]);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [alertForm, setAlertForm] = useState(emptyAlert);

  // Detail modal
  const [detailTicker, setDetailTicker] = useState<string | null>(null);

  useEffect(() => { setAlerts(getAlerts()); }, []);

  // ── Query holdings ────────────────────────────────────────────────────────
  const query = useMemo(() =>
    evolu.createQuery((db) =>
      db.selectFrom("stockHolding").selectAll()
        .where("isDeleted", "is not", Evolu.sqliteTrue)
        .where("deleted", "is not", Evolu.sqliteTrue)
        .orderBy("createdAt", "desc")
    ), [evolu]);
  const holdings = useQuery(query);
  const holdingsRef = useRef(holdings);
  useEffect(() => { holdingsRef.current = holdings; }, [holdings]);

  // ── Fetch live prices ─────────────────────────────────────────────────────
  const fetchPrices = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetchRef.current < MIN_FETCH_INTERVAL_MS) return;
    const current = holdingsRef.current;
    if (current.length === 0) return;
    const tickers = [...new Set(current.map((h) => h.ticker as string))].join(",");
    setPricesLoading(true);
    setPricesError(null);
    try {
      const res = await fetch(`/api/stocks/prices?tickers=${encodeURIComponent(tickers)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const newPrices: Record<string, StockPrice> = data.prices ?? {};
      setPrices(newPrices);
      setLastUpdated(new Date());
      lastFetchRef.current = Date.now();

      // Check alerts
      const currentAlerts = getAlerts();
      const fired = currentAlerts.filter((alert) => {
        const p = newPrices[alert.ticker]?.czk;
        if (!p) return false;
        return alert.direction === "above" ? p > alert.threshold : p < alert.threshold;
      });
      setFiredAlerts(fired);
    } catch (err) {
      setPricesError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setPricesLoading(false);
    }
  }, []);

  useEffect(() => { fetchPrices(); }, [fetchPrices]);

  const prevHoldingsLenRef = useRef(0);
  useEffect(() => {
    if (holdings.length > 0 && prevHoldingsLenRef.current === 0) fetchPrices(true);
    prevHoldingsLenRef.current = holdings.length;
  }, [holdings.length, fetchPrices]);

  useEffect(() => {
    const id = setInterval(() => fetchPrices(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchPrices]);

  useEffect(() => {
    const onFocus = () => fetchPrices();
    const onVis = () => { if (document.visibilityState === "visible") fetchPrices(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => { window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVis); };
  }, [fetchPrices]);

  // ── Fetch chart history ───────────────────────────────────────────────────
  useEffect(() => {
    if (!chartTicker) return;
    setChartLoading(true);
    setChartData([]);
    const currency = displayCurrency.toLowerCase();
    fetch(`/api/stocks/history?ticker=${chartTicker}&days=${chartDays}&currency=${currency}`)
      .then((r) => r.json())
      .then((d) => setChartData(d.points ?? []))
      .catch(() => setChartData([]))
      .finally(() => setChartLoading(false));
  }, [chartTicker, chartDays, displayCurrency]);

  // ── Ticker search / autocomplete ─────────────────────────────────────────
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleTickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9.^=-]/g, "");
    setForm((f) => ({ ...f, ticker: val }));
    setSearchResults([]);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!val || val.length < 1) return;
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        setSearchResults(data.results ?? []);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 400);
  }

  function handleSelectSearchResult(r: { symbol: string; name: string; exchange: string }) {
    setForm((f) => ({
      ...f,
      ticker: r.symbol,
      name: r.name,
      exchange: r.exchange || f.exchange,
    }));
    setSearchResults([]);
  }

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    if (e.target.name === "ticker") {
      handleTickerChange(e as React.ChangeEvent<HTMLInputElement>);
    } else {
      setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    }
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      evolu.update("stockHolding", {
        id: editingId as never,
        ticker: form.ticker.trim(),
        name: form.name.trim(),
        shares: parseFloat(form.shares),
        currency: form.currency,
        buyPrice: form.buyPrice ? parseFloat(form.buyPrice) : null,
        exchange: form.exchange.trim() || null,
        sector: form.sector.trim() || null,
        notes: form.notes.trim() || null,
      } as never);
      setForm(emptyForm); setEditingId(null); setShowAddModal(false); setSearchResults([]);
    } else {
      const result = evolu.insert("stockHolding", {
        ticker: form.ticker.trim(),
        name: form.name.trim(),
        shares: parseFloat(form.shares),
        currency: form.currency,
        buyPrice: form.buyPrice ? parseFloat(form.buyPrice) : null,
        exchange: form.exchange.trim() || null,
        sector: form.sector.trim() || null,
        notes: form.notes.trim() || null,
        deleted: Evolu.sqliteFalse,
      } as never);
      if (result.ok) { setForm(emptyForm); setShowAddModal(false); setSearchResults([]); }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleStartEdit(h: any) {
    setForm({
      ticker: h.ticker as string,
      name: h.name as string,
      shares: String(h.shares as number),
      currency: h.currency as string,
      buyPrice: h.buyPrice != null ? String(h.buyPrice as number) : "",
      exchange: (h.exchange as string) ?? "",
      sector: (h.sector as string) ?? "",
      notes: (h.notes as string) ?? "",
    });
    setEditingId(h.id as string);
    setSearchResults([]);
    setShowAddModal(true);
  }

  function handleDelete(id: string) {
    if (!confirm("Smazat tento holding?")) return;
    evolu.update("stockHolding", { id: id as never, deleted: Evolu.sqliteTrue } as never);
  }

  // ── Alerts CRUD ───────────────────────────────────────────────────────────
  function handleAddAlert(e: React.FormEvent) {
    e.preventDefault();
    const newAlert: PriceAlert = {
      id: `${Date.now()}`,
      ticker: alertForm.ticker.toUpperCase().trim(),
      direction: alertForm.direction,
      threshold: parseFloat(alertForm.threshold),
    };
    const updated = [...alerts, newAlert];
    setAlerts(updated);
    saveAlerts(updated);
    setAlertForm(emptyAlert);
  }

  function handleDeleteAlert(id: string) {
    const updated = alerts.filter((a) => a.id !== id);
    setAlerts(updated);
    saveAlerts(updated);
    setFiredAlerts((f) => f.filter((a) => a.id !== id));
  }

  // ── Computed values ───────────────────────────────────────────────────────
  const enriched = holdings.map((h) => {
    const ticker = h.ticker as string;
    const shares = h.shares as number;
    const buyPriceOrig = (h.buyPrice as number | null) ?? null;
    const currency = (h.currency as string) ?? "USD";
    const price = prices[ticker];

    const currentCzk = price ? shares * price.czk : null;
    const currentUsd = price ? shares * price.usd : null;
    const currentEur = price ? shares * price.eur : null;

    // Cost basis: buyPrice is stored in original currency
    // We need to convert to CZK for P&L — approximate with current FX
    const costBasisCzk = buyPriceOrig !== null && price
      ? shares * buyPriceOrig * (currency === "CZK" ? 1 : (price.czk / price.originalPrice))
      : null;

    const pnlCzk = currentCzk !== null && costBasisCzk !== null ? currentCzk - costBasisCzk : null;
    const pnlPct = pnlCzk !== null && costBasisCzk && costBasisCzk > 0
      ? (pnlCzk / costBasisCzk) * 100 : null;

    const currentInDisplay =
      displayCurrency === "CZK" ? currentCzk :
      displayCurrency === "USD" ? currentUsd : currentEur;

    return {
      ...h, ticker, shares, buyPriceOrig, currency,
      price, currentCzk, currentUsd, currentEur,
      costBasisCzk, pnlCzk, pnlPct, currentInDisplay,
    };
  });

  const totalCzk = enriched.reduce((s, h) => s + (h.currentCzk ?? 0), 0);
  const totalUsd = enriched.reduce((s, h) => s + (h.currentUsd ?? 0), 0);
  const totalEur = enriched.reduce((s, h) => s + (h.currentEur ?? 0), 0);
  const totalPnlCzk = enriched.reduce((s, h) => s + (h.pnlCzk ?? 0), 0);
  const hasPrices = Object.keys(prices).length > 0;
  const hasPnl = enriched.some((h) => h.pnlCzk !== null);

  const allocations = enriched
    .filter((h) => h.currentCzk && h.currentCzk > 0)
    .map((h, i) => ({
      ticker: h.ticker,
      value: h.currentCzk!,
      pct: totalCzk > 0 ? (h.currentCzk! / totalCzk) * 100 : 0,
      color: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

  // Sector allocation
  const sectorMap: Record<string, number> = {};
  for (const h of enriched) {
    const sector = (h.sector as string | null) ?? "Other";
    sectorMap[sector] = (sectorMap[sector] ?? 0) + (h.currentCzk ?? 0);
  }

  const detailHolding = detailTicker ? enriched.find((h) => h.ticker === detailTicker) : null;
  const detailPrice = detailTicker ? prices[detailTicker] : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── Fired alert banners ── */}
      {firedAlerts.map((alert) => (
        <div key={alert.id} style={{
          marginBottom: "0.75rem", padding: "0.75rem 1rem", borderRadius: "10px",
          background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.4)",
          display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem",
        }}>
          <span>
            🔔 <strong>{alert.ticker}</strong> je{" "}
            {alert.direction === "above" ? "nad" : "pod"} hranicí{" "}
            <strong>{formatCurrency(alert.threshold, "CZK")}</strong>
            {prices[alert.ticker] && (
              <span style={{ color: "var(--muted)", marginLeft: "0.5rem" }}>
                · nyní {formatCurrency(prices[alert.ticker].czk, "CZK")}
              </span>
            )}
          </span>
          <button onClick={() => setFiredAlerts((f) => f.filter((a) => a.id !== alert.id))}
            style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1.1rem" }}>×</button>
        </div>
      ))}

      {/* ── Header ── */}
      <div className="page-header-row">
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>Stock Holdings</h1>
          <p style={{ color: "var(--muted)", margin: "0.35rem 0 0", fontSize: "0.875rem" }}>
            Live ceny Yahoo Finance · US, EU, CZ akcie & ETF
            {lastUpdated && (
              <span style={{ marginLeft: "0.75rem", opacity: 0.6 }}>
                · aktualizováno {lastUpdated.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {/* Currency toggle */}
          <div style={{ display: "flex", background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: "8px", overflow: "hidden" }}>
            {(["CZK", "USD", "EUR"] as DisplayCurrency[]).map((c) => (
              <button key={c} onClick={() => setDisplayCurrency(c)}
                style={{
                  padding: "0.35rem 0.75rem", border: "none", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600,
                  background: displayCurrency === c ? "var(--accent)" : "transparent",
                  color: displayCurrency === c ? "white" : "var(--muted)",
                  transition: "all 0.15s",
                }}
              >{c}</button>
            ))}
          </div>
          <button className="btn-ghost" onClick={() => fetchPrices(true)} disabled={pricesLoading}
            style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}>
            {pricesLoading ? "⏳" : "↻ Refresh"}
          </button>
          <button className="btn-ghost" onClick={() => setShowAlertsModal(true)}
            style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem", position: "relative" }}>
            🔔 Alerty
            {alerts.length > 0 && (
              <span style={{
                marginLeft: "0.3rem", background: "var(--accent)", color: "white",
                borderRadius: "10px", padding: "0 5px", fontSize: "0.7rem", lineHeight: "1.4",
              }}>{alerts.length}</span>
            )}
          </button>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ Add Holding</button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="stat-grid-4">
        <div className="card" style={{ background: "linear-gradient(135deg, #1a1f2e 0%, #1a201e 100%)", borderColor: "rgba(59,130,246,0.3)" }}>
          <div style={{ fontSize: "0.68rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>Celkem</div>
          <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "#3b82f6" }}>
            {hasPrices
              ? formatCurrency(displayCurrency === "CZK" ? totalCzk : displayCurrency === "USD" ? totalUsd : totalEur, displayCurrency)
              : "—"}
          </div>
          {hasPrices && displayCurrency !== "CZK" && (
            <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: "0.2rem" }}>{formatCurrency(totalCzk, "CZK")}</div>
          )}
        </div>

        <div className="card">
          <div style={{ fontSize: "0.68rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>P&L (vs nákup)</div>
          {hasPnl ? (
            <div style={{ fontSize: "1.45rem", fontWeight: 800, color: totalPnlCzk >= 0 ? "var(--green)" : "#ef4444" }}>
              {(totalPnlCzk >= 0 ? "+" : "") + formatCurrency(totalPnlCzk, "CZK")}
            </div>
          ) : (
            <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: "0.4rem" }}>Zadej nákupní cenu</div>
          )}
        </div>

        <div className="card">
          <div style={{ fontSize: "0.68rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>Pozice</div>
          <div style={{ fontSize: "1.45rem", fontWeight: 800 }}>{holdings.length}</div>
        </div>

        <div className="card">
          <div style={{ fontSize: "0.68rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>Status</div>
          <div style={{ fontSize: "0.92rem", fontWeight: 600, marginTop: "0.15rem" }}>
            {pricesLoading && <span style={{ color: "var(--muted)" }}>⏳ Načítám…</span>}
            {pricesError && <span style={{ color: "#ef4444", fontSize: "0.75rem" }}>⚠ {pricesError}</span>}
            {!pricesLoading && !pricesError && hasPrices && <span style={{ color: "var(--green)" }}>✓ Live</span>}
            {!pricesLoading && !pricesError && !hasPrices && holdings.length > 0 && <span style={{ color: "var(--muted)" }}>Čekám…</span>}
            {holdings.length === 0 && <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>Žádné holdingy</span>}
          </div>
        </div>
      </div>

      {/* ── Portfolio allocation bar ── */}
      {allocations.length > 0 && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>Alokace portfolia</div>
          <div style={{ display: "flex", height: "10px", borderRadius: "5px", overflow: "hidden", marginBottom: "0.7rem" }}>
            {allocations.map((a) => (
              <div key={a.ticker}
                style={{ width: `${a.pct}%`, background: a.color, transition: "width 0.4s ease", cursor: "pointer" }}
                title={`${a.ticker}: ${a.pct.toFixed(1)}%`}
                onClick={() => { setChartTicker(a.ticker); setChartDays(30); }}
              />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
            {allocations.map((a) => (
              <div key={a.ticker}
                style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.78rem", cursor: "pointer" }}
                onClick={() => { setChartTicker(a.ticker); setChartDays(30); }}
              >
                <div style={{ width: "9px", height: "9px", borderRadius: "2px", background: a.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{a.ticker}</span>
                <span style={{ color: "var(--muted)" }}>{a.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Holdings table ── */}
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: "1.25rem" }}>
        {holdings.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--muted)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📈</div>
            <p style={{ margin: 0, fontWeight: 500 }}>Žádné stock pozice</p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem" }}>Přidej první holding · US, EU i CZ akcie · ETF</p>
          </div>
        ) : (
          <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Akcie / ETF</th>
                <th style={{ textAlign: "right" }}>Počet</th>
                <th style={{ textAlign: "right" }}>Nákup / ks</th>
                <th style={{ textAlign: "right" }}>Cena / ks ({displayCurrency})</th>
                <th style={{ textAlign: "right" }}>24h</th>
                <th style={{ textAlign: "right" }}>P&L (CZK)</th>
                <th style={{ textAlign: "right" }}>Hodnota ({displayCurrency})</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {enriched.map((h) => {
                const change = h.price?.change24h ?? null;
                const changeColor = change === null ? "var(--muted)" : change >= 0 ? "var(--green)" : "#ef4444";
                const pnlColor = h.pnlCzk === null ? "var(--muted)" : h.pnlCzk >= 0 ? "var(--green)" : "#ef4444";
                const priceKey = CURRENCY_KEY[displayCurrency];
                const priceInDisplay = h.price ? h.price[priceKey] : null;
                const sectorLabel = h.sector as string | null;
                const sectorColor = sectorLabel ? (SECTOR_COLORS[sectorLabel] ?? "#64748b") : "#64748b";

                return (
                  <tr key={h.id as string} style={{ cursor: "pointer" }}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button")) return;
                      setDetailTicker(h.ticker);
                    }}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <StockAvatar ticker={h.ticker} size={28} />
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span style={{ fontWeight: 700, color: "var(--yellow)", fontFamily: "monospace", fontSize: "0.88rem" }}>{h.ticker}</span>
                            {h.price?.quoteType === "ETF" && (
                              <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "0 4px", borderRadius: "3px", background: "rgba(99,102,241,0.2)", color: "#6366f1" }}>ETF</span>
                            )}
                          </div>
                          <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                            {h.name as string}
                            {sectorLabel && (
                              <span style={{ marginLeft: "0.35rem", color: sectorColor, fontWeight: 600 }}>· {sectorLabel}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: "0.88rem" }}>
                      {(h.shares as number).toLocaleString("cs-CZ", { maximumFractionDigits: 6 })}
                    </td>
                    <td style={{ textAlign: "right", color: "var(--muted)", fontSize: "0.82rem" }}>
                      {h.buyPriceOrig !== null
                        ? `${h.buyPriceOrig.toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} ${h.currency}`
                        : <span style={{ opacity: 0.35 }}>—</span>}
                    </td>
                    <td style={{ textAlign: "right", fontSize: "0.85rem" }}>
                      {priceInDisplay !== null ? formatCurrency(priceInDisplay, displayCurrency) : "—"}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: changeColor, fontSize: "0.82rem" }}>
                      {change !== null ? formatPercent(change) : "—"}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: pnlColor, fontSize: "0.82rem" }}>
                      {h.pnlCzk !== null ? (
                        <div>
                          <div>{(h.pnlCzk >= 0 ? "+" : "") + formatCurrency(h.pnlCzk, "CZK")}</div>
                          {h.pnlPct !== null && (
                            <div style={{ fontSize: "0.7rem", opacity: 0.85 }}>
                              {(h.pnlPct >= 0 ? "+" : "") + h.pnlPct.toFixed(2)}%
                            </div>
                          )}
                        </div>
                      ) : <span style={{ opacity: 0.3, color: "var(--muted)" }}>—</span>}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>
                      {h.currentInDisplay !== null
                        ? formatCurrency(h.currentInDisplay, displayCurrency)
                        : <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button
                          onClick={() => { setChartTicker(h.ticker); setChartDays(30); }}
                          title="Historický chart"
                          style={{ background: "none", border: "1px solid var(--card-border)", borderRadius: "6px", padding: "0.3rem 0.5rem", cursor: "pointer", color: "var(--muted)", fontSize: "0.8rem" }}
                        >📈</button>
                        <button className="btn-ghost" onClick={() => handleStartEdit(h)} title="Upravit" style={{ padding: "0.3rem 0.5rem", fontSize: "0.8rem" }}>✏️</button>
                        <button className="btn-danger" onClick={() => handleDelete(h.id as string)}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* ── Sector breakdown ── */}
      {Object.keys(sectorMap).length > 1 && (
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>Sektory</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            {Object.entries(sectorMap)
              .sort((a, b) => b[1] - a[1])
              .map(([sector, value]) => {
                const pct = totalCzk > 0 ? (value / totalCzk) * 100 : 0;
                const color = SECTOR_COLORS[sector] ?? "#64748b";
                return (
                  <div key={sector} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ width: "100px", fontSize: "0.75rem", color: "var(--muted)", flexShrink: 0 }}>{sector}</div>
                    <div style={{ flex: 1, height: "6px", borderRadius: "3px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "3px", transition: "width 0.4s" }} />
                    </div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, width: "42px", textAlign: "right", color }}>{pct.toFixed(1)}%</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--muted)", width: "90px", textAlign: "right" }}>{formatCurrency(value, "CZK", true)}</div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ── Chart modal ── */}
      {chartTicker && (
        <Modal
          title={`${chartTicker}${prices[chartTicker] ? ` — ${prices[chartTicker].name}` : ""} · ${chartDays}d (${displayCurrency})`}
          onClose={() => setChartTicker(null)}
        >
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
            {[7, 30, 90, 365].map((d) => (
              <button key={d} onClick={() => setChartDays(d)}
                className={chartDays === d ? "btn-primary" : "btn-ghost"}
                style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}>
                {d}d
              </button>
            ))}
          </div>
          {chartLoading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)" }}>⏳ Načítám historii…</div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return `${d.getDate()}.${d.getMonth() + 1}.`;
                  }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` :
                    v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` :
                    v.toFixed(2)
                  }
                  width={62}
                />
                <Tooltip
                  contentStyle={{ background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: "8px", fontSize: "0.82rem" }}
                  labelStyle={{ color: "#64748b" }}
                  formatter={(v: number | undefined) => [v !== undefined ? formatCurrency(v, displayCurrency) : "—", "Cena"]}
                  labelFormatter={(label: unknown) => typeof label === "string" ? new Date(label).toLocaleDateString("cs-CZ") : ""}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#3b82f6" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)" }}>Žádná historická data</div>
          )}
        </Modal>
      )}

      {/* ── Detail modal ── */}
      {detailTicker && detailHolding && (
        <Modal
          title={`${detailTicker} — Detail`}
          onClose={() => setDetailTicker(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Header info */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <StockAvatar ticker={detailTicker} size={44} />
              <div>
                <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>{detailHolding.name as string}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  {detailHolding.ticker}
                  {detailPrice?.exchange && ` · ${detailPrice.exchange}`}
                  {(detailHolding.sector as string | null) && ` · ${detailHolding.sector as string}`}
                </div>
              </div>
              {detailPrice && (
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800 }}>
                    {formatCurrency(detailPrice[CURRENCY_KEY[displayCurrency]], displayCurrency)}
                  </div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: detailPrice.change24h >= 0 ? "var(--green)" : "#ef4444" }}>
                    {formatPercent(detailPrice.change24h)}
                  </div>
                </div>
              )}
            </div>

            {/* Stats grid */}
            {detailPrice && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
                {[
                  { label: "Moje pozice", value: `${(detailHolding.shares as number).toLocaleString("cs-CZ", { maximumFractionDigits: 6 })} ks` },
                  { label: "Hodnota", value: formatCurrency(detailHolding.currentCzk ?? 0, "CZK") },
                  { label: "P&L", value: detailHolding.pnlCzk !== null ? `${detailHolding.pnlCzk >= 0 ? "+" : ""}${formatCurrency(detailHolding.pnlCzk, "CZK")}` : "—", color: detailHolding.pnlCzk !== null ? (detailHolding.pnlCzk >= 0 ? "var(--green)" : "#ef4444") : undefined },
                  { label: "Open", value: detailPrice.open ? formatCurrency(detailPrice.open, detailPrice.originalCurrency) : "—" },
                  { label: "High", value: detailPrice.high ? formatCurrency(detailPrice.high, detailPrice.originalCurrency) : "—" },
                  { label: "Low", value: detailPrice.low ? formatCurrency(detailPrice.low, detailPrice.originalCurrency) : "—" },
                  { label: "52W High", value: detailPrice.week52High ? formatCurrency(detailPrice.week52High, detailPrice.originalCurrency) : "—" },
                  { label: "52W Low", value: detailPrice.week52Low ? formatCurrency(detailPrice.week52Low, detailPrice.originalCurrency) : "—" },
                  { label: "Volume", value: detailPrice.volume ? formatVolume(detailPrice.volume) : "—" },
                  { label: "Market Cap", value: detailPrice.marketCap ? formatCurrency(detailPrice.marketCap, "CZK", true) : "—" },
                  { label: "P/E Ratio", value: detailPrice.pe ? detailPrice.pe.toFixed(1) : "—" },
                  { label: "Dividend Yield", value: detailPrice.dividendYield ? `${(detailPrice.dividendYield * 100).toFixed(2)}%` : "—" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ padding: "0.6rem 0.8rem", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--card-border)" }}>
                    <div style={{ fontSize: "0.65rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.25rem" }}>{label}</div>
                    <div style={{ fontSize: "0.9rem", fontWeight: 700, color: color ?? "var(--foreground)" }}>{value}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => { setDetailTicker(null); setChartTicker(detailTicker); setChartDays(30); }}>
                📈 Chart
              </button>
              <button className="btn-ghost" onClick={() => setDetailTicker(null)}>Zavřít</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Add / Edit Holding modal ── */}
      {showAddModal && (
        <Modal title={editingId ? "Upravit Stock / ETF" : "Přidat Stock / ETF"} onClose={() => { setShowAddModal(false); setForm(emptyForm); setEditingId(null); setSearchResults([]); }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* Ticker with autocomplete */}
            <div style={{ position: "relative" }}>
              <FormField label="Ticker (AAPL, CEZ.PR, VUSA.L…)" name="ticker" value={form.ticker}
                onChange={handleFormChange} placeholder="AAPL" required />
              {searchLoading && (
                <div style={{ position: "absolute", right: "0.75rem", top: "2rem", color: "var(--muted)", fontSize: "0.75rem" }}>⏳</div>
              )}
              {searchResults.length > 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                  background: "#1e2435", border: "1px solid var(--card-border)", borderRadius: "8px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden", marginTop: "2px",
                }}>
                  {searchResults.map((r) => (
                    <button key={r.symbol} type="button"
                      onClick={() => handleSelectSearchResult(r)}
                      style={{
                        display: "flex", width: "100%", padding: "0.6rem 0.85rem",
                        background: "none", border: "none", cursor: "pointer",
                        alignItems: "center", gap: "0.6rem", textAlign: "left",
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                    >
                      <span style={{ fontWeight: 700, color: "var(--yellow)", fontFamily: "monospace", fontSize: "0.85rem", minWidth: "60px" }}>{r.symbol}</span>
                      <span style={{ fontSize: "0.8rem", color: "var(--foreground)" }}>{r.name}</span>
                      <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--muted)" }}>{r.exchange}</span>
                      {r.quoteType === "ETF" && (
                        <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "0 4px", borderRadius: "3px", background: "rgba(99,102,241,0.2)", color: "#6366f1" }}>ETF</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <FormField label="Název společnosti / ETF" name="name" value={form.name}
              onChange={handleFormChange} placeholder="Apple Inc." required />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <FormField label="Počet akcií / jednotek" name="shares" type="number"
                value={form.shares} onChange={handleFormChange}
                placeholder="10" step="any" min="0" required />
              <FormField label="Měna" name="currency" value={form.currency}
                onChange={handleFormChange}
                options={[
                  { value: "USD", label: "USD" }, { value: "EUR", label: "EUR" },
                  { value: "CZK", label: "CZK" }, { value: "GBP", label: "GBP" },
                  { value: "CHF", label: "CHF" }, { value: "PLN", label: "PLN" },
                ]} />
            </div>

            <FormField label={`Průměrná nákupní cena (${form.currency} / ks) — volitelné`}
              name="buyPrice" type="number" value={form.buyPrice}
              onChange={handleFormChange} placeholder="150.00" step="any" min="0" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <FormField label="Burza — volitelné" name="exchange" value={form.exchange}
                onChange={handleFormChange} options={EXCHANGE_OPTIONS} />
              <FormField label="Sektor — volitelné" name="sector" value={form.sector}
                onChange={handleFormChange} options={SECTOR_OPTIONS} />
            </div>

            <FormField label="Poznámky" name="notes" type="textarea" value={form.notes}
              onChange={handleFormChange} placeholder="Nepovinné…" rows={2} />

            {/* Live preview */}
            {form.ticker && prices[form.ticker.toUpperCase()] && form.shares && parseFloat(form.shares) > 0 && (() => {
              const p = prices[form.ticker.toUpperCase()];
              const val = parseFloat(form.shares) * p.czk;
              const buyPnl = form.buyPrice && parseFloat(form.buyPrice) > 0
                ? val - parseFloat(form.shares) * parseFloat(form.buyPrice) * (p.czk / p.originalPrice)
                : null;
              return (
                <div style={{ padding: "0.75rem", borderRadius: "8px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", fontSize: "0.85rem" }}>
                  💡 Aktuální hodnota: <strong>{formatCurrency(val, "CZK")}</strong>
                  {buyPnl !== null && (
                    <span style={{ marginLeft: "0.75rem", color: buyPnl >= 0 ? "var(--green)" : "#ef4444" }}>
                      · P&L: {(buyPnl >= 0 ? "+" : "") + formatCurrency(buyPnl, "CZK")}
                    </span>
                  )}
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                    {p.name} · {formatCurrency(p.originalPrice, p.originalCurrency)} · {formatPercent(p.change24h)} dnes
                  </div>
                </div>
              );
            })()}

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <button type="button" className="btn-ghost" onClick={() => { setShowAddModal(false); setForm(emptyForm); setEditingId(null); setSearchResults([]); }}>Zrušit</button>
              <button type="submit" className="btn-primary">{editingId ? "Uložit změny" : "Přidat"}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Alerts modal ── */}
      {showAlertsModal && (
        <Modal title="🔔 Price Alerty" onClose={() => setShowAlertsModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <form onSubmit={handleAddAlert} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Nový alert</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginBottom: "0.3rem" }}>Ticker</label>
                  <input value={alertForm.ticker}
                    onChange={(e) => setAlertForm((f) => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                    placeholder="AAPL" required />
                </div>
                <div>
                  <label style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginBottom: "0.3rem" }}>Podmínka</label>
                  <select value={alertForm.direction}
                    onChange={(e) => setAlertForm((f) => ({ ...f, direction: e.target.value as "above" | "below" }))}>
                    <option value="above">↑ Nad</option>
                    <option value="below">↓ Pod</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginBottom: "0.3rem" }}>Hranice (CZK)</label>
                  <input type="number" value={alertForm.threshold}
                    onChange={(e) => setAlertForm((f) => ({ ...f, threshold: e.target.value }))}
                    placeholder="3 500" required step="any" min="0" />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="btn-primary" style={{ fontSize: "0.82rem" }}>+ Přidat alert</button>
              </div>
            </form>

            <div style={{ borderTop: "1px solid var(--card-border)" }} />

            {alerts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "1rem", color: "var(--muted)", fontSize: "0.85rem" }}>Žádné alerty</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Aktivní alerty</div>
                {alerts.map((alert) => {
                  const current = prices[alert.ticker]?.czk;
                  const fired = current !== undefined && (
                    alert.direction === "above" ? current > alert.threshold : current < alert.threshold
                  );
                  return (
                    <div key={alert.id} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "0.65rem 0.9rem", borderRadius: "8px",
                      background: fired ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${fired ? "rgba(245,158,11,0.3)" : "var(--card-border)"}`,
                      fontSize: "0.82rem",
                    }}>
                      <span>
                        {fired && "🔔 "}
                        <strong>{alert.ticker}</strong>{" "}
                        {alert.direction === "above" ? "↑ nad" : "↓ pod"}{" "}
                        <strong>{formatCurrency(alert.threshold, "CZK")}</strong>
                        {current !== undefined && (
                          <span style={{ color: "var(--muted)", marginLeft: "0.5rem" }}>
                            · nyní: {formatCurrency(current, "CZK")}
                          </span>
                        )}
                      </span>
                      <button onClick={() => handleDeleteAlert(alert.id)}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "0 0.25rem", fontSize: "0.9rem" }}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
