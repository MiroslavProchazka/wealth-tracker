"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as bip39 from "bip39";
import * as Evolu from "@evolu/common";
import { useQuery } from "@evolu/react";
import {
  BACKUP_TABLES,
  buildBackupPayload,
  parseBackupPayload,
} from "@/lib/backup";
import {
  getRelayUrl,
  setRelayUrl,
  SNAPSHOT_AUTOMATION_SETTINGS_KEY,
  useEvolu,
} from "@/lib/evolu";
import {
  ASSET_CLASSES,
  DEFAULT_ALLOCATION_TARGETS,
  DEFAULT_SNAPSHOT_AUTOMATION_SETTINGS,
} from "@/lib/portfolio";
import { useI18n } from "@/components/i18n/I18nProvider";

// Inner component — loads appOwner async to avoid SSR suspend (use() hangs in Node.js)
function SettingsContent() {
  const evolu = useEvolu();
  const { t } = useI18n();
  const assetClassLabels: Record<string, string> = {
    Property: t("dashboard.assetClass_property"),
    Savings: t("dashboard.assetClass_savings"),
    Receivables: t("dashboard.assetClass_receivables"),
    Stocks: t("dashboard.assetClass_stocks"),
    Crypto: t("dashboard.assetClass_crypto"),
  };
  const [mnemonic, setMnemonic] = useState("");

  useEffect(() => {
    evolu.appOwner.then((owner) => setMnemonic(owner.mnemonic ?? ""));
  }, [evolu]);

  const [copied, setCopied] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [restoreInput, setRestoreInput] = useState("");
  const [restoreError, setRestoreError] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [allocationStatus, setAllocationStatus] = useState<string | null>(null);
  const [automationSettings, setAutomationSettings] = useState(
    DEFAULT_SNAPSHOT_AUTOMATION_SETTINGS,
  );
  const [allocationDrafts, setAllocationDrafts] = useState<
    Record<string, string>
  >({});

  // Relay settings
  const [relayUrl, setRelayUrlState] = useState("");
  const [savedRelay, setSavedRelay] = useState("");
  const [relayStatus, setRelayStatus] = useState<null | boolean>(null);
  const [reconnecting, setReconnecting] = useState(false);

  const cryptoQ = useMemo(
    () =>
      evolu.createQuery((db) =>
        db
          .selectFrom("cryptoHolding")
          .selectAll()
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
          .selectAll()
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
          .selectAll()
          .where("isDeleted", "is not", Evolu.sqliteTrue)
          .where("deleted", "is not", Evolu.sqliteTrue),
      ),
    [evolu],
  );
  const receivableQ = useMemo(
    () =>
      evolu.createQuery((db) =>
        db
          .selectFrom("receivable")
          .selectAll()
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
          .selectAll()
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
          .selectAll()
          .where("isDeleted", "is not", Evolu.sqliteTrue)
          .where("deleted", "is not", Evolu.sqliteTrue),
      ),
    [evolu],
  );
  const cashflowQ = useMemo(
    () =>
      evolu.createQuery((db) =>
        db
          .selectFrom("cashflowEntry")
          .selectAll()
          .where("isDeleted", "is not", Evolu.sqliteTrue)
          .where("deleted", "is not", Evolu.sqliteTrue),
      ),
    [evolu],
  );
  const allocationQ = useMemo(
    () =>
      evolu.createQuery((db) =>
        db
          .selectFrom("allocationTarget")
          .selectAll()
          .where("isDeleted", "is not", Evolu.sqliteTrue)
          .where("deleted", "is not", Evolu.sqliteTrue),
      ),
    [evolu],
  );
  const portfolioNoteQ = useMemo(
    () =>
      evolu.createQuery((db) =>
        db
          .selectFrom("portfolioNote")
          .selectAll()
          .where("isDeleted", "is not", Evolu.sqliteTrue)
          .where("deleted", "is not", Evolu.sqliteTrue),
      ),
    [evolu],
  );

  const cryptoHoldings = useQuery(cryptoQ);
  const stockHoldings = useQuery(stockQ);
  const properties = useQuery(propertyQ);
  const receivables = useQuery(receivableQ);
  const savingsAccounts = useQuery(savingsQ);
  const snapshots = useQuery(snapshotQ);
  const cashflowEntries = useQuery(cashflowQ);
  const allocationTargets = useQuery(allocationQ);
  const portfolioNotes = useQuery(portfolioNoteQ);

  useEffect(() => {
    const url = getRelayUrl();
    setRelayUrlState(url);
    setSavedRelay(url);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SNAPSHOT_AUTOMATION_SETTINGS_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<typeof DEFAULT_SNAPSHOT_AUTOMATION_SETTINGS>;
      setAutomationSettings({
        ...DEFAULT_SNAPSHOT_AUTOMATION_SETTINGS,
        ...parsed,
      });
    } catch {
      setAutomationSettings(DEFAULT_SNAPSHOT_AUTOMATION_SETTINGS);
    }
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
        t("settings.generateConfirm")
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
      setRestoreError(t("settings.seedRequired"));
      return;
    }
    if (!bip39.validateMnemonic(trimmed)) {
      setRestoreError(t("settings.seedInvalid"));
      return;
    }
    if (trimmed === mnemonic) {
      setRestoreError(t("settings.seedAlreadyActive"));
      return;
    }
    setRestoring(true);
    try {
      await evolu.restoreAppOwner(trimmed as Evolu.Mnemonic);
    } catch {
      setRestoreError(t("settings.restoreFailed"));
    } finally {
      setRestoring(false);
    }
  }

  function handleSaveRelay() {
    const trimmed = relayUrl.trim();
    if (!trimmed.startsWith("ws://") && !trimmed.startsWith("wss://")) {
      alert(t("settings.relayUrlInvalid"));
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
      ? { color: "#f59e0b", label: t("settings.connecting") }
      : relayStatus
        ? { color: "#10b981", label: t("settings.connected") }
        : { color: "#ef4444", label: t("settings.disconnected") };

  const allocationRows = ASSET_CLASSES.map((assetClass) => {
    const current = allocationTargets.find(
      (row) => String(row.assetClass) === assetClass,
    );
    return {
      assetClass,
      id: (current?.id as string | undefined) ?? null,
      targetPercent:
        typeof current?.targetPercent === "number"
          ? (current.targetPercent as number)
          : DEFAULT_ALLOCATION_TARGETS[assetClass],
    };
  });

  const totalTargetPercent = allocationRows.reduce(
    (sum, row) => sum + row.targetPercent,
    0,
  );

  useEffect(() => {
    setAllocationDrafts((current) => {
      const next = { ...current };
      let changed = false;
      for (const assetClass of ASSET_CLASSES) {
        const row = allocationTargets.find(
          (entry) => String(entry.assetClass) === assetClass,
        );
        const value =
          typeof row?.targetPercent === "number"
            ? (row.targetPercent as number).toString()
            : DEFAULT_ALLOCATION_TARGETS[assetClass].toString();
        if (current[assetClass] !== value) {
          next[assetClass] = value;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [allocationTargets]);

  function handleExportBackup() {
    const payload = buildBackupPayload({
      cryptoHolding: cryptoHoldings.map((row) => ({ ...row })),
      stockHolding: stockHoldings.map((row) => ({ ...row })),
      property: properties.map((row) => ({ ...row })),
      receivable: receivables.map((row) => ({ ...row })),
      savingsAccount: savingsAccounts.map((row) => ({ ...row })),
      netWorthSnapshot: snapshots.map((row) => ({ ...row })),
      cashflowEntry: cashflowEntries.map((row) => ({ ...row })),
      allocationTarget: allocationTargets.map((row) => ({ ...row })),
      portfolioNote: portfolioNotes.map((row) => ({ ...row })),
    });

    const fileName = `wealth-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    setBackupStatus(t("settings.backupExported", { fileName }));
  }

  async function handleImportBackup(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBackupStatus(null);
    setImporting(true);
    try {
      const text = await file.text();
      const { payload, issues } = parseBackupPayload(text);

      if (!payload) {
        setBackupStatus(issues[0] ?? t("settings.backupImportFailed"));
        return;
      }

      const summary = BACKUP_TABLES.map(
        (table) => `${table}: ${payload.data[table].length}`,
      ).join(", ");

      if (
        !confirm(
          t("settings.importConfirm", {
            summary,
            warnings: issues.length
              ? t("settings.warningsPrefix", { issues: issues.join("\n- ") })
              : "",
          }),
        )
      ) {
        return;
      }

      const currentRows = {
        cryptoHolding: cryptoHoldings,
        stockHolding: stockHoldings,
        property: properties,
        receivable: receivables,
        savingsAccount: savingsAccounts,
        netWorthSnapshot: snapshots,
        cashflowEntry: cashflowEntries,
        allocationTarget: allocationTargets,
        portfolioNote: portfolioNotes,
      };

      for (const table of BACKUP_TABLES) {
        for (const row of currentRows[table]) {
          evolu.update(
            table,
            { id: row.id as never, deleted: Evolu.sqliteTrue } as never,
          );
        }
      }

      for (const table of BACKUP_TABLES) {
        for (const row of payload.data[table]) {
          evolu.insert(table, row as never);
        }
      }

      setBackupStatus(
        issues.length
          ? t("settings.backupImportedWarnings", { issues: issues.join(" ") })
          : t("settings.backupImported"),
      );

      setTimeout(() => {
        evolu.reloadApp();
      }, 400);
    } catch {
      setBackupStatus(t("settings.backupImportFailed"));
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  }

  const totalExportableRecords =
    cryptoHoldings.length +
    stockHoldings.length +
    properties.length +
    receivables.length +
    savingsAccounts.length +
    snapshots.length +
    cashflowEntries.length +
    allocationTargets.length +
    portfolioNotes.length;

  function handleAutomationToggle(checked: boolean) {
    const next = { dailyOnOpen: checked };
    setAutomationSettings(next);
    localStorage.setItem(SNAPSHOT_AUTOMATION_SETTINGS_KEY, JSON.stringify(next));
  }

  function handleTargetDraftChange(assetClass: string, value: string) {
    setAllocationDrafts((current) => ({ ...current, [assetClass]: value }));
  }

  function handleTargetSave(assetClass: string) {
    const value = allocationDrafts[assetClass] ?? "";
    const parsed = value === "" ? 0 : Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    const current = allocationTargets.find(
      (row) => String(row.assetClass) === assetClass,
    );
    if (current) {
      evolu.update(
        "allocationTarget",
        {
          id: current.id as never,
          assetClass,
          targetPercent: parsed,
          notes: current.notes ?? null,
        } as never,
      );
    } else {
      evolu.insert(
        "allocationTarget",
        {
          assetClass,
          targetPercent: parsed,
          notes: null,
          deleted: Evolu.sqliteFalse,
        } as never,
      );
    }
    setAllocationStatus(t("settings.allocationUpdated"));
    setTimeout(() => setAllocationStatus(null), 2500);
  }

  return (
    <div style={{ maxWidth: "640px" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>
          {t("settings.title")}
        </h1>
        <p style={{ color: "var(--muted)", margin: "0.35rem 0 0", fontSize: "0.875rem" }}>
          {t("settings.subtitle")}
        </p>
      </div>

      {/* Seed Phrase */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 700 }}>
          🔑 {t("settings.seedTitle")}
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0 0 1rem" }}>
          {t("settings.seedDescription")}
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
            {copied ? t("settings.copied") : t("settings.copySeed")}
          </button>
          <button className="btn-ghost" onClick={handleGenerateNew}>
            {t("settings.generateSeed")}
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              setShowRestore(!showRestore);
              setRestoreError("");
              setRestoreInput("");
            }}
          >
            {showRestore ? t("settings.cancelRestore") : t("settings.restoreFromSeed")}
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
              {t("settings.enterSeed")}
            </label>
            <textarea
              value={restoreInput}
              onChange={(e) => {
                setRestoreInput(e.target.value);
                setRestoreError("");
              }}
              rows={3}
              placeholder={t("settings.seedPlaceholder")}
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
              {restoring ? t("common.saving") : t("settings.restoreAccount")}
            </button>
          </div>
        )}
      </div>

      {/* Relay / Sync */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "0.5rem",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
            ☁️ {t("settings.syncTitle")}
          </h2>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.75rem",
              color: relayStatus ? "var(--green)" : relayDot.color,
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
          {t("settings.syncDescription")}
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
          {t("settings.relayUrl")}
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
            {reconnecting ? t("common.saving") : t("common.save")}
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
          💡 {t("settings.syncHint")}
        </div>
      </div>

      <div className="card">
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 700 }}>
          💾 {t("settings.backupTitle")}
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0 0 1rem" }}>
          {t("settings.backupDescription")}
        </p>

        <div
          style={{
            marginBottom: "1rem",
            padding: "0.8rem 1rem",
            borderRadius: "8px",
            background: "rgba(59,130,246,0.06)",
            border: "1px solid rgba(59,130,246,0.16)",
            fontSize: "0.78rem",
            color: "var(--muted)",
          }}
        >
          {t("settings.exportableRecords", { count: totalExportableRecords })}
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button className="btn-primary" onClick={handleExportBackup}>
            {t("settings.exportBackup")}
          </button>
          <button
            className="btn-ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? t("settings.importing") : t("settings.importBackup")}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportBackup}
          style={{ display: "none" }}
        />

        {backupStatus && (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              background: "rgba(16,185,129,0.06)",
              border: "1px solid rgba(16,185,129,0.16)",
              fontSize: "0.78rem",
              color: "var(--muted)",
            }}
          >
            {backupStatus}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 700 }}>
          📸 {t("settings.snapshotAutomation")}
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0 0 1rem" }}>
          {t("settings.snapshotAutomationDescription")}
        </p>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.65rem",
            fontSize: "0.85rem",
            color: "var(--foreground)",
          }}
        >
          <input
            type="checkbox"
            checked={automationSettings.dailyOnOpen}
            onChange={(e) => handleAutomationToggle(e.target.checked)}
            style={{ width: "auto" }}
          />
          {t("settings.snapshotAutomationToggle")}
        </label>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 700 }}>
          🎯 {t("settings.targetAllocation")}
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0 0 1rem" }}>
          {t("settings.targetAllocationDescription")}
        </p>

        <div style={{ display: "grid", gap: "0.75rem" }}>
          {allocationRows.map((row) => (
            <div
              key={row.assetClass}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px",
                gap: "0.75rem",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{assetClassLabels[row.assetClass] ?? row.assetClass}</div>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={allocationDrafts[row.assetClass] ?? row.targetPercent.toString()}
                onChange={(e) => handleTargetDraftChange(row.assetClass, e.target.value)}
                onBlur={() => handleTargetSave(row.assetClass)}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--card-border)",
                  borderRadius: "8px",
                  padding: "0.55rem 0.7rem",
                  color: "var(--foreground)",
                }}
              />
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: "1rem",
            fontSize: "0.78rem",
            color:
              Math.abs(totalTargetPercent - 100) < 0.001
                ? "var(--green)"
                : "var(--yellow)",
          }}
        >
          {t("settings.totalTargetWeight", { value: totalTargetPercent.toFixed(1) })}
        </div>
        {allocationStatus && (
          <div style={{ marginTop: "0.6rem", fontSize: "0.78rem", color: "var(--muted)" }}>
            {allocationStatus}
          </div>
        )}
      </div>
    </div>
  );
}

// Outer component — Suspense is provided by EvoluClientProvider in layout
export default function SettingsPage() {
  return <SettingsContent />;
}
