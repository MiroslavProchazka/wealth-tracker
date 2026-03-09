"use client";

import { useEffect, useRef, useState } from "react";
import {
  readMarketApiKeys,
  saveMarketApiKeys,
  withMarketApiHeaders,
} from "@/lib/marketApiKeys";
import { useEvolu } from "@/lib/evolu";
import { useI18n } from "@/components/i18n/I18nProvider";

interface ProviderConnectionState {
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

export default function SettingsPage() {
  const evolu = useEvolu();
  const { t } = useI18n();

  const [mnemonic, setMnemonic] = useState("");
  const [coingeckoApiKey, setCoingeckoApiKey] = useState("");
  const [yahooFinanceApiKey, setYahooFinanceApiKey] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "ok" | "warning" | "error">("neutral");
  const [testingKeys, setTestingKeys] = useState(false);
  const [transferPhrase, setTransferPhrase] = useState("");
  const [transferStatus, setTransferStatus] = useState<string | null>(null);
  const [transferTone, setTransferTone] = useState<"neutral" | "ok" | "warning" | "error">("neutral");
  const [importingBundle, setImportingBundle] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [providerStatus, setProviderStatus] = useState<{
    coingecko: ProviderConnectionState;
    stocks: ProviderConnectionState;
  }>({
    coingecko: { successAt: null, error: null, retryAfter: null },
    stocks: { successAt: null, error: null, retryAfter: null },
  });

  useEffect(() => {
    const keys = readMarketApiKeys();
    setCoingeckoApiKey(keys.coingecko);
    setYahooFinanceApiKey(keys.yahooFinance);
    evolu.appOwner.then((owner) => setMnemonic(owner.mnemonic ?? ""));
  }, [evolu]);

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

  function saveKeys() {
    saveMarketApiKeys({ coingecko: coingeckoApiKey, yahooFinance: yahooFinanceApiKey });
    setCoingeckoApiKey(coingeckoApiKey.trim());
    setYahooFinanceApiKey(yahooFinanceApiKey.trim());
    setStatus(t("marketSettings.keysSaved"));
    setStatusTone("ok");
  }

  function clearKeys() {
    setCoingeckoApiKey("");
    setYahooFinanceApiKey("");
    saveMarketApiKeys({ coingecko: "", yahooFinance: "" });
    setStatus(t("marketSettings.keysCleared"));
    setStatusTone("warning");
  }

  function providerTime(value: string | null): string {
    if (!value) return t("marketSettings.providerNever");
    return new Date(value).toLocaleString();
  }

  async function testKeys() {
    setTestingKeys(true);
    setStatus(null);
    setStatusTone("neutral");
    const init = getMarketRequestInitFromDraft();

    try {
      const [cryptoResult, stocksResult] = await Promise.allSettled([
        fetch("/api/crypto/prices?symbols=BTC", init),
        fetch("/api/stocks/prices?tickers=AAPL", init),
      ]);

      const now = new Date().toISOString();

      if (cryptoResult.status === "fulfilled") {
        let error: string | null = null;
        if (!cryptoResult.value.ok) {
          try {
            const body = (await cryptoResult.value.clone().json()) as { error?: string };
            error = body.error ?? `HTTP ${cryptoResult.value.status}`;
          } catch {
            error = `HTTP ${cryptoResult.value.status}`;
          }
        }
        setProviderStatus((prev) => ({
          ...prev,
          coingecko: {
            successAt: cryptoResult.value.ok ? now : prev.coingecko.successAt,
            error,
            retryAfter: cryptoResult.value.headers.get("Retry-After"),
          },
        }));
      }

      if (stocksResult.status === "fulfilled") {
        let error: string | null = null;
        if (!stocksResult.value.ok) {
          try {
            const body = (await stocksResult.value.clone().json()) as { error?: string };
            error = body.error ?? `HTTP ${stocksResult.value.status}`;
          } catch {
            error = `HTTP ${stocksResult.value.status}`;
          }
        }
        setProviderStatus((prev) => ({
          ...prev,
          stocks: {
            successAt: stocksResult.value.ok ? now : prev.stocks.successAt,
            error,
            retryAfter: stocksResult.value.headers.get("Retry-After"),
          },
        }));
      }

      const cryptoOk = cryptoResult.status === "fulfilled" && cryptoResult.value.ok;
      const stocksOk = stocksResult.status === "fulfilled" && stocksResult.value.ok;

      if (cryptoOk && stocksOk) {
        setStatus(t("marketSettings.testAllOk"));
        setStatusTone("ok");
      } else if (cryptoOk && !stocksOk) {
        setStatus(t("marketSettings.testStocksFailed"));
        setStatusTone("warning");
      } else if (!cryptoOk && stocksOk) {
        setStatus(t("marketSettings.testCryptoFailed"));
        setStatusTone("warning");
      } else {
        setStatus(t("marketSettings.testFailed"));
        setStatusTone("error");
      }
    } catch {
      setStatus(t("marketSettings.testFailed"));
      setStatusTone("error");
    } finally {
      setTestingKeys(false);
    }
  }

  async function exportEncryptedBundle() {
    const passphrase = (transferPhrase || mnemonic).trim();
    if (!passphrase) {
      setTransferStatus(t("marketSettings.transferPassphraseRequired"));
      setTransferTone("warning");
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

    setTransferStatus(t("marketSettings.transferExported", { fileName }));
    setTransferTone("ok");
  }

  async function importEncryptedBundle(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const passphrase = (transferPhrase || mnemonic).trim();
    if (!passphrase) {
      setTransferStatus(t("marketSettings.transferPassphraseRequired"));
      setTransferTone("warning");
      event.target.value = "";
      return;
    }

    setImportingBundle(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as Partial<EncryptedMarketKeysPayload>;
      if (
        payload.v !== 1 ||
        typeof payload.salt !== "string" ||
        typeof payload.iv !== "string" ||
        typeof payload.ciphertext !== "string"
      ) {
        throw new Error("Invalid payload");
      }

      const decrypted = await decryptMarketKeysPayload(payload as EncryptedMarketKeysPayload, passphrase);
      setCoingeckoApiKey(decrypted.coingecko);
      setYahooFinanceApiKey(decrypted.yahooFinance);
      saveMarketApiKeys(decrypted);
      setTransferStatus(t("marketSettings.transferImported"));
      setTransferTone("ok");
      setStatus(t("marketSettings.keysSaved"));
      setStatusTone("ok");
    } catch {
      setTransferStatus(t("marketSettings.transferImportFailed"));
      setTransferTone("error");
    } finally {
      setImportingBundle(false);
      event.target.value = "";
    }
  }

  return (
    <div style={{ maxWidth: "720px" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700 }}>
          {t("marketSettings.title")}
        </h1>
        <p style={{ color: "var(--muted)", margin: "0.35rem 0 0", fontSize: "0.875rem" }}>
          {t("marketSettings.subtitle")}
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
          📈 {t("marketSettings.keysTitle")}
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0 0 1rem" }}>
          {t("marketSettings.keysDescription")}
        </p>

        <div style={{ display: "grid", gap: "0.85rem" }}>
          <div>
            <label style={{ marginBottom: "0.35rem" }}>{t("marketSettings.coingeckoApiKey")}</label>
            <input
              type="password"
              value={coingeckoApiKey}
              onChange={(e) => setCoingeckoApiKey(e.target.value)}
              placeholder={t("marketSettings.coingeckoApiKeyPlaceholder")}
              autoComplete="off"
            />
          </div>
          <div>
            <label style={{ marginBottom: "0.35rem" }}>{t("marketSettings.yahooApiKey")}</label>
            <input
              type="password"
              value={yahooFinanceApiKey}
              onChange={(e) => setYahooFinanceApiKey(e.target.value)}
              placeholder={t("marketSettings.yahooApiKeyPlaceholder")}
              autoComplete="off"
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
          <button className="btn-primary" onClick={saveKeys}>
            {t("marketSettings.saveKeys")}
          </button>
          <button className="btn-ghost" onClick={testKeys} disabled={testingKeys}>
            {testingKeys ? t("common.loading") : t("marketSettings.testKeys")}
          </button>
          <button className="btn-ghost" onClick={clearKeys}>
            {t("marketSettings.clearKeys")}
          </button>
        </div>

        <div
          style={{
            marginTop: "0.9rem",
            fontSize: "0.8rem",
            color:
              statusTone === "ok"
                ? "var(--green)"
                : statusTone === "warning"
                  ? "var(--yellow)"
                  : statusTone === "error"
                    ? "var(--red)"
                    : "var(--muted)",
          }}
        >
          {status ?? t("marketSettings.keysHint")}
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
              {t("marketSettings.coingeckoApiKey")}
            </div>
            <div style={{ fontSize: "0.78rem" }}>
              {t("marketSettings.providerLastSuccess", {
                value: providerTime(providerStatus.coingecko.successAt),
              })}
            </div>
            <div style={{ fontSize: "0.74rem", color: "var(--muted)", marginTop: "0.3rem" }}>
              {providerStatus.coingecko.error
                ? t("marketSettings.providerError", { value: providerStatus.coingecko.error })
                : t("marketSettings.providerOk")}
            </div>
            {providerStatus.coingecko.retryAfter && (
              <div style={{ fontSize: "0.74rem", color: "var(--yellow)", marginTop: "0.2rem" }}>
                {t("marketSettings.providerRetryAfter", {
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
              {t("marketSettings.yahooApiKey")}
            </div>
            <div style={{ fontSize: "0.78rem" }}>
              {t("marketSettings.providerLastSuccess", {
                value: providerTime(providerStatus.stocks.successAt),
              })}
            </div>
            <div style={{ fontSize: "0.74rem", color: "var(--muted)", marginTop: "0.3rem" }}>
              {providerStatus.stocks.error
                ? t("marketSettings.providerError", { value: providerStatus.stocks.error })
                : t("marketSettings.providerOk")}
            </div>
            {providerStatus.stocks.retryAfter && (
              <div style={{ fontSize: "0.74rem", color: "var(--yellow)", marginTop: "0.2rem" }}>
                {t("marketSettings.providerRetryAfter", {
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
            {t("marketSettings.transferTitle")}
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.76rem", margin: "0 0 0.75rem" }}>
            {t("marketSettings.transferDescription")}
          </p>
          <label style={{ marginBottom: "0.35rem" }}>
            {t("marketSettings.transferPassphrase")}
          </label>
          <input
            type="password"
            value={transferPhrase}
            onChange={(e) => setTransferPhrase(e.target.value)}
            placeholder={t("marketSettings.transferPassphrasePlaceholder")}
            autoComplete="off"
          />
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
            <button className="btn-ghost" onClick={exportEncryptedBundle}>
              {t("marketSettings.transferExport")}
            </button>
            <button
              className="btn-ghost"
              onClick={() => importInputRef.current?.click()}
              disabled={importingBundle}
            >
              {importingBundle
                ? t("marketSettings.transferImporting")
                : t("marketSettings.transferImport")}
            </button>
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={importEncryptedBundle}
            style={{ display: "none" }}
          />
          <div
            style={{
              marginTop: "0.6rem",
              fontSize: "0.76rem",
              color:
                transferTone === "ok"
                  ? "var(--green)"
                  : transferTone === "warning"
                    ? "var(--yellow)"
                    : transferTone === "error"
                      ? "var(--red)"
                      : "var(--muted)",
            }}
          >
            {transferStatus ?? t("marketSettings.transferHint")}
          </div>
        </div>
      </div>
    </div>
  );
}
