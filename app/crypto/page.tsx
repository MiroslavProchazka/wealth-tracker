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

// ── Coin avatar ───────────────────────────────────────────────────────────────

const COIN_COLORS: Record<string, string> = {
  BTC: "#f7931a", ETH: "#627eea", SOL: "#9945ff", BNB: "#f0b90b",
  ADA: "#0033ad", XRP: "#346aa9", DOT: "#e6007a", MATIC: "#8247e5",
  LINK: "#2a5ada", UNI: "#ff007a", AVAX: "#e84142", ATOM: "#2e3148",
  LTC: "#bfbbbb", USDT: "#26a17b", USDC: "#2775ca", DOGE: "#c2a633",
};

function coinColor(symbol: string): string {
  if (COIN_COLORS[symbol]) return COIN_COLORS[symbol];
  // deterministic color from symbol string
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 50%)`;
}

function CoinAvatar({ symbol, size = 26 }: { symbol: string; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const src = `/crypto-icons/${symbol.toLowerCase()}.png`;
  const bg = coinColor(symbol);
  const label = symbol.length <= 3 ? symbol : symbol.slice(0, 2);

  if (!imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={symbol}
        width={size}
        height={size}
        onError={() => setImgError(true)}
        style={{ borderRadius: "50%", flexShrink: 0, objectFit: "contain" }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size <= 26 ? "0.55rem" : "0.7rem",
      fontWeight: 800, color: "white", letterSpacing: "-0.02em",
    }}>
      {label}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PriceData {
  czk: number;
  usd: number;
  eur: number;
  change24h: number;
  name: string;
}

interface PriceAlert {
  id: string;
  symbol: string;
  direction: "above" | "below";
  threshold: number; // always in CZK
}

type DisplayCurrency = "CZK" | "USD" | "EUR";

const CURRENCY_KEY: Record<DisplayCurrency, keyof PriceData> = {
  CZK: "czk",
  USD: "usd",
  EUR: "eur",
};

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const ALERTS_STORAGE_KEY = "wealthTracker_cryptoAlerts";
const emptyForm = { symbol: "", name: "", amount: "", buyPrice: "", notes: "" };
const emptyAlert: { symbol: string; direction: "above" | "below"; threshold: string } = { symbol: "", direction: "above", threshold: "" };

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAlerts(): PriceAlert[] {
  try {
    return JSON.parse(localStorage.getItem(ALERTS_STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveAlerts(alerts: PriceAlert[]) {
  localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
}

const ALLOCATION_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6",
  "#ef4444", "#06b6d4", "#f97316", "#ec4899",
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function CryptoPage() {
  const evolu = useEvolu();

  // Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [nameLookupLoading, setNameLookupLoading] = useState(false);

  // Price state
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Display currency toggle
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("CZK");

  // Chart state
  const [chartSymbol, setChartSymbol] = useState<string | null>(null);
  const [chartDays, setChartDays] = useState(30);
  const [chartData, setChartData] = useState<{ date: string; price: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  // Alerts state
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [firedAlerts, setFiredAlerts] = useState<PriceAlert[]>([]);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [alertForm, setAlertForm] = useState(emptyAlert);

  // Load alerts from localStorage on mount
  useEffect(() => {
    setAlerts(getAlerts());
  }, []);

  // ── Query holdings ───────────────────────────────────────────────────────────
  const query = useMemo(() =>
    evolu.createQuery((db) =>
      db.selectFrom("cryptoHolding").selectAll()
        .where("isDeleted", "is not", Evolu.sqliteTrue)
        .where("deleted", "is not", Evolu.sqliteTrue)
        .orderBy("createdAt", "desc")
    ), [evolu]);
  const holdings = useQuery(query);

  // ── Fetch live prices ────────────────────────────────────────────────────────
  const fetchPrices = useCallback(async () => {
    if (holdings.length === 0) return;
    const symbols = [...new Set(holdings.map((h) => h.symbol as string))].join(",");
    setPricesLoading(true);
    setPricesError(null);
    try {
      const res = await fetch(`/api/crypto/prices?symbols=${encodeURIComponent(symbols)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const newPrices: Record<string, PriceData> = data.prices ?? {};
      setPrices(newPrices);
      setLastUpdated(new Date());

      // Check alerts
      const currentAlerts = getAlerts();
      const fired = currentAlerts.filter((alert) => {
        const p = newPrices[alert.symbol]?.czk;
        if (!p) return false;
        return alert.direction === "above" ? p > alert.threshold : p < alert.threshold;
      });
      setFiredAlerts(fired);
    } catch (err) {
      setPricesError(err instanceof Error ? err.message : "Failed to fetch prices");
    } finally {
      setPricesLoading(false);
    }
  }, [holdings]);

  useEffect(() => { fetchPrices(); }, [fetchPrices]);

  useEffect(() => {
    const id = setInterval(fetchPrices, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchPrices]);

  useEffect(() => {
    const onFocus = () => fetchPrices();
    const onVisibility = () => { if (document.visibilityState === "visible") fetchPrices(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchPrices]);

  // ── Fetch chart history ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartSymbol) return;
    setChartLoading(true);
    setChartData([]);
    const currency = displayCurrency.toLowerCase();
    fetch(`/api/crypto/history?symbol=${chartSymbol}&days=${chartDays}&currency=${currency}`)
      .then((r) => r.json())
      .then((d) => setChartData(d.points ?? []))
      .catch(() => setChartData([]))
      .finally(() => setChartLoading(false));
  }, [chartSymbol, chartDays, displayCurrency]);

  // ── Auto-fill coin name from symbol ─────────────────────────────────────────
  const symbolDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSymbolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    setForm((f) => ({ ...f, symbol: val }));
    if (symbolDebounceRef.current) clearTimeout(symbolDebounceRef.current);
    if (!val) return;
    symbolDebounceRef.current = setTimeout(async () => {
      setNameLookupLoading(true);
      try {
        const res = await fetch(`/api/crypto/search?symbol=${encodeURIComponent(val)}`);
        const data = await res.json();
        if (data.name) setForm((f) => ({ ...f, name: data.name }));
      } catch { /* silent */ }
      finally { setNameLookupLoading(false); }
    }, 500);
  };

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    if (e.target.name === "symbol") {
      handleSymbolChange(e as React.ChangeEvent<HTMLInputElement>);
    } else {
      setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = evolu.insert("cryptoHolding", {
      symbol: form.symbol.toUpperCase().trim(),
      name: form.name.trim(),
      amount: parseFloat(form.amount),
      buyPrice: form.buyPrice ? parseFloat(form.buyPrice) : null,
      notes: form.notes.trim() || null,
      deleted: Evolu.sqliteFalse,
    } as never);
    if (result.ok) {
      setForm(emptyForm);
      setShowAddModal(false);
    }
  }

  function handleDelete(id: string) {
    if (!confirm("Smazat tento holding?")) return;
    evolu.update("cryptoHolding", { id: id as never, deleted: Evolu.sqliteTrue } as never);
  }

  // ── Alerts CRUD ──────────────────────────────────────────────────────────────
  function handleAddAlert(e: React.FormEvent) {
    e.preventDefault();
    const newAlert: PriceAlert = {
      id: `${Date.now()}`,
      symbol: alertForm.symbol.toUpperCase().trim(),
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

  // ── Computed values ──────────────────────────────────────────────────────────
  const enriched = holdings.map((h) => {
    const symbol = h.symbol as string;
    const coins = h.amount as number;
    const buyPricePerCoin = (h.buyPrice as number | null) ?? null;
    const price = prices[symbol];
    const currentCzk = price ? coins * price.czk : null;
    const currentUsd = price ? coins * price.usd : null;
    const currentEur = price ? coins * price.eur : null;
    const costBasis = buyPricePerCoin !== null ? coins * buyPricePerCoin : null;
    const pnlCzk = currentCzk !== null && costBasis !== null ? currentCzk - costBasis : null;
    const pnlPct = pnlCzk !== null && costBasis && costBasis > 0 ? (pnlCzk / costBasis) * 100 : null;
    const currentInDisplay =
      displayCurrency === "CZK" ? currentCzk :
      displayCurrency === "USD" ? currentUsd :
      currentEur;
    return { ...h, symbol, coins, price, buyPricePerCoin, currentCzk, currentUsd, currentEur, costBasis, pnlCzk, pnlPct, currentInDisplay };
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
      symbol: h.symbol,
      value: h.currentCzk!,
      pct: totalCzk > 0 ? (h.currentCzk! / totalCzk) * 100 : 0,
      color: ALLOCATION_COLORS[i % ALLOCATION_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

  // ── Render ────────────────────────────────────────────────────────────────────
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
            🔔 <strong>{alert.symbol}</strong> je{" "}
            {alert.direction === "above" ? "nad" : "pod"} hranicí{" "}
            <strong>{formatCurrency(alert.threshold, "CZK")}</strong>
            {prices[alert.symbol] && (
              <span style={{ color: "var(--muted)", marginLeft: "0.5rem" }}>
                · nyní {formatCurrency(prices[alert.symbol].czk, "CZK")}
              </span>
            )}
          </span>
          <button onClick={() => setFiredAlerts((f) => f.filter((a) => a.id !== alert.id))}
            style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "1.1rem" }}>×</button>
        </div>
      ))}

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>Crypto Holdings</h1>
          <p style={{ color: "var(--muted)", margin: "0.35rem 0 0", fontSize: "0.875rem" }}>
            Live ceny CoinGecko · refresh každých 10 min
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
          <button className="btn-ghost" onClick={fetchPrices} disabled={pricesLoading}
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="card" style={{ background: "linear-gradient(135deg, #1a1f2e 0%, #1e2a1e 100%)", borderColor: "rgba(16,185,129,0.3)" }}>
          <div style={{ fontSize: "0.68rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>Celkem</div>
          <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--green)" }}>
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
              <div key={a.symbol}
                style={{ width: `${a.pct}%`, background: a.color, transition: "width 0.4s ease", cursor: "pointer" }}
                title={`${a.symbol}: ${a.pct.toFixed(1)}%`}
                onClick={() => { setChartSymbol(a.symbol); setChartDays(30); }}
              />
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
            {allocations.map((a) => (
              <div key={a.symbol}
                style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.78rem", cursor: "pointer" }}
                onClick={() => { setChartSymbol(a.symbol); setChartDays(30); }}
              >
                <div style={{ width: "9px", height: "9px", borderRadius: "2px", background: a.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{a.symbol}</span>
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
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>₿</div>
            <p style={{ margin: 0, fontWeight: 500 }}>Žádné crypto pozice</p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem" }}>Přidej první holding tlačítkem výše</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Coin</th>
                <th style={{ textAlign: "right" }}>Množství</th>
                <th style={{ textAlign: "right" }}>Nákup / ks (CZK)</th>
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
                const priceInDisplay = h.price ? (h.price[CURRENCY_KEY[displayCurrency]] as number) : null;
                return (
                  <tr key={h.id as string}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <CoinAvatar symbol={h.symbol} size={26} />
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--yellow)", fontFamily: "monospace", fontSize: "0.88rem" }}>{h.symbol}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{h.name as string}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: "0.88rem" }}>
                      {h.coins.toLocaleString("cs-CZ", { maximumFractionDigits: 8 })}
                    </td>
                    <td style={{ textAlign: "right", color: "var(--muted)", fontSize: "0.82rem" }}>
                      {h.buyPricePerCoin !== null ? formatCurrency(h.buyPricePerCoin, "CZK") : <span style={{ opacity: 0.35 }}>—</span>}
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
                          onClick={() => { setChartSymbol(h.symbol); setChartDays(30); }}
                          title="Historický chart"
                          style={{ background: "none", border: "1px solid var(--card-border)", borderRadius: "6px", padding: "0.3rem 0.5rem", cursor: "pointer", color: "var(--muted)", fontSize: "0.8rem" }}
                        >📈</button>
                        <button className="btn-danger" onClick={() => handleDelete(h.id as string)}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Chart modal ── */}
      {chartSymbol && (
        <Modal
          title={`${chartSymbol}${prices[chartSymbol] ? ` — ${prices[chartSymbol].name}` : ""} · ${chartDays}d (${displayCurrency})`}
          onClose={() => setChartSymbol(null)}
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
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#10b981" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)" }}>Žádná historická data</div>
          )}
        </Modal>
      )}

      {/* ── Add Holding modal ── */}
      {showAddModal && (
        <Modal title="Přidat Crypto Holding" onClose={() => { setShowAddModal(false); setForm(emptyForm); }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ position: "relative" }}>
              <FormField label="Symbol (BTC, ETH…)" name="symbol" value={form.symbol}
                onChange={handleFormChange} placeholder="BTC" required />
            </div>
            <div style={{ position: "relative" }}>
              <FormField label="Název" name="name" value={form.name}
                onChange={handleFormChange} placeholder={nameLookupLoading ? "Hledám…" : "Bitcoin"} required />
              {nameLookupLoading && (
                <div style={{ position: "absolute", right: "0.75rem", top: "2rem", color: "var(--muted)", fontSize: "0.75rem" }}>⏳</div>
              )}
            </div>
            <FormField label="Počet kusů" name="amount" type="number" value={form.amount}
              onChange={handleFormChange} placeholder="0.5" step="any" min="0" required />
            <FormField label="Průměrná nákupní cena (CZK / ks) — volitelné" name="buyPrice"
              type="number" value={form.buyPrice} onChange={handleFormChange}
              placeholder="2 500 000" step="any" min="0" />
            <FormField label="Poznámky" name="notes" type="textarea" value={form.notes}
              onChange={handleFormChange} placeholder="Nepovinné…" rows={2} />

            {/* Live preview */}
            {form.symbol && prices[form.symbol.toUpperCase()] && form.amount && parseFloat(form.amount) > 0 && (
              <div style={{ padding: "0.75rem", borderRadius: "8px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", fontSize: "0.85rem" }}>
                💡 Aktuální hodnota:{" "}
                <strong>{formatCurrency(parseFloat(form.amount) * prices[form.symbol.toUpperCase()].czk, "CZK")}</strong>
                {form.buyPrice && parseFloat(form.buyPrice) > 0 && (() => {
                  const pnl = parseFloat(form.amount) * prices[form.symbol.toUpperCase()].czk
                    - parseFloat(form.amount) * parseFloat(form.buyPrice);
                  return (
                    <span style={{ marginLeft: "0.75rem", color: pnl >= 0 ? "var(--green)" : "#ef4444" }}>
                      · P&L: {(pnl >= 0 ? "+" : "") + formatCurrency(pnl, "CZK")}
                    </span>
                  );
                })()}
              </div>
            )}

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <button type="button" className="btn-ghost" onClick={() => { setShowAddModal(false); setForm(emptyForm); }}>Zrušit</button>
              <button type="submit" className="btn-primary">Přidat</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Alerts modal ── */}
      {showAlertsModal && (
        <Modal title="🔔 Price Alerty" onClose={() => setShowAlertsModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Add alert form */}
            <form onSubmit={handleAddAlert} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Nový alert</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.78rem", color: "var(--muted)", display: "block", marginBottom: "0.3rem" }}>Symbol</label>
                  <input value={alertForm.symbol}
                    onChange={(e) => setAlertForm((f) => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                    placeholder="BTC" required />
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
                    placeholder="2 500 000" required step="any" min="0" />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="btn-primary" style={{ fontSize: "0.82rem" }}>+ Přidat alert</button>
              </div>
            </form>

            <div style={{ borderTop: "1px solid var(--card-border)" }} />

            {/* Alert list */}
            {alerts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "1rem", color: "var(--muted)", fontSize: "0.85rem" }}>Žádné alerty</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Aktivní alerty</div>
                {alerts.map((alert) => {
                  const current = prices[alert.symbol]?.czk;
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
                        <strong>{alert.symbol}</strong>{" "}
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
