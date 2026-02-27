"use client";

import { useEffect, useState } from "react";
import * as bip39 from "bip39";
import * as Evolu from "@evolu/common";
import { getRelayUrl, setRelayUrl, useEvolu } from "@/lib/evolu";

// Inner component — loads appOwner async to avoid SSR suspend (use() hangs in Node.js)
function SettingsContent() {
  const evolu = useEvolu();
  const [mnemonic, setMnemonic] = useState("");

  useEffect(() => {
    evolu.appOwner.then((owner) => setMnemonic(owner.mnemonic ?? ""));
  }, [evolu]);

  const [copied, setCopied] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [restoreInput, setRestoreInput] = useState("");
  const [restoreError, setRestoreError] = useState("");
  const [restoring, setRestoring] = useState(false);

  // Relay settings
  const [relayUrl, setRelayUrlState] = useState("");
  const [savedRelay, setSavedRelay] = useState("");
  const [relayStatus, setRelayStatus] = useState<null | boolean>(null);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    const url = getRelayUrl();
    setRelayUrlState(url);
    setSavedRelay(url);
  }, []);

  // Test WebSocket connection to relay
  useEffect(() => {
    if (!savedRelay) return;
    setRelayStatus(null);
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(savedRelay);
    } catch {
      setRelayStatus(false);
      return;
    }
    ws.onopen = () => setRelayStatus(true);
    ws.onerror = () => setRelayStatus(false);
    ws.onclose = () => setRelayStatus(false);
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [savedRelay]);

  function handleCopy() {
    navigator.clipboard.writeText(mnemonic).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleGenerateNew() {
    if (
      !confirm(
        "Generate a new seed phrase? This will replace your current account. All unsynced data may be lost."
      )
    )
      return;
    await evolu.resetAppOwner();
    setShowRestore(false);
    setRestoreInput("");
  }

  async function handleRestore() {
    const trimmed = restoreInput.trim();
    if (!trimmed) {
      setRestoreError("Seed phrase is required.");
      return;
    }
    if (!bip39.validateMnemonic(trimmed)) {
      setRestoreError("Invalid seed phrase. Please check and try again.");
      return;
    }
    if (trimmed === mnemonic) {
      setRestoreError("This seed phrase is already active.");
      return;
    }
    setRestoring(true);
    try {
      await evolu.restoreAppOwner(trimmed as Evolu.Mnemonic);
    } catch {
      setRestoreError("Failed to restore. Please try again.");
    } finally {
      setRestoring(false);
    }
  }

  function handleSaveRelay() {
    const trimmed = relayUrl.trim();
    if (!trimmed.startsWith("ws://") && !trimmed.startsWith("wss://")) {
      alert("Relay URL must start with ws:// or wss://");
      return;
    }
    setReconnecting(true);
    setRelayUrl(trimmed);
    setSavedRelay(trimmed);
    setTimeout(() => {
      evolu.reloadApp();
      setReconnecting(false);
    }, 300);
  }

  const relayDot =
    relayStatus === null
      ? { color: "#f59e0b", label: "Connecting…" }
      : relayStatus
        ? { color: "#10b981", label: "Connected" }
        : { color: "#ef4444", label: "Disconnected" };

  return (
    <div style={{ maxWidth: "640px" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>
          Account
        </h1>
        <p style={{ color: "var(--muted)", margin: "0.35rem 0 0", fontSize: "0.875rem" }}>
          Seed phrase · Sync relay · Cross-device access
        </p>
      </div>

      {/* Seed Phrase */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 700 }}>
          🔑 Your Seed Phrase
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0 0 1rem" }}>
          This is your account identity. Keep it secret and safe. Use it to
          restore access on another device.
        </p>

        <div
          style={{
            background: "rgba(59,130,246,0.06)",
            border: "1px solid rgba(59,130,246,0.2)",
            borderRadius: "10px",
            padding: "1rem 1.25rem",
            fontFamily: "monospace",
            fontSize: "0.85rem",
            lineHeight: 1.7,
            letterSpacing: "0.02em",
            color: "var(--foreground)",
            marginBottom: "1rem",
            wordBreak: "break-all",
          }}
        >
          {mnemonic}
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button className="btn-primary" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy Seed Phrase"}
          </button>
          <button className="btn-ghost" onClick={handleGenerateNew}>
            Generate New Seed
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              setShowRestore(!showRestore);
              setRestoreError("");
              setRestoreInput("");
            }}
          >
            {showRestore ? "Cancel Restore" : "Restore from Seed"}
          </button>
        </div>

        {showRestore && (
          <div style={{ marginTop: "1.25rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                color: "var(--muted)",
                marginBottom: "0.5rem",
                fontWeight: 600,
              }}
            >
              Enter your 12 or 24-word seed phrase
            </label>
            <textarea
              value={restoreInput}
              onChange={(e) => {
                setRestoreInput(e.target.value);
                setRestoreError("");
              }}
              rows={3}
              placeholder="word1 word2 word3 …"
              style={{
                width: "100%",
                background: "var(--card)",
                border: `1px solid ${restoreError ? "var(--red)" : "var(--card-border)"}`,
                borderRadius: "8px",
                padding: "0.75rem",
                color: "var(--foreground)",
                fontFamily: "monospace",
                fontSize: "0.85rem",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
            {restoreError && (
              <p
                style={{
                  color: "var(--red)",
                  fontSize: "0.8rem",
                  margin: "0.4rem 0 0",
                }}
              >
                {restoreError}
              </p>
            )}
            <button
              className="btn-primary"
              onClick={handleRestore}
              disabled={restoring}
              style={{ marginTop: "0.75rem" }}
            >
              {restoring ? "Restoring…" : "Restore Account"}
            </button>
          </div>
        )}
      </div>

      {/* Relay / Sync */}
      <div className="card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "0.5rem",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
            ☁️ Sync Relay
          </h2>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.75rem",
              color: relayDot.label === "Connected" ? "var(--green)" : relayDot.color,
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: relayDot.color,
                display: "inline-block",
              }}
            />
            {relayDot.label}
          </span>
        </div>
        <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0 0 1rem" }}>
          Data syncs end-to-end encrypted via a WebSocket relay. The default
          public relay is free. You can self-host your own.
        </p>

        <label
          style={{
            display: "block",
            fontSize: "0.8rem",
            color: "var(--muted)",
            marginBottom: "0.4rem",
            fontWeight: 600,
          }}
        >
          Relay URL
        </label>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <input
            type="text"
            value={relayUrl}
            onChange={(e) => setRelayUrlState(e.target.value)}
            placeholder="wss://free.evoluhq.com"
            style={{
              flex: 1,
              background: "var(--card)",
              border: "1px solid var(--card-border)",
              borderRadius: "8px",
              padding: "0.6rem 0.75rem",
              color: "var(--foreground)",
              fontSize: "0.875rem",
            }}
          />
          <button
            className="btn-primary"
            onClick={handleSaveRelay}
            disabled={reconnecting}
          >
            {reconnecting ? "Saving…" : "Save"}
          </button>
        </div>

        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            background: "rgba(16,185,129,0.06)",
            border: "1px solid rgba(16,185,129,0.15)",
            fontSize: "0.78rem",
            color: "var(--muted)",
          }}
        >
          💡 How it works: Your data is stored locally in the browser
          (IndexedDB). The relay server only stores encrypted chunks — it cannot
          read your data. Open this app with the same seed phrase on another
          device to sync.
        </div>
      </div>
    </div>
  );
}

// Outer component — Suspense is provided by EvoluClientProvider in layout
export default function SettingsPage() {
  return <SettingsContent />;
}
