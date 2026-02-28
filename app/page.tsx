"use client";

import { useEffect, useMemo, useState } from "react";
import * as Evolu from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEvolu } from "@/lib/evolu";
import { formatCurrency } from "@/lib/currencies";
import StatCard from "@/components/StatCard";
import Link from "next/link";

export default function Dashboard() {
  const evolu = useEvolu();

  // ── Queries ────────────────────────────────────────────────────────────────
  const cryptoQ = useMemo(() => evolu.createQuery((db) => db
    .selectFrom("cryptoHolding")
    .select(["symbol", "amount"])
    .where("isDeleted", "is not", Evolu.sqliteTrue)
    .where("deleted", "is not", Evolu.sqliteTrue)
  ), [evolu]);
  const stockQ = useMemo(() => evolu.createQuery((db) => db
    .selectFrom("stockHolding")
    .select(["ticker", "shares", "currency"])
    .where("isDeleted", "is not", Evolu.sqliteTrue)
    .where("deleted", "is not", Evolu.sqliteTrue)
  ), [evolu]);
  const propertyQ = useMemo(() => evolu.createQuery((db) => db
    .selectFrom("property")
    .select(["estimatedValue", "remainingLoan"])
    .where("isDeleted", "is not", Evolu.sqliteTrue)
    .where("deleted", "is not", Evolu.sqliteTrue)
  ), [evolu]);
  const receivableQ = useMemo(() => evolu.createQuery((db) => db
    .selectFrom("receivable")
    .select(["amount", "status"])
    .where("isDeleted", "is not", Evolu.sqliteTrue)
    .where("deleted", "is not", Evolu.sqliteTrue)
  ), [evolu]);
  const savingsQ = useMemo(() => evolu.createQuery((db) => db
    .selectFrom("savingsAccount")
    .select(["balance"])
    .where("isDeleted", "is not", Evolu.sqliteTrue)
    .where("deleted", "is not", Evolu.sqliteTrue)
  ), [evolu]);
  const bankQ = useMemo(() => evolu.createQuery((db) => db
    .selectFrom("bankAccount")
    .select(["balance"])
    .where("isDeleted", "is not", Evolu.sqliteTrue)
    .where("deleted", "is not", Evolu.sqliteTrue)
  ), [evolu]);
  const snapshotQ = useMemo(() => evolu.createQuery((db) => db
    .selectFrom("netWorthSnapshot")
    .select(["netWorth"])
    .where("isDeleted", "is not", Evolu.sqliteTrue)
    .where("deleted", "is not", Evolu.sqliteTrue)
    .orderBy("snapshotDate", "desc")
    .limit(2)
  ), [evolu]);

  const clockifyRatesQ = useMemo(() => evolu.createQuery((db) => db
    .selectFrom("clockifyProjectRate")
    .select(["clockifyProjectId", "hourlyRate", "currency", "initialEarnings"])
    .where("isDeleted", "is not", Evolu.sqliteTrue)
    .where("deleted", "is not", Evolu.sqliteTrue)
  ), [evolu]);
  const clockifyEarningsQ = useMemo(() => evolu.createQuery((db) => db
    .selectFrom("clockifyMonthlyEarnings")
    .select(["clockifyProjectId", "hours"])
    .where("isDeleted", "is not", Evolu.sqliteTrue)
    .where("deleted", "is not", Evolu.sqliteTrue)
  ), [evolu]);
  const clockifyInvoicedQ = useMemo(() => evolu.createQuery((db) => db
    .selectFrom("clockifyInvoicedPeriod")
    .select(["clockifyProjectId", "amount", "currency"])
    .where("isDeleted", "is not", Evolu.sqliteTrue)
    .where("deleted", "is not", Evolu.sqliteTrue)
  ), [evolu]);

  const cryptos          = useQuery(cryptoQ);
  const stocks           = useQuery(stockQ);
  const properties       = useQuery(propertyQ);
  const receivables      = useQuery(receivableQ);
  const savings          = useQuery(savingsQ);
  const accounts         = useQuery(bankQ);
  const snapshots        = useQuery(snapshotQ);
  const clockifyRates    = useQuery(clockifyRatesQ);
  const clockifyEarnings = useQuery(clockifyEarningsQ);
  const clockifyInvoiced = useQuery(clockifyInvoicedQ);

  // ── Live prices ────────────────────────────────────────────────────────────
  const [cryptoPrices, setCryptoPrices] = useState<Record<string, { czk: number }>>({});
  const [stockPrices,  setStockPrices]  = useState<Record<string, { czk: number }>>({});

  useEffect(() => {
    const symbols = cryptos.map((c) => (c.symbol as string).toUpperCase()).filter(Boolean);
    if (symbols.length === 0) return;
    fetch(`/api/crypto/prices?symbols=${encodeURIComponent(symbols.join(","))}`)
      .then((r) => r.json())
      .then((d) => { if (d.prices) setCryptoPrices(d.prices); })
      .catch(() => {/* silently ignore – fall back to 0 */});
  }, [cryptos.length]); // re-fetch when holdings change

  useEffect(() => {
    const tickers = stocks.map((s) => (s.ticker as string).toUpperCase()).filter(Boolean);
    if (tickers.length === 0) return;
    fetch(`/api/stocks/prices?tickers=${encodeURIComponent(tickers.join(","))}`)
      .then((r) => r.json())
      .then((d) => { if (d.prices) setStockPrices(d.prices); })
      .catch(() => {/* silently ignore – fall back to 0 */});
  }, [stocks.length]); // re-fetch when holdings change

  // ── Computed values ────────────────────────────────────────────────────────
  // Crypto: amount × live CZK price
  const cryptoValue = cryptos.reduce((s, c) => {
    const symbol = (c.symbol as string).toUpperCase();
    const price  = cryptoPrices[symbol]?.czk ?? 0;
    return s + (c.amount as number) * price;
  }, 0);

  // Stocks: shares × live CZK price (API already converts to CZK)
  const stocksValue = stocks.reduce((s, st) => {
    const ticker = (st.ticker as string).toUpperCase();
    const price  = stockPrices[ticker]?.czk ?? 0;
    return s + (st.shares as number) * price;
  }, 0);

  const propertyValue    = properties.reduce((s, p) => s + (p.estimatedValue as number), 0);
  const mortgageDebt     = properties.reduce((s, p) => s + ((p.remainingLoan as number) ?? 0), 0);
  const receivablesValue = receivables
    .filter((r) => String(r.status) !== "PAID")
    .reduce((s, r) => s + (r.amount as number), 0);
  const savingsValue     = savings.reduce((s, sv) => s + (sv.balance as number), 0);
  const bankValue        = accounts.reduce((s, a) => s + (a.balance as number), 0);

  // Unfactured (nevyfakturováno): total earned minus total invoiced across all Clockify projects
  const unfacturedValue = (() => {
    const rateMap: Record<string, { hourlyRate: number; currency: string; initialEarnings: number }> = {};
    for (const r of clockifyRates) {
      rateMap[r.clockifyProjectId as string] = {
        hourlyRate:      r.hourlyRate as number,
        currency:        r.currency as string,
        initialEarnings: (r.initialEarnings as number | null) ?? 0,
      };
    }
    const totalHoursMap: Record<string, number> = {};
    for (const e of clockifyEarnings) {
      const pid = e.clockifyProjectId as string;
      totalHoursMap[pid] = (totalHoursMap[pid] ?? 0) + (e.hours as number);
    }
    const totalInvoicedMap: Record<string, { amount: number; currency: string }> = {};
    for (const inv of clockifyInvoiced) {
      const pid = inv.clockifyProjectId as string;
      const cur = inv.currency as string;
      if (!totalInvoicedMap[pid]) {
        totalInvoicedMap[pid] = { amount: inv.amount as number, currency: cur };
      } else if (totalInvoicedMap[pid].currency === cur) {
        totalInvoicedMap[pid].amount += inv.amount as number;
      }
    }
    return Object.keys(rateMap).reduce((sum, pid) => {
      const rate = rateMap[pid];
      const totalEarned = rate.initialEarnings + (totalHoursMap[pid] ?? 0) * rate.hourlyRate;
      const invoicedEntry = totalInvoicedMap[pid];
      const totalInvoiced = (invoicedEntry && invoicedEntry.currency === rate.currency) ? invoicedEntry.amount : 0;
      return sum + Math.max(0, totalEarned - totalInvoiced);
    }, 0);
  })();

  const totalAssets      = cryptoValue + stocksValue + propertyValue + receivablesValue + savingsValue + bankValue + unfacturedValue;
  const totalLiabilities = mortgageDebt;
  const netWorth         = totalAssets - totalLiabilities;
  const prevSnapshot     = snapshots[1];
  const change           = prevSnapshot ? netWorth - (prevSnapshot.netWorth as number) : 0;

  const allocationItems = [
    { label: "Property",         value: propertyValue,    color: "#8b5cf6", href: "/property" },
    { label: "Savings",          value: savingsValue,     color: "#10b981", href: "/savings" },
    { label: "Bank Accounts",    value: bankValue,         color: "#3b82f6", href: "/accounts" },
    { label: "Stocks",           value: stocksValue,       color: "#f59e0b", href: "/stocks" },
    { label: "Crypto",           value: cryptoValue,       color: "#f97316", href: "/crypto" },
    { label: "Receivables",      value: receivablesValue,  color: "#06b6d4", href: "/receivables" },
    { label: "Nevyfakturováno",  value: unfacturedValue,   color: "#a855f7", href: "/billing" },
  ].filter((i) => i.value > 0);
  const total = allocationItems.reduce((s, i) => s + i.value, 0) || 1;

  return (
    <div>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>Dashboard</h1>
        <p style={{ color: "var(--muted)", margin: "0.35rem 0 0", fontSize: "0.875rem" }}>
          {new Date().toLocaleDateString("cs-CZ", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem", background: "linear-gradient(135deg, #1a1f2e 0%, #1e2a3a 100%)", borderColor: "#2d4a6e" }}>
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Net Worth</div>
        <div style={{ fontSize: "3rem", fontWeight: 800, color: "var(--foreground)", margin: "0.5rem 0" }}>{formatCurrency(netWorth, "CZK")}</div>
        {change !== 0 && <div style={{ fontSize: "0.9rem", color: change >= 0 ? "var(--green)" : "var(--red)" }}>{change >= 0 ? "▲" : "▼"} {formatCurrency(Math.abs(change), "CZK")} since last snapshot</div>}
        {change === 0 && <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Take a snapshot in <Link href="/history" style={{ color: "var(--accent)" }}>History</Link> to track changes over time</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <StatCard label="Total Assets"      value={formatCurrency(totalAssets, "CZK")}      accent="var(--green)" icon="↑" />
        <StatCard label="Total Liabilities" value={formatCurrency(totalLiabilities, "CZK")} accent="var(--red)"   icon="↓" />
        <StatCard label="Savings"           value={formatCurrency(savingsValue, "CZK")}     accent="var(--green)" icon="🏦" />
        <StatCard label="Receivables"       value={formatCurrency(receivablesValue, "CZK")} sub={`${receivables.filter((r) => String(r.status) !== "PAID").length} pending`} accent="var(--yellow)" icon="💼" />
        {unfacturedValue > 0 && (
          <StatCard label="Nevyfakturováno" value={formatCurrency(unfacturedValue, "CZK")} sub="billing" accent="var(--accent)" icon="⏱" />
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <div className="card">
          <h2 style={{ margin: "0 0 1.25rem", fontSize: "1rem", fontWeight: 700 }}>Asset Allocation</h2>
          {allocationItems.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>No assets yet. Add your first asset using the sidebar.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {allocationItems.map((item) => {
                const pct = (item.value / total) * 100;
                return (
                  <Link key={item.label} href={item.href} style={{ textDecoration: "none" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--foreground)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", background: item.color }} />
                          {item.label}
                        </span>
                        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{formatCurrency(item.value, "CZK")} · {pct.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: "6px", background: "var(--card-border)", borderRadius: "3px" }}>
                        <div style={{ height: "100%", background: item.color, borderRadius: "3px", width: `${pct}%` }} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <h2 style={{ margin: "0 0 1.25rem", fontSize: "1rem", fontWeight: 700 }}>Quick Access</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            {[
              { href: "/crypto",      icon: "₿",  label: "Crypto",      count: cryptos.length },
              { href: "/stocks",      icon: "📈", label: "Stocks",      count: stocks.length },
              { href: "/property",    icon: "🏠", label: "Property",    count: properties.length },
              { href: "/receivables", icon: "💼", label: "Receivables", count: receivables.filter((r) => String(r.status) !== "PAID").length },
              { href: "/savings",     icon: "🏦", label: "Savings",     count: null },
              { href: "/billing",     icon: "⏱", label: "Billing",     count: null },
              { href: "/history",     icon: "📊", label: "History",     count: null },
            ].map((item) => (
              <Link key={item.href} href={item.href} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem", borderRadius: "8px", background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)", textDecoration: "none", color: "var(--foreground)", fontSize: "0.8rem" }}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {item.count !== null && item.count > 0 && <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--muted)" }}>{item.count}</span>}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
