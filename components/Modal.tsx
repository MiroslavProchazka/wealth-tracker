"use client";

import { ReactNode, useEffect } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ title, onClose, children }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
        animation: "fadeIn 0.15s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-2)",
          borderRadius: "16px",
          padding: "1.75rem",
          width: "100%",
          maxWidth: "520px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          animation: "slideUp 0.18s ease",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}>
          <h2 style={{
            margin: 0,
            fontSize: "1.05rem",
            fontWeight: 700,
            color: "var(--text)",
            letterSpacing: "-0.015em",
          }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-2)",
              cursor: "pointer",
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1rem",
              lineHeight: 1,
              transition: "all 0.13s",
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-3)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)";
            }}
          >
            ×
          </button>
        </div>

        {children}
      </div>

      <style>{`
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  );
}
