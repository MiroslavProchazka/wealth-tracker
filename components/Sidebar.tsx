"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/",            label: "Dashboard",    icon: "◈" },
  { href: "/crypto",      label: "Crypto",       icon: "₿" },
  { href: "/stocks",      label: "Stocks",       icon: "📈" },
  { href: "/property",    label: "Property",     icon: "🏠" },
  { href: "/receivables", label: "Receivables",  icon: "💼" },
  { href: "/savings",     label: "Savings",      icon: "🏦" },
  { href: "/accounts",    label: "Bank Accounts",icon: "💳" },
  { href: "/goals",       label: "Goals",        icon: "🎯" },
  { href: "/history",     label: "History",      icon: "📊" },
  { href: "/settings",    label: "Account",      icon: "🔑" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: "220px",
        minHeight: "100vh",
        background: "var(--card)",
        borderRight: "1px solid var(--card-border)",
        padding: "1.5rem 0",
        flexShrink: 0,
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
        height: "100vh",
        overflowY: "auto",
      }}
    >
      <div style={{ padding: "0 1.25rem 1.5rem", borderBottom: "1px solid var(--card-border)" }}>
        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--foreground)" }}>
          💰 WealthTracker
        </div>
        <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.25rem" }}>
          Personal Finance
        </div>
      </div>

      <nav style={{ padding: "1rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.6rem 0.75rem",
                borderRadius: "8px",
                fontSize: "0.875rem",
                fontWeight: active ? 600 : 400,
                color: active ? "var(--foreground)" : "var(--muted)",
                background: active ? "rgba(59,130,246,0.15)" : "transparent",
                textDecoration: "none",
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: "1rem" }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          position: "absolute",
          bottom: "1rem",
          left: "1.25rem",
          right: "1.25rem",
          fontSize: "0.65rem",
          color: "var(--muted)",
          textAlign: "center",
        }}
      >
        Synced via Evolu · Private
      </div>
    </aside>
  );
}
