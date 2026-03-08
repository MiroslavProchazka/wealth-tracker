"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

/* ── Inline SVG icons (16×16, stroke-based) ─────────────────── */
const Icons = {
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="1" width="6" height="6" rx="1.5"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5"/>
      <rect x="9" y="9" width="6" height="6" rx="1.5"/>
    </svg>
  ),
  crypto: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1l6 3.5v7L8 15l-6-3.5v-7L8 1z"/>
      <path d="M8 5v6M5.5 6.5h3a1 1 0 010 2H5.5a1 1 0 010-2z" opacity="0.7"/>
    </svg>
  ),
  stocks: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1,12 5,7 8.5,9.5 14,3"/>
      <polyline points="10.5,3 14,3 14,6.5"/>
    </svg>
  ),
  property: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 7.5L8 2l7 5.5V14a1 1 0 01-1 1H2a1 1 0 01-1-1V7.5z"/>
      <path d="M6 15v-5h4v5"/>
    </svg>
  ),
  receivables: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="1" width="9" height="12" rx="1"/>
      <path d="M5 5h3M5 7.5h3M5 10h2"/>
      <path d="M11 5l3 3-3 3"/>
    </svg>
  ),
  savings: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1L2 4v5c0 3.2 2.5 5.5 6 6.5 3.5-1 6-3.3 6-6.5V4L8 1z"/>
    </svg>
  ),
  history: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="2.5" height="9" rx="0.5"/>
      <rect x="6.75" y="2" width="2.5" height="12" rx="0.5"/>
      <rect x="11.5" y="7" width="2.5" height="7" rx="0.5"/>
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.5"/>
      <path d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/>
    </svg>
  ),
};

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const navItems = [
    { href: "/", label: t("sidebar.dashboard"), icon: Icons.dashboard },
    { href: "/crypto", label: t("sidebar.crypto"), icon: Icons.crypto },
    { href: "/stocks", label: t("sidebar.stocks"), icon: Icons.stocks },
    { href: "/property", label: t("sidebar.property"), icon: Icons.property },
    { href: "/savings", label: t("sidebar.savings"), icon: Icons.savings },
    { href: "/history", label: t("sidebar.history"), icon: Icons.history },
    { href: "/settings", label: t("sidebar.account"), icon: Icons.settings },
  ];

  return (
    <React.Fragment>
    <aside
      className="sidebar-desktop"
      style={{
        width: "224px",
        minHeight: "100vh",
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        padding: "0",
        flexShrink: 0,
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
        height: "100vh",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Brand */}
      <div style={{
        padding: "1.5rem 1.25rem 1.25rem",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            fontWeight: 700,
            color: "#fff",
            flexShrink: 0,
            boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
          }}>
            W
          </div>
          <div>
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
              WealthTracker
            </div>
            <div style={{ fontSize: "0.65rem", color: "var(--text-3)", marginTop: "1px", letterSpacing: "0.03em" }}>
              {t("sidebar.brandSub")}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ padding: "1rem 0.75rem", display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.65rem",
                padding: "0.55rem 0.75rem",
                borderRadius: "8px",
                fontSize: "0.875rem",
                fontWeight: active ? 600 : 400,
                color: active ? "var(--text)" : "var(--text-2)",
                background: active
                  ? "linear-gradient(90deg, var(--accent-bg) 0%, transparent 100%)"
                  : "transparent",
                textDecoration: "none",
                transition: "all 0.13s ease",
                position: "relative",
              }}
            >
              {/* Active indicator */}
              {active && (
                <span style={{
                  position: "absolute",
                  left: 0,
                  top: "20%",
                  bottom: "20%",
                  width: "3px",
                  borderRadius: "0 3px 3px 0",
                  background: "linear-gradient(180deg, var(--accent) 0%, var(--accent-2) 100%)",
                }} />
              )}
              <span style={{
                color: active ? "var(--accent-2)" : "var(--text-3)",
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
                transition: "color 0.13s",
              }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer — sync status pill */}
      <div style={{
        padding: "1rem 1.25rem",
        borderTop: "1px solid var(--border)",
      }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.3rem 0.7rem",
          borderRadius: "20px",
          background: "rgba(34, 197, 94, 0.08)",
          border: "1px solid rgba(34, 197, 94, 0.15)",
        }}>
          <span style={{
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            background: "var(--green)",
            display: "inline-block",
            boxShadow: "0 0 6px var(--green)",
          }} />
          <span style={{ fontSize: "0.7rem", color: "var(--green)", fontWeight: 500, letterSpacing: "0.02em" }}>
            {t("sidebar.synced")}
          </span>
        </div>
      </div>
    </aside>

    {/* ── Mobile bottom navigation ─────────────────────────── */}
    <nav className="mobile-nav">
      {navItems.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? "active" : ""}
          >
            <span className="icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
    </React.Fragment>
  );
}
