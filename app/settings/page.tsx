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
  PORTFOLIO_NOTES_FEATURE_ENABLED_KEY,
  setRelayUrl,
  SNAPSHOT_AUTOMATION_SETTINGS_KEY,
  TAG_CLOUD_FEATURE_ENABLED_KEY,
  TARGET_ALLOCATION_FEATURE_ENABLED_KEY,
  useEvolu,
} from "@/lib/evolu";
import {
  ASSET_CLASSES,
  DEFAULT_ALLOCATION_TARGETS,
  DEFAULT_SNAPSHOT_AUTOMATION_SETTINGS,
} from "@/lib/portfolio";
import {
  readMarketApiKeys,
  saveMarketApiKeys,
  withMarketApiHeaders,
} from "@/lib/marketApiKeys";
import { useI18n } from "@/components/i18n/I18nProvider";

interface ProviderConnectionState {
  checkedAt: string | null;
  successAt: string | null;
  error: string | null;
  retryAfter: string | null;
}

interface EncryptedMarketKeysPayload {
  v: 1;
  createdAt: string;
  salt: string;
  iv: string;
  ciphertext: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let output = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    output += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(output);
}

function base64ToBytes(value: string): Uint8Array {
  const raw = atob(value);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

async function deriveEncryptionKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt as unknown as BufferSource,
      iterations: 150_000,
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptMarketKeysPayload(
  keys: { coingecko: string; yahooFinance: string },
  passphrase: string,
): Promise<EncryptedMarketKeysPayload> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveEncryptionKey(passphrase, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    encoder.encode(JSON.stringify(keys)),
  );

  return {
    v: 1,
    createdAt: new Date().toISOString(),
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

async function decryptMarketKeysPayload(
  payload: EncryptedMarketKeysPayload,
  passphrase: string,
): Promise<{ coingecko: string; yahooFinance: string }> {
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.ciphertext);
  const key = await deriveEncryptionKey(passphrase, salt);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    ciphertext as unknown as BufferSource,
  );
  const decoded = new TextDecoder().decode(plaintext);
  const parsed = JSON.parse(decoded) as Partial<{
    coingecko: string;
    yahooFinance: string;
  }>;

  return {
    coingecko: (parsed.coingecko ?? "").trim(),
    yahooFinance: (parsed.yahooFinance ?? "").trim(),
  };
}

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
  const [targetAllocationEnabled, setTargetAllocationEnabled] = useState(
    () => {
      if (typeof window === "undefined") return false;
      try {
        const stored = window.localStorage.getItem(
          TARGET_ALLOCATION_FEATURE_ENABLED_KEY,
        );
        return stored ? JSON.parse(stored) === true : false;
      } catch {
        return false;
      }
    },
  );
  const [portfolioNotesEnabled, setPortfolioNotesEnabled] = useState(
    () => {
      if (typeof window === "undefined") return false;
      try {
        const stored = window.localStorage.getItem(
          PORTFOLIO_NOTES_FEATURE_ENABLED_KEY,
        );
        return stored ? JSON.parse(stored) === true : false;
      } catch {
        return false;
      }
    },
  );
  const [tagCloudEnabled, setTagCloudEnabled] = useState(
    () => {
      if (typeof window === "undefined") return false;
      try {
        const stored = window.localStorage.getItem(
          TAG_CLOUD_FEATURE_ENABLED_KEY,
        );
        return stored ? JSON.parse(stored) === true : false;
      } catch {
        return false;
      }
    },
  );
  const [allocationDrafts, setAllocationDrafts] = useState<
    Record<string, string>
  >({});

  // Relay settings
  const [relayUrl, setRelayUrlState] = useState("");
  const [savedRelay, setSavedRelay] = useState("");
  const [relayStatus, setRelayStatus] = useState<null | boolean>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [coingeckoApiKey, setCoingeckoApiKey] = useState("");
  const [yahooFinanceApiKey, setYahooFinanceApiKey] = useState("");
  const [marketSettingsStatus, setMarketSettingsStatus] = useState<string | null>(
    null,
  );
  const [marketSettingsStatusTone, setMarketSettingsStatusTone] = useState<
    "neutral" | "ok" | "warning" | "error"
  >("neutral");
  const [testingMarketKeys, setTestingMarketKeys] = useState(false);
  const [marketSecretPhrase, setMarketSecretPhrase] = useState("");
  const [marketKeyTransferStatus, setMarketKeyTransferStatus] = useState<
    string | null
  >(null);
  const [marketKeyTransferTone, setMarketKeyTransferTone] = useState<
    "neutral" | "ok" | "warning" | "error"
  >("neutral");
  const [importingMarketKeyBundle, setImportingMarketKeyBundle] = useState(false);
  const marketKeyImportInputRef = useRef<HTMLInputElement | null>(null);
  const [providerStatus, setProviderStatus] = useState<{
    coingecko: ProviderConnectionState;
    stocks: ProviderConnectionState;
  }>({
    coingecko: {
      checkedAt: null,
      successAt: null,
      error: null,
      retryAfter: null,
    },
    stocks: {
      checkedAt: null,
      successAt: null,
      error: null,
      retryAfter: null,
    },
  });

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
    const keys = readMarketApiKeys();
    setCoingeckoApiKey(keys.coingecko);
    setYahooFinanceApiKey(keys.yahooFinance);
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

  function handleTargetAllocationFeatureToggle(checked: boolean) {
    setTargetAllocationEnabled(checked);
    localStorage.setItem(
      TARGET_ALLOCATION_FEATURE_ENABLED_KEY,
      JSON.stringify(checked),
    );
  }

  function handlePortfolioNotesFeatureToggle(checked: boolean) {
    setPortfolioNotesEnabled(checked);
    localStorage.setItem(
      PORTFOLIO_NOTES_FEATURE_ENABLED_KEY,
      JSON.stringify(checked),
    );
  }

  function handleTagCloudFeatureToggle(checked: boolean) {
    setTagCloudEnabled(checked);
    localStorage.setItem(
      TAG_CLOUD_FEATURE_ENABLED_KEY,
      JSON.stringify(checked),
    );
  }

  function getMarketRequestInitFromDraft(): RequestInit {
    const init = withMarketApiHeaders();
    const headers = new Headers(init.headers);

    const coingecko = coingeckoApiKey.trim();
    const yahoo = yahooFinanceApiKey.trim();

    if (coingecko) headers.set("x-wt-coingecko-api-key", coingecko);
    else headers.delete("x-wt-coingecko-api-key");

    if (yahoo) headers.set("x-wt-yahoo-finance-api-key", yahoo);
    else headers.delete("x-wt-yahoo-finance-api-key");

    return { ...init, headers };
  }

  function setProviderState(
    provider: "coingecko" | "stocks",
    update: Partial<ProviderConnectionState>,
  ) {
    setProviderStatus((current) => ({
      ...current,
      [provider]: {
        ...current[provider],
        ...update,
      },
    }));
  }

  function formatProviderTime(value: string | null): string {
    if (!value) return t("settings.marketProviderNever");
    return new Date(value).toLocaleString();
  }

  function handleSaveMarketApiKeys() {
    saveMarketApiKeys({
      coingecko: coingeckoApiKey,
      yahooFinance: yahooFinanceApiKey,
    });
    setCoingeckoApiKey(coingeckoApiKey.trim());
    setYahooFinanceApiKey(yahooFinanceApiKey.trim());
    setMarketSettingsStatus(t("settings.marketKeysSaved"));
    setMarketSettingsStatusTone("ok");
  }

  function handleClearMarketApiKeys() {
    setCoingeckoApiKey("");
    setYahooFinanceApiKey("");
    saveMarketApiKeys({
      coingecko: "",
      yahooFinance: "",
    });
    setMarketSettingsStatus(t("settings.marketKeysCleared"));
    setMarketSettingsStatusTone("warning");
  }

  async function handleExportEncryptedMarketKeys() {
    const passphrase = (marketSecretPhrase || mnemonic).trim();
    if (!passphrase) {
      setMarketKeyTransferStatus(t("settings.marketKeyTransferPassphraseRequired"));
      setMarketKeyTransferTone("warning");
      return;
    }

    const payload = await encryptMarketKeysPayload(
      {
        coingecko: coingeckoApiKey.trim(),
        yahooFinance: yahooFinanceApiKey.trim(),
      },
      passphrase,
    );

    const fileName = `wealth-tracker-market-keys-${new Date().toISOString().slice(0, 10)}.enc.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);

    setMarketKeyTransferStatus(t("settings.marketKeyTransferExported", { fileName }));
    setMarketKeyTransferTone("ok");
  }

  async function handleImportEncryptedMarketKeys(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    const passphrase = (marketSecretPhrase || mnemonic).trim();
    if (!passphrase) {
      setMarketKeyTransferStatus(t("settings.marketKeyTransferPassphraseRequired"));
      setMarketKeyTransferTone("warning");
      event.target.value = "";
      return;
    }

    setImportingMarketKeyBundle(true);
    try {
      const content = await file.text();
      const payload = JSON.parse(content) as Partial<EncryptedMarketKeysPayload>;
      if (
        payload.v !== 1 ||
        typeof payload.salt !== "string" ||
        typeof payload.iv !== "string" ||
        typeof payload.ciphertext !== "string"
      ) {
        throw new Error("Invalid payload");
      }

      const decrypted = await decryptMarketKeysPayload(
        payload as EncryptedMarketKeysPayload,
        passphrase,
      );

      setCoingeckoApiKey(decrypted.coingecko);
      setYahooFinanceApiKey(decrypted.yahooFinance);
      saveMarketApiKeys(decrypted);
      setMarketKeyTransferStatus(t("settings.marketKeyTransferImported"));
      setMarketKeyTransferTone("ok");
      setMarketSettingsStatus(t("settings.marketKeysSaved"));
      setMarketSettingsStatusTone("ok");
    } catch {
      setMarketKeyTransferStatus(t("settings.marketKeyTransferImportFailed"));
      setMarketKeyTransferTone("error");
    } finally {
      setImportingMarketKeyBundle(false);
      event.target.value = "";
    }
  }

  async function handleTestMarketApiKeys() {
    setTestingMarketKeys(true);
    setMarketSettingsStatus(null);
    setMarketSettingsStatusTone("neutral");

    const marketInit = getMarketRequestInitFromDraft();

    try {
      const [cryptoResult, stocksResult] = await Promise.allSettled([
        fetch("/api/crypto/prices?symbols=BTC", marketInit),
        fetch("/api/stocks/prices?tickers=AAPL", marketInit),
      ]);

      const cryptoOk =
        cryptoResult.status === "fulfilled" && cryptoResult.value.ok;
      const stocksOk =
        stocksResult.status === "fulfilled" && stocksResult.value.ok;
      const checkedAt = new Date().toISOString();

      if (cryptoResult.status === "fulfilled") {
        let errorMessage: string | null = null;
        if (!cryptoResult.value.ok) {
          try {
            const errorPayload = (await cryptoResult.value.clone().json()) as {
              error?: string;
            };
            errorMessage = errorPayload.error ?? `HTTP ${cryptoResult.value.status}`;
          } catch {
            errorMessage = `HTTP ${cryptoResult.value.status}`;
          }
        }

        setProviderState("coingecko", {
          checkedAt,
          successAt: cryptoResult.value.ok ? checkedAt : providerStatus.coingecko.successAt,
          error: errorMessage,
          retryAfter: cryptoResult.value.headers.get("Retry-After"),
        });
      } else {
        setProviderState("coingecko", {
          checkedAt,
          error: cryptoResult.reason instanceof Error ? cryptoResult.reason.message : "Request failed",
        });
      }

      if (stocksResult.status === "fulfilled") {
        let errorMessage: string | null = null;
        if (!stocksResult.value.ok) {
          try {
            const errorPayload = (await stocksResult.value.clone().json()) as {
              error?: string;
            };
            errorMessage = errorPayload.error ?? `HTTP ${stocksResult.value.status}`;
          } catch {
            errorMessage = `HTTP ${stocksResult.value.status}`;
          }
        }
        setProviderState("stocks", {
          checkedAt,
          successAt: stocksResult.value.ok ? checkedAt : providerStatus.stocks.successAt,
          error: errorMessage,
          retryAfter: stocksResult.value.headers.get("Retry-After"),
        });
      } else {
        setProviderState("stocks", {
          checkedAt,
          error: stocksResult.reason instanceof Error ? stocksResult.reason.message : "Request failed",
        });
      }

      if (cryptoOk && stocksOk) {
        setMarketSettingsStatus(t("settings.marketTestAllOk"));
        setMarketSettingsStatusTone("ok");
        return;
      }

      if (cryptoOk && !stocksOk) {
        setMarketSettingsStatus(t("settings.marketTestStocksFailed"));
        setMarketSettingsStatusTone("warning");
        return;
      }

      if (!cryptoOk && stocksOk) {
        setMarketSettingsStatus(t("settings.marketTestCryptoFailed"));
        setMarketSettingsStatusTone("warning");
        return;
      }

      setMarketSettingsStatus(t("settings.marketTestFailed"));
      setMarketSettingsStatusTone("error");
    } catch {
      setMarketSettingsStatus(t("settings.marketTestFailed"));
      setMarketSettingsStatusTone("error");
    } finally {
      setTestingMarketKeys(false);
    }
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

      <div
        id="market-data"
        className="card"
        style={{
          marginBottom: "1.5rem",
          background:
            "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(6,182,212,0.06) 100%)",
        }}
      >
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 700 }}>
          📈 {t("settings.marketKeysTitle")}
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0 0 1rem" }}>
          {t("settings.marketKeysDescription")}
        </p>

        <div style={{ display: "grid", gap: "0.85rem" }}>
          <div>
            <label style={{ marginBottom: "0.35rem" }}>
              {t("settings.coingeckoApiKey")}
            </label>
            <input
              type="password"
              value={coingeckoApiKey}
              onChange={(e) => setCoingeckoApiKey(e.target.value)}
              placeholder={t("settings.coingeckoApiKeyPlaceholder")}
              autoComplete="off"
            />
          </div>
          <div>
            <label style={{ marginBottom: "0.35rem" }}>
              {t("settings.yahooApiKey")}
            </label>
            <input
              type="password"
              value={yahooFinanceApiKey}
              onChange={(e) => setYahooFinanceApiKey(e.target.value)}
              placeholder={t("settings.yahooApiKeyPlaceholder")}
              autoComplete="off"
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
          <button className="btn-primary" onClick={handleSaveMarketApiKeys}>
            {t("settings.saveMarketKeys")}
          </button>
          <button
            className="btn-ghost"
            onClick={handleTestMarketApiKeys}
            disabled={testingMarketKeys}
          >
            {testingMarketKeys ? t("common.loading") : t("settings.testMarketKeys")}
          </button>
          <button className="btn-ghost" onClick={handleClearMarketApiKeys}>
            {t("settings.clearMarketKeys")}
          </button>
        </div>

        <div
          style={{
            marginTop: "0.9rem",
            fontSize: "0.8rem",
            color:
              marketSettingsStatusTone === "ok"
                ? "var(--green)"
                : marketSettingsStatusTone === "warning"
                  ? "var(--yellow)"
                  : marketSettingsStatusTone === "error"
                    ? "var(--red)"
                    : "var(--muted)",
          }}
        >
          {marketSettingsStatus ?? t("settings.marketKeysHint")}
        </div>

        <div
          style={{
            marginTop: "1rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "10px",
              padding: "0.7rem 0.8rem",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div style={{ fontSize: "0.76rem", color: "var(--muted)", marginBottom: "0.4rem" }}>
              {t("settings.coingeckoApiKey")}
            </div>
            <div style={{ fontSize: "0.78rem" }}>
              {t("settings.marketProviderLastSuccess", {
                value: formatProviderTime(providerStatus.coingecko.successAt),
              })}
            </div>
            <div style={{ fontSize: "0.74rem", color: "var(--muted)", marginTop: "0.3rem" }}>
              {providerStatus.coingecko.error
                ? t("settings.marketProviderError", {
                    value: providerStatus.coingecko.error,
                  })
                : t("settings.marketProviderOk")}
            </div>
            {providerStatus.coingecko.retryAfter && (
              <div style={{ fontSize: "0.74rem", color: "var(--yellow)", marginTop: "0.2rem" }}>
                {t("settings.marketProviderRetryAfter", {
                  value: providerStatus.coingecko.retryAfter,
                })}
              </div>
            )}
          </div>

          <div
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "10px",
              padding: "0.7rem 0.8rem",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div style={{ fontSize: "0.76rem", color: "var(--muted)", marginBottom: "0.4rem" }}>
              {t("settings.yahooApiKey")}
            </div>
            <div style={{ fontSize: "0.78rem" }}>
              {t("settings.marketProviderLastSuccess", {
                value: formatProviderTime(providerStatus.stocks.successAt),
              })}
            </div>
            <div style={{ fontSize: "0.74rem", color: "var(--muted)", marginTop: "0.3rem" }}>
              {providerStatus.stocks.error
                ? t("settings.marketProviderError", { value: providerStatus.stocks.error })
                : t("settings.marketProviderOk")}
            </div>
            {providerStatus.stocks.retryAfter && (
              <div style={{ fontSize: "0.74rem", color: "var(--yellow)", marginTop: "0.2rem" }}>
                {t("settings.marketProviderRetryAfter", {
                  value: providerStatus.stocks.retryAfter,
                })}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: "1rem",
            borderTop: "1px dashed rgba(255,255,255,0.14)",
            paddingTop: "1rem",
          }}
        >
          <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.45rem" }}>
            {t("settings.marketKeyTransferTitle")}
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.76rem", margin: "0 0 0.75rem" }}>
            {t("settings.marketKeyTransferDescription")}
          </p>
          <label style={{ marginBottom: "0.35rem" }}>
            {t("settings.marketKeyTransferPassphrase")}
          </label>
          <input
            type="password"
            value={marketSecretPhrase}
            onChange={(e) => setMarketSecretPhrase(e.target.value)}
            placeholder={t("settings.marketKeyTransferPassphrasePlaceholder")}
            autoComplete="off"
          />
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
            <button className="btn-ghost" onClick={handleExportEncryptedMarketKeys}>
              {t("settings.marketKeyTransferExport")}
            </button>
            <button
              className="btn-ghost"
              onClick={() => marketKeyImportInputRef.current?.click()}
              disabled={importingMarketKeyBundle}
            >
              {importingMarketKeyBundle
                ? t("settings.marketKeyTransferImporting")
                : t("settings.marketKeyTransferImport")}
            </button>
          </div>
          <input
            ref={marketKeyImportInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportEncryptedMarketKeys}
            style={{ display: "none" }}
          />
          <div
            style={{
              marginTop: "0.6rem",
              fontSize: "0.76rem",
              color:
                marketKeyTransferTone === "ok"
                  ? "var(--green)"
                  : marketKeyTransferTone === "warning"
                    ? "var(--yellow)"
                    : marketKeyTransferTone === "error"
                      ? "var(--red)"
                      : "var(--muted)",
            }}
          >
            {marketKeyTransferStatus ?? t("settings.marketKeyTransferHint")}
          </div>
        </div>
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
          📝 {t("settings.portfolioNotes")}
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0 0 1rem" }}>
          {t("settings.portfolioNotesDescription")}
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
            checked={portfolioNotesEnabled}
            onChange={(e) => handlePortfolioNotesFeatureToggle(e.target.checked)}
            style={{ width: "auto" }}
          />
          {t("settings.portfolioNotesToggle")}
        </label>
        <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0.85rem 0 0" }}>
          {portfolioNotesEnabled
            ? t("settings.portfolioNotesEnabledHint")
            : t("settings.portfolioNotesDisabledHint")}
        </p>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 700 }}>
          🏷️ {t("settings.tagCloud")}
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0 0 1rem" }}>
          {t("settings.tagCloudDescription")}
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
            checked={tagCloudEnabled}
            onChange={(e) => handleTagCloudFeatureToggle(e.target.checked)}
            style={{ width: "auto" }}
          />
          {t("settings.tagCloudToggle")}
        </label>
        <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0.85rem 0 0" }}>
          {tagCloudEnabled
            ? t("settings.tagCloudEnabledHint")
            : t("settings.tagCloudDisabledHint")}
        </p>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 700 }}>
          🎯 {t("settings.targetAllocation")}
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0 0 1rem" }}>
          {t("settings.targetAllocationDescription")}
        </p>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.65rem",
            fontSize: "0.85rem",
            color: "var(--foreground)",
            marginBottom: targetAllocationEnabled ? "1rem" : 0,
          }}
        >
          <input
            type="checkbox"
            checked={targetAllocationEnabled}
            onChange={(e) => handleTargetAllocationFeatureToggle(e.target.checked)}
            style={{ width: "auto" }}
          />
          {t("settings.targetAllocationToggle")}
        </label>

        {targetAllocationEnabled ? (
          <>
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
          </>
        ) : (
          <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0.85rem 0 0" }}>
            {t("settings.targetAllocationDisabledHint")}
          </p>
        )}
      </div>
    </div>
  );
}

// Outer component — Suspense is provided by EvoluClientProvider in layout
export default function SettingsPage() {
  return <SettingsContent />;
}
