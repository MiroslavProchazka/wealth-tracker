import { ReactNode } from "react";
import Link from "next/link";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  subPositive?: boolean;
  accent?: string;
  icon?: ReactNode;
  href?: string;
}

export default function StatCard({
  label,
  value,
  sub,
  subPositive,
  accent,
  icon,
  href,
}: StatCardProps) {
  const content = (
    <>
      {/* Subtle accent top line */}
      {accent && (
        <div style={{
          position: "absolute",
          top: 0,
          left: "1.25rem",
          right: "1.25rem",
          height: "2px",
          borderRadius: "0 0 2px 2px",
          background: `linear-gradient(90deg, ${accent} 0%, transparent 100%)`,
          opacity: 0.9,
        }} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: "0.68rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.09em",
            color: "var(--text-3)",
            marginBottom: "0.6rem",
          }}>
            {label}
          </div>
          <div className="stat-card-value" style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--text)",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            fontFeatureSettings: '"tnum"',
            fontVariantNumeric: "tabular-nums",
          }}>
            {value}
          </div>
          {sub && (
            <div style={{
              fontSize: "0.78rem",
              marginTop: "0.4rem",
              fontWeight: 500,
              color:
                subPositive === undefined
                  ? "var(--text-2)"
                  : subPositive
                  ? "var(--green)"
                  : "var(--red)",
              display: "flex",
              alignItems: "center",
              gap: "0.2rem",
            }}>
              {subPositive !== undefined && (
                <span style={{ fontSize: "0.65rem" }}>
                  {subPositive ? "▲" : "▼"}
                </span>
              )}
              {sub}
            </div>
          )}
        </div>

        {icon && (
          <div className="stat-card-icon" style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: accent
              ? `linear-gradient(135deg, ${accent}20 0%, ${accent}08 100%)`
              : "var(--surface-2)",
            border: accent ? `1px solid ${accent}25` : "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1rem",
            flexShrink: 0,
            marginLeft: "0.75rem",
          }}>
            {icon}
          </div>
        )}
      </div>
    </>
  );

  const cardStyle = {
    position: "relative" as const,
    overflow: "hidden" as const,
  };

  if (href) {
    return (
      <Link
        href={href}
        className="card card-clickable"
        style={{
          ...cardStyle,
          display: "block",
          textDecoration: "none",
          color: "inherit",
        }}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="card" style={cardStyle}>
      {content}
    </div>
  );
}
