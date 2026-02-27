interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  subPositive?: boolean;
  accent?: string;
  icon?: string;
}

export default function StatCard({ label, value, sub, subPositive, accent, icon }: StatCardProps) {
  return (
    <div
      className="card"
      style={{
        borderLeft: accent ? `3px solid ${accent}` : undefined,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: "0.5rem" }}>
            {label}
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--foreground)" }}>
            {value}
          </div>
          {sub && (
            <div
              style={{
                fontSize: "0.75rem",
                marginTop: "0.35rem",
                color: subPositive === undefined
                  ? "var(--muted)"
                  : subPositive
                  ? "var(--green)"
                  : "var(--red)",
              }}
            >
              {sub}
            </div>
          )}
        </div>
        {icon && (
          <span style={{ fontSize: "1.75rem", opacity: 0.6 }}>{icon}</span>
        )}
      </div>
    </div>
  );
}
