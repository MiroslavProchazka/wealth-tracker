"use client";

import { useEffect, useMemo, useState } from "react";
import * as Evolu from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEvolu } from "@/lib/evolu";
import { formatCurrency } from "@/lib/currencies";
import StatCard from "@/components/StatCard";
import Link from "next/link";
import {
  ArrowUp,
  ArrowDown,
  Landmark,
  Bitcoin,
  Coins,
  TrendingUp,
  Home,
  BarChart3,
  Settings,
} from "lucide-react";

export default function Dashboard() {
  const evolu = useEvolu();

  // Evolu health indicator – pokud máme createQuery, považujeme klienta
  // za inicializovaný. Je to čistě diagnostická informace pro debug.
  const evoluReady = useMemo(() => {
    try {
      return typeof evolu.createQuery === "function";
    } catch {
      return false;
    }
  }, [evolu]);

  // ── Queries ────────────────────────────────────────────────────────────────
  const cryptoQ = useMemo(
    () =>
      evolu.createQuery((db) =>
        db
          .selectFrom("cryptoHolding")
          .select(["symbol", "amount"])
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
          .select(["ticker", "shares", "currency"])
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
          .select(["estimatedValue", "remainingLoan"])
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
          .select(["balance"])
          .where("isDeleted", "is not", Evolu.sqliteTrue)
          .where("deleted", "is not", Evolu.sqliteTrue),
      ),
    [evolu],
  );
  const snapshotQ = useMemo(
    () =>
      evolu.createQuery((db) =>
        db
          .selectFrom("netWorthSnapshot")
          .select(["netWorth", "schemaVersion"])
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
  const snapshots = useQuery(snapshotQ);

  // ── Live prices ────────────────────────────────────────────────────────────
  const [cryptoPrices, setCryptoPrices] = useState<
    Record<string, { czk: number }>
  >({});
  const [stockPrices, setStockPrices] = useState<
    Record<string, { czk: number }>
  >({});

  useEffect(() => {
    const symbols = cryptos
      .map((c) => (c.symbol as string).toUpperCase())
      .filter(Boolean);
    if (symbols.length === 0) return;
    fetch(`/api/crypto/prices?symbols=${encodeURIComponent(symbols.join(","))}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.prices) setCryptoPrices(d.prices);
      })
      .catch(() => {
        /* silently ignore – fall back to 0 */
      });
  }, [cryptos.length]);

  useEffect(() => {
    const tickers = stocks
      .map((s) => (s.ticker as string).toUpperCase())
      .filter(Boolean);
    if (tickers.length === 0) return;
    fetch(`/api/stocks/prices?tickers=${encodeURIComponent(tickers.join(","))}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.prices) setStockPrices(d.prices);
      })
      .catch(() => {
        /* silently ignore – fall back to 0 */
      });
  }, [stocks.length]);

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

  const totalAssets =
    cryptoValue + stocksValue + propertyValue + savingsValue;
  const totalLiabilities = mortgageDebt;
  const netWorth = totalAssets - totalLiabilities;
  const prevSnapshot = snapshots[1];
  const currentSnapshot = snapshots[0];
  const comparableSnapshots =
    currentSnapshot &&
    prevSnapshot &&
    (currentSnapshot.schemaVersion as number | null) === 1 &&
    (prevSnapshot.schemaVersion as number | null) === 1;
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
  const total = allocationItems.reduce((s, i) => s + i.value, 0) || 1;

  const quickItems = [
    {
      href: "/crypto",
      icon: <Coins size={14} />,
      label: "Crypto",
      count: cryptos.length,
    },
    {
      href: "/stocks",
      icon: <TrendingUp size={14} />,
      label: "Stocks",
      count: stocks.length,
    },
    {
      href: "/property",
      icon: <Home size={14} />,
      label: "Property",
      count: properties.length,
    },
    {
      href: "/savings",
      icon: <Landmark size={14} />,
      label: "Savings",
      count: null,
    },
    {
      href: "/history",
      icon: <BarChart3 size={14} />,
      label: "History",
      count: null,
    },
    {
      href: "/settings",
      icon: <Settings size={14} />,
      label: "Account",
      count: null,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: "2rem" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "1.75rem",
            fontWeight: 700,
            letterSpacing: "-0.025em",
          }}
        >
          Dashboard
        </h1>
        <p
          style={{
            color: "var(--muted)",
            margin: "0.35rem 0 0",
            fontSize: "0.875rem",
          }}
        >
          {new Date().toLocaleDateString("cs-CZ", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
        <p
          style={{
            color: "var(--muted)",
            margin: "0.15rem 0 0",
            fontSize: "0.75rem",
          }}
        >
          Evolu status: {evoluReady ? "OK" : "offline"}
        </p>
      </div>

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
          Net Worth
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
          {formatCurrency(netWorth, "CZK")}
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
            {formatCurrency(Math.abs(change), "CZK")} od posledního snapshotu
          </div>
        )}
        {change === 0 && (
          <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            Uložte snapshot v{" "}
            <Link href="/history" style={{ color: "var(--accent)" }}>
              History
            </Link>{" "}
            pro sledování vývoje
          </div>
        )}
      </div>

      {/* ── Stat cards ─────────────────────────────────────────── */}
      <div className="stat-grid">
        <StatCard
          label="Total Assets"
          value={formatCurrency(totalAssets, "CZK")}
          accent="var(--green)"
          icon={<ArrowUp size={16} />}
        />
        <StatCard
          label="Total Liabilities"
          value={formatCurrency(totalLiabilities, "CZK")}
          accent="var(--red)"
          icon={<ArrowDown size={16} />}
        />
        <StatCard
          label="Savings"
          value={formatCurrency(savingsValue, "CZK")}
          accent="var(--green)"
          icon={<Landmark size={16} />}
        />
        <StatCard
          label="Crypto"
          value={formatCurrency(cryptoValue, "CZK")}
          sub={`${cryptos.length} assets`}
          accent="#f97316"
          icon={<Bitcoin size={16} />}
        />
      </div>

      {/* ── Bottom row ─────────────────────────────────────────── */}
      <div className="dashboard-bottom">
        {/* Asset Allocation */}
        <div className="card">
          <h2
            style={{ margin: "0 0 1.25rem", fontSize: "1rem", fontWeight: 700 }}
          >
            Asset Allocation
          </h2>
          {allocationItems.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>
              No assets yet. Add your first asset using the sidebar.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
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
                        gap: "0.35rem",
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
                            fontSize: "0.8rem",
                            color: "var(--foreground)",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: item.color,
                              boxShadow: `0 0 6px ${item.color}80`,
                            }}
                          />
                          {item.label}
                        </span>
                        <span
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--muted)",
                            fontFeatureSettings: '"tnum"',
                          }}
                        >
                          {formatCurrency(item.value, "CZK")} · {pct.toFixed(1)}
                          %
                        </span>
                      </div>
                      <div
                        style={{
                          height: "4px",
                          background: "var(--surface-3)",
                          borderRadius: "2px",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            background: `linear-gradient(90deg, ${item.color} 0%, ${item.color}88 100%)`,
                            borderRadius: "2px",
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

        {/* Quick Access */}
        <div className="card">
          <h2
            style={{ margin: "0 0 1.25rem", fontSize: "1rem", fontWeight: 700 }}
          >
            Quick Access
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
            }}
          >
            {quickItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  textDecoration: "none",
                  color: "var(--text-2)",
                  fontSize: "0.8rem",
                  transition: "all 0.15s ease",
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor =
                    "var(--border-2)";
                  (e.currentTarget as HTMLAnchorElement).style.color =
                    "var(--text)";
                  (e.currentTarget as HTMLAnchorElement).style.background =
                    "var(--surface-3)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor =
                    "var(--border)";
                  (e.currentTarget as HTMLAnchorElement).style.color =
                    "var(--text-2)";
                  (e.currentTarget as HTMLAnchorElement).style.background =
                    "var(--surface-2)";
                }}
              >
                <span
                  style={{
                    color: "var(--text-3)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {item.count !== null && item.count > 0 && (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "0.7rem",
                      color: "var(--text-3)",
                      fontFeatureSettings: '"tnum"',
                    }}
                  >
                    {item.count}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
