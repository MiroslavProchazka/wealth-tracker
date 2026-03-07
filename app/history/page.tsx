"use client";
import { useEffect, useMemo, useState } from "react";
import * as Evolu from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEvolu } from "@/lib/evolu";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";
import { formatCurrency } from "@/lib/currencies";

export default function HistoryPage() {
  const evolu = useEvolu();
  const [snapping, setSnapping] = useState(false);
  const [view, setView] = useState<"networth" | "breakdown">("networth");
  const [autoSnapped, setAutoSnapped] = useState(false);
  const [autoSnapshotMsg, setAutoSnapshotMsg] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  // Include symbol/ticker so we can look up live prices
  const cryptoQ = useMemo(() => evolu.createQuery((db) => db.selectFrom("cryptoHolding").select(["symbol", "amount"]).where("isDeleted", "is not", Evolu.sqliteTrue).where("deleted", "is not", Evolu.sqliteTrue)), [evolu]);
  const stockQ = useMemo(() => evolu.createQuery((db) => db.selectFrom("stockHolding").select(["ticker", "shares", "currency"]).where("isDeleted", "is not", Evolu.sqliteTrue).where("deleted", "is not", Evolu.sqliteTrue)), [evolu]);
  const propertyQ = useMemo(() => evolu.createQuery((db) => db.selectFrom("property").select(["estimatedValue", "remainingLoan"]).where("isDeleted", "is not", Evolu.sqliteTrue).where("deleted", "is not", Evolu.sqliteTrue)), [evolu]);
  const savingsQ = useMemo(() => evolu.createQuery((db) => db.selectFrom("savingsAccount").select(["balance"]).where("isDeleted", "is not", Evolu.sqliteTrue).where("deleted", "is not", Evolu.sqliteTrue)), [evolu]);
  const recQ = useMemo(() => evolu.createQuery((db) => db.selectFrom("receivable").select(["amount", "status"]).where("isDeleted", "is not", Evolu.sqliteTrue).where("deleted", "is not", Evolu.sqliteTrue)), [evolu]);
  const snapshotQ = useMemo(() => evolu.createQuery((db) => db.selectFrom("netWorthSnapshot").selectAll().where("isDeleted", "is not", Evolu.sqliteTrue).where("deleted", "is not", Evolu.sqliteTrue).orderBy("snapshotDate", "asc")), [evolu]);

  const cryptos = useQuery(cryptoQ);
  const stocks = useQuery(stockQ);
  const properties = useQuery(propertyQ);
  const savings = useQuery(savingsQ);
  const receivables = useQuery(recQ);
  const snapshots = useQuery(snapshotQ);

  // ── Live prices (same pattern as dashboard) ───────────────────────────────
  const [cryptoPrices, setCryptoPrices] = useState<Record<string, { czk: number }>>({});
  const [stockPrices, setStockPrices] = useState<Record<string, { czk: number }>>({});
  const [cryptoPricesLoaded, setCryptoPricesLoaded] = useState(false);
  const [stockPricesLoaded, setStockPricesLoaded] = useState(false);
  const pricesLoaded = cryptoPricesLoaded && stockPricesLoaded;

  useEffect(() => {
    const symbols = cryptos.map((c) => (c.symbol as string).toUpperCase()).filter(Boolean);
    if (symbols.length === 0) { setCryptoPricesLoaded(true); return; }
    fetch(`/api/crypto/prices?symbols=${encodeURIComponent(symbols.join(","))}`)
      .then((r) => r.json())
      .then((d) => { if (d.prices) setCryptoPrices(d.prices); })
      .catch(() => {})
      .finally(() => setCryptoPricesLoaded(true));
  }, [cryptos]);

  useEffect(() => {
    const tickers = stocks.map((s) => (s.ticker as string).toUpperCase()).filter(Boolean);
    if (tickers.length === 0) { setStockPricesLoaded(true); return; }
    fetch(`/api/stocks/prices?tickers=${encodeURIComponent(tickers.join(","))}`)
      .then((r) => r.json())
      .then((d) => { if (d.prices) setStockPrices(d.prices); })
      .catch(() => {})
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
      schemaVersion: 1 as never,
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
    const hasAssets = cryptos.length > 0 || stocks.length > 0 || properties.length > 0 || savings.length > 0;
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
        setAutoSnapshotMsg(`Weekly snapshot taken automatically (last was ${Math.floor(daysSince)} days ago)`);
        setTimeout(() => setAutoSnapshotMsg(null), 6000);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricesLoaded, snapshots.length, autoSnapped]);

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData = snapshots.map((s) => ({
    date: new Date(String(s.snapshotDate)).toLocaleDateString("cs-CZ", { day: "2-digit", month: "short", year: "2-digit" }),
    "Net Worth": Math.round(s.netWorth as number),
    "Assets": Math.round(s.totalAssets as number),
    "Liabilities": Math.round(s.totalLiabilities as number),
    Crypto: Math.round(s.cryptoValue as number),
    Stocks: Math.round(s.stocksValue as number),
    Property: Math.round(s.propertyValue as number),
    Savings: Math.round(s.savingsValue as number),
    Receivables: Math.round(s.receivablesValue as number),
  }));

  const firstSnapshot = snapshots[0];
  const totalChange = firstSnapshot ? currentNetWorth - (firstSnapshot.netWorth as number) : 0;

  return (
    <div>
      {autoSnapshotMsg && (
        <div style={{ background: "var(--surface-2)", border: "1px solid var(--accent)", borderRadius: "8px", padding: "0.6rem 1rem", marginBottom: "1rem", fontSize: "0.8rem", color: "var(--accent)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          📸 {autoSnapshotMsg}
        </div>
      )}

      <div className="page-header-row" style={{ marginBottom: "2rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>History & Charts</h1>
          <p style={{ color: "var(--muted)", margin: "0.35rem 0 0", fontSize: "0.875rem" }}>Net worth over time · {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""} · auto-snapshot weekly</p>
        </div>
        <button className="btn-primary" onClick={takeSnapshot} disabled={snapping || !pricesLoaded}>{snapping ? "Saving…" : !pricesLoaded ? "Loading prices…" : "📸 Take Snapshot"}</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Current Net Worth", value: formatCurrency(currentNetWorth, "CZK"), color: "var(--accent)" },
          { label: "Total Change", value: (totalChange >= 0 ? "+" : "") + formatCurrency(totalChange, "CZK"), color: totalChange >= 0 ? "var(--green)" : "var(--red)" },
          { label: "Since", value: firstSnapshot ? new Date(String(firstSnapshot.snapshotDate)).toLocaleDateString("cs-CZ") : "—", color: "var(--muted)" },
          { label: "Snapshots", value: String(snapshots.length), color: "var(--muted)" },
        ].map((s) => (
          <div key={s.label} className="card">
            <div style={{ fontSize: "0.65rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>{s.label}</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        {(["networth", "breakdown"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} style={{ padding: "0.4rem 1rem", borderRadius: "6px", border: "1px solid var(--card-border)", background: view === v ? "var(--accent)" : "transparent", color: view === v ? "white" : "var(--muted)", cursor: "pointer", fontSize: "0.8rem", fontWeight: 500 }}>
            {v === "networth" ? "Net Worth" : "Asset Breakdown"}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        {snapshots.length < 2 ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--muted)" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📊</div>
            <p>Take at least 2 snapshots to see charts.</p>
            <p style={{ fontSize: "0.8rem" }}>Click &quot;Take Snapshot&quot; to record today&apos;s values.</p>
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
              <Area type="monotone" dataKey="Assets" stroke="#10b981" fill="url(#assetsGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="Net Worth" stroke="#3b82f6" fill="url(#netWorthGrad)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
              <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: "8px" }} formatter={(value: number | undefined, name: string | undefined) => [formatCurrency(value ?? 0, "CZK"), name ?? ""]} />
              <Legend wrapperStyle={{ color: "#64748b", fontSize: "0.8rem" }} />
              <Bar dataKey="Property" stackId="a" fill="#8b5cf6" radius={[0,0,0,0]} />
              <Bar dataKey="Savings" stackId="a" fill="#10b981" />
              <Bar dataKey="Stocks" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Crypto" stackId="a" fill="#f97316" />
              <Bar dataKey="Receivables" stackId="a" fill="#06b6d4" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {snapshots.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--card-border)", fontWeight: 700, fontSize: "0.9rem" }}>Snapshot History</div>
          <div className="table-scroll">
          <table>
            <thead><tr><th>Date</th><th>Net Worth</th><th>Assets</th><th>Liabilities</th><th>Change</th></tr></thead>
            <tbody>
              {[...snapshots].reverse().map((snap, idx, arr) => {
                const prev = arr[idx + 1];
                const change = prev ? (snap.netWorth as number) - (prev.netWorth as number) : null;
                return (
                  <tr key={snap.id as string}>
                    <td style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{new Date(String(snap.snapshotDate)).toLocaleDateString("cs-CZ", { dateStyle: "medium" })}</td>
                    <td style={{ fontWeight: 700 }}>{formatCurrency(snap.netWorth as number, "CZK")}</td>
                    <td style={{ color: "var(--green)" }}>{formatCurrency(snap.totalAssets as number, "CZK")}</td>
                    <td style={{ color: "var(--red)" }}>{formatCurrency(snap.totalLiabilities as number, "CZK")}</td>
                    <td style={{ color: change === null ? "var(--muted)" : change >= 0 ? "var(--green)" : "var(--red)", fontSize: "0.85rem" }}>
                      {change === null ? "—" : (change >= 0 ? "+" : "") + formatCurrency(change, "CZK")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
