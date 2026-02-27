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
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle accent top line */}
      {accent && (
        <div style={{
          position: "absolute",
          top: 0,
          left: "1.25rem",
          right: "1.25rem",
          height: "2px",
          borderRadius: "0 0 2px 2px",
          background: accent,
          opacity: 0.8,
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
          <div style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--text)",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
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
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: accent ? `${accent}18` : "var(--surface-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.1rem",
            flexShrink: 0,
            marginLeft: "0.75rem",
          }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
