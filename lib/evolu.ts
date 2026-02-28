"use client";

import * as Evolu from "@evolu/common";
import { createEvolu, SimpleName } from "@evolu/common";
import { createUseEvolu, EvoluProvider } from "@evolu/react";
import { evoluReactWebDeps } from "@evolu/react-web";

const RELAY_URL_KEY = "wealthTracker_relayUrl";
const DEFAULT_RELAY_URL = "wss://free.evoluhq.com";

export const getRelayUrl = (): string => {
  if (typeof window === "undefined") return DEFAULT_RELAY_URL;
  const stored = window.localStorage.getItem(RELAY_URL_KEY);
  if (!stored) return DEFAULT_RELAY_URL;
  if (!stored.startsWith("ws://") && !stored.startsWith("wss://"))
    return DEFAULT_RELAY_URL;
  return stored;
};

export const setRelayUrl = (url: string): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RELAY_URL_KEY, url);
};

export const Schema = {
  cryptoHolding: {
    id: Evolu.id("CryptoHolding"),
    symbol: Evolu.NonEmptyTrimmedString100,
    name: Evolu.NonEmptyTrimmedString100,
    amount: Evolu.NonNegativeNumber,
    buyPrice: Evolu.nullOr(Evolu.NonNegativeNumber), // avg buy price in CZK per coin
    notes: Evolu.nullOr(Evolu.TrimmedString1000),
    deleted: Evolu.nullOr(Evolu.SqliteBoolean),
  },
  stockHolding: {
    id: Evolu.id("StockHolding"),
    ticker: Evolu.NonEmptyTrimmedString100,
    name: Evolu.NonEmptyTrimmedString100,
    shares: Evolu.NonNegativeNumber,
    currency: Evolu.NonEmptyTrimmedString100,
    buyPrice: Evolu.nullOr(Evolu.NonNegativeNumber), // avg buy price in original currency
    exchange: Evolu.nullOr(Evolu.TrimmedString100),  // e.g. NASDAQ, PSE, XETRA
    sector: Evolu.nullOr(Evolu.TrimmedString100),    // e.g. Technology, Healthcare
    notes: Evolu.nullOr(Evolu.TrimmedString1000),
    deleted: Evolu.nullOr(Evolu.SqliteBoolean),
  },
  property: {
    id: Evolu.id("Property"),
    name: Evolu.NonEmptyTrimmedString100,
    address: Evolu.nullOr(Evolu.TrimmedString1000),
    estimatedValue: Evolu.NonNegativeNumber,
    currency: Evolu.NonEmptyTrimmedString100,
    hasMortgage: Evolu.SqliteBoolean,
    originalLoan: Evolu.nullOr(Evolu.NonNegativeNumber),
    remainingLoan: Evolu.nullOr(Evolu.NonNegativeNumber),
    monthlyPayment: Evolu.nullOr(Evolu.NonNegativeNumber),
    interestRate: Evolu.nullOr(Evolu.NonNegativeNumber),
    mortgageStart: Evolu.nullOr(Evolu.DateIso),
    mortgageEnd: Evolu.nullOr(Evolu.DateIso),
    notes: Evolu.nullOr(Evolu.TrimmedString1000),
    deleted: Evolu.nullOr(Evolu.SqliteBoolean),
  },
  receivable: {
    id: Evolu.id("Receivable"),
    description: Evolu.NonEmptyTrimmedString100,
    client: Evolu.nullOr(Evolu.TrimmedString100),
    amount: Evolu.NonNegativeNumber,
    currency: Evolu.NonEmptyTrimmedString100,
    status: Evolu.NonEmptyTrimmedString100,
    dueDate: Evolu.nullOr(Evolu.DateIso),
    notes: Evolu.nullOr(Evolu.TrimmedString1000),
    deleted: Evolu.nullOr(Evolu.SqliteBoolean),
  },
  savingsAccount: {
    id: Evolu.id("SavingsAccount"),
    name: Evolu.NonEmptyTrimmedString100,
    bank: Evolu.NonEmptyTrimmedString100,
    balance: Evolu.NonNegativeNumber,
    currency: Evolu.NonEmptyTrimmedString100,
    interestRate: Evolu.nullOr(Evolu.NonNegativeNumber),
    notes: Evolu.nullOr(Evolu.TrimmedString1000),
    deleted: Evolu.nullOr(Evolu.SqliteBoolean),
  },
  bankAccount: {
    id: Evolu.id("BankAccount"),
    name: Evolu.NonEmptyTrimmedString100,
    bank: Evolu.NonEmptyTrimmedString100,
    balance: Evolu.NonNegativeNumber,
    currency: Evolu.NonEmptyTrimmedString100,
    iban: Evolu.nullOr(Evolu.TrimmedString100),
    notes: Evolu.nullOr(Evolu.TrimmedString1000),
    deleted: Evolu.nullOr(Evolu.SqliteBoolean),
  },
  goal: {
    id: Evolu.id("Goal"),
    name: Evolu.NonEmptyTrimmedString100,
    targetAmount: Evolu.NonNegativeNumber,
    currency: Evolu.NonEmptyTrimmedString100,
    deadline: Evolu.nullOr(Evolu.DateIso),
    notes: Evolu.nullOr(Evolu.TrimmedString1000),
    deleted: Evolu.nullOr(Evolu.SqliteBoolean),
  },
  // ── Billing / Clockify ───────────────────────────────────────────────────
  clockifyProjectRate: {
    id: Evolu.id("ClockifyProjectRate"),
    clockifyProjectId: Evolu.NonEmptyTrimmedString100, // hex ID from Clockify
    name: Evolu.NonEmptyTrimmedString100,              // project name (cached)
    hourlyRate: Evolu.NonNegativeNumber,               // rate in chosen currency
    currency: Evolu.NonEmptyTrimmedString100,          // CZK, EUR, USD …
    // Earnings that were already "nevyfakturováno" before WealthTracker
    // tracking started — set once by user as a starting balance
    initialEarnings: Evolu.nullOr(Evolu.NonNegativeNumber),
    deleted: Evolu.nullOr(Evolu.SqliteBoolean),
  },
  // One row per (project, month) synced from Clockify — stores raw hours so
  // the amount can be recomputed whenever the hourly rate changes
  clockifyMonthlyEarnings: {
    id: Evolu.id("ClockifyMonthlyEarnings"),
    clockifyProjectId: Evolu.NonEmptyTrimmedString100,
    yearMonth: Evolu.NonEmptyTrimmedString100,  // "2026-02"
    hours: Evolu.NonNegativeNumber,
    deleted: Evolu.nullOr(Evolu.SqliteBoolean),
  },
  clockifyInvoicedPeriod: {
    id: Evolu.id("ClockifyInvoicedPeriod"),
    clockifyProjectId: Evolu.NonEmptyTrimmedString100,
    yearMonth: Evolu.NonEmptyTrimmedString100,  // "2026-02"
    hours: Evolu.NonNegativeNumber,
    amount: Evolu.NonNegativeNumber,
    currency: Evolu.NonEmptyTrimmedString100,
    deleted: Evolu.nullOr(Evolu.SqliteBoolean),
  },
  netWorthSnapshot: {
    id: Evolu.id("NetWorthSnapshot"),
    snapshotDate: Evolu.DateIso,
    totalAssets: Evolu.NonNegativeNumber,
    totalLiabilities: Evolu.NonNegativeNumber,
    netWorth: Evolu.NonNegativeNumber,
    cryptoValue: Evolu.NonNegativeNumber,
    stocksValue: Evolu.NonNegativeNumber,
    propertyValue: Evolu.NonNegativeNumber,
    savingsValue: Evolu.NonNegativeNumber,
    bankValue: Evolu.NonNegativeNumber,
    receivablesValue: Evolu.NonNegativeNumber,
    deleted: Evolu.nullOr(Evolu.SqliteBoolean),
  },
};

// Polyfill navigator.locks for sandboxed/restricted browser environments that
// don't support the Web Locks API. Without this, @evolu/web's SharedWebWorker
// throws "Cannot read properties of undefined (reading 'request')".
if (
  typeof window !== "undefined" &&
  typeof navigator !== "undefined" &&
  !("locks" in navigator)
) {
  Object.defineProperty(navigator, "locks", {
    value: {
      request: (_name: string, callback: () => unknown) =>
        Promise.resolve().then(callback as () => PromiseLike<unknown>),
      query: () => Promise.resolve({ held: [], pending: [] }),
    },
    configurable: true,
    writable: true,
  });
}

const evolu = createEvolu(evoluReactWebDeps)(Schema, {
  name: SimpleName.orThrow("wealth-tracker"),
  transports: [{ type: "WebSocket", url: getRelayUrl() }],
});

export const useEvolu = createUseEvolu(evolu);
export { EvoluProvider, evolu, Evolu };
