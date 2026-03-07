import * as Evolu from "@evolu/common";

export const BACKUP_VERSION = 1;

export const BACKUP_TABLES = [
  "cryptoHolding",
  "stockHolding",
  "property",
  "receivable",
  "savingsAccount",
  "netWorthSnapshot",
  "cashflowEntry",
  "allocationTarget",
  "portfolioNote",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

type UnknownRecord = Record<string, unknown>;

export interface BackupPayload {
  app: "wealth-tracker";
  version: number;
  exportedAt: string;
  data: Record<BackupTable, UnknownRecord[]>;
}

const metadataKeys = new Set(["id", "createdAt", "updatedAt", "isDeleted"]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toNullableString(value: unknown): string | null {
  if (value == null) return null;
  return toTrimmedString(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toNonNegativeNumber(value: unknown): number | null {
  const parsed = toNumber(value);
  return parsed !== null && parsed >= 0 ? parsed : null;
}

function toNullableNonNegativeNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  return toNonNegativeNumber(value);
}

function toDateIso(value: unknown): string | null {
  const date = toTrimmedString(value);
  if (!date) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function toSqliteBoolean(value: unknown): number {
  if (value === true || value === 1 || value === "1") return Evolu.sqliteTrue;
  return Evolu.sqliteFalse;
}

function stripMetadata(row: UnknownRecord): UnknownRecord {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !metadataKeys.has(key)),
  );
}

function normalizeCryptoHolding(row: UnknownRecord): UnknownRecord | null {
  const symbol = toTrimmedString(row.symbol)?.toUpperCase();
  const name = toTrimmedString(row.name);
  const amount = toNonNegativeNumber(row.amount);
  if (!symbol || !name || amount === null) return null;
  return {
    symbol,
    name,
    amount,
    buyPrice: toNullableNonNegativeNumber(row.buyPrice),
    tags: toNullableString(row.tags),
    notes: toNullableString(row.notes),
    deleted: Evolu.sqliteFalse,
  };
}

function normalizeStockHolding(row: UnknownRecord): UnknownRecord | null {
  const ticker = toTrimmedString(row.ticker)?.toUpperCase();
  const name = toTrimmedString(row.name);
  const shares = toNonNegativeNumber(row.shares);
  const currency = toTrimmedString(row.currency)?.toUpperCase();
  if (!ticker || !name || shares === null || !currency) return null;
  return {
    ticker,
    name,
    shares,
    currency,
    buyPrice: toNullableNonNegativeNumber(row.buyPrice),
    exchange: toNullableString(row.exchange),
    sector: toNullableString(row.sector),
    tags: toNullableString(row.tags),
    notes: toNullableString(row.notes),
    deleted: Evolu.sqliteFalse,
  };
}

function normalizeProperty(row: UnknownRecord): UnknownRecord | null {
  const name = toTrimmedString(row.name);
  const estimatedValue = toNonNegativeNumber(row.estimatedValue);
  const currency = toTrimmedString(row.currency)?.toUpperCase();
  if (!name || estimatedValue === null || !currency) return null;
  return {
    name,
    address: toNullableString(row.address),
    estimatedValue,
    currency,
    hasMortgage: toSqliteBoolean(row.hasMortgage),
    originalLoan: toNullableNonNegativeNumber(row.originalLoan),
    remainingLoan: toNullableNonNegativeNumber(row.remainingLoan),
    monthlyPayment: toNullableNonNegativeNumber(row.monthlyPayment),
    interestRate: toNullableNonNegativeNumber(row.interestRate),
    mortgageStart: toDateIso(row.mortgageStart),
    mortgageEnd: toDateIso(row.mortgageEnd),
    tags: toNullableString(row.tags),
    notes: toNullableString(row.notes),
    deleted: Evolu.sqliteFalse,
  };
}

function normalizeReceivable(row: UnknownRecord): UnknownRecord | null {
  const description = toTrimmedString(row.description);
  const amount = toNonNegativeNumber(row.amount);
  const currency = toTrimmedString(row.currency)?.toUpperCase();
  const status = toTrimmedString(row.status)?.toUpperCase();
  if (!description || amount === null || !currency || !status) return null;
  return {
    description,
    client: toNullableString(row.client),
    amount,
    currency,
    status,
    dueDate: toDateIso(row.dueDate),
    tags: toNullableString(row.tags),
    notes: toNullableString(row.notes),
    deleted: Evolu.sqliteFalse,
  };
}

function normalizeSavingsAccount(row: UnknownRecord): UnknownRecord | null {
  const name = toTrimmedString(row.name);
  const bank = toTrimmedString(row.bank);
  const balance = toNonNegativeNumber(row.balance);
  const currency = toTrimmedString(row.currency)?.toUpperCase();
  if (!name || !bank || balance === null || !currency) return null;
  return {
    name,
    bank,
    balance,
    currency,
    interestRate: toNullableNonNegativeNumber(row.interestRate),
    tags: toNullableString(row.tags),
    notes: toNullableString(row.notes),
    deleted: Evolu.sqliteFalse,
  };
}

function normalizeSnapshot(row: UnknownRecord): UnknownRecord | null {
  const snapshotDate = toDateIso(row.snapshotDate);
  const totalAssets = toNonNegativeNumber(row.totalAssets);
  const totalLiabilities = toNonNegativeNumber(row.totalLiabilities);
  const netWorth = toNumber(row.netWorth);
  const cryptoValue = toNonNegativeNumber(row.cryptoValue);
  const stocksValue = toNonNegativeNumber(row.stocksValue);
  const propertyValue = toNonNegativeNumber(row.propertyValue);
  const savingsValue = toNonNegativeNumber(row.savingsValue);
  const receivablesValue = toNonNegativeNumber(row.receivablesValue);
  const schemaVersion = toNumber(row.schemaVersion);
  if (
    !snapshotDate ||
    totalAssets === null ||
    totalLiabilities === null ||
    netWorth === null ||
    cryptoValue === null ||
    stocksValue === null ||
    propertyValue === null ||
    savingsValue === null ||
    receivablesValue === null
  ) {
    return null;
  }
  return {
    snapshotDate,
    totalAssets,
    totalLiabilities,
    netWorth,
    cryptoValue,
    stocksValue,
    propertyValue,
    savingsValue,
    receivablesValue,
    schemaVersion: schemaVersion ?? null,
    deleted: Evolu.sqliteFalse,
  };
}

function normalizeCashflowEntry(row: UnknownRecord): UnknownRecord | null {
  const entryDate = toDateIso(row.entryDate);
  const type = toTrimmedString(row.type)?.toUpperCase();
  const category = toTrimmedString(row.category);
  const amount = toNonNegativeNumber(row.amount);
  const currency = toTrimmedString(row.currency)?.toUpperCase();
  if (
    !entryDate ||
    !type ||
    !["CONTRIBUTION", "WITHDRAWAL"].includes(type) ||
    !category ||
    amount === null ||
    !currency
  ) {
    return null;
  }
  return {
    entryDate,
    type,
    category,
    amount,
    currency,
    tags: toNullableString(row.tags),
    notes: toNullableString(row.notes),
    deleted: Evolu.sqliteFalse,
  };
}

function normalizeAllocationTarget(row: UnknownRecord): UnknownRecord | null {
  const assetClass = toTrimmedString(row.assetClass);
  const targetPercent = toNonNegativeNumber(row.targetPercent);
  if (!assetClass || targetPercent === null) return null;
  return {
    assetClass,
    targetPercent,
    notes: toNullableString(row.notes),
    deleted: Evolu.sqliteFalse,
  };
}

function normalizePortfolioNote(row: UnknownRecord): UnknownRecord | null {
  const noteDate = toDateIso(row.noteDate);
  const title = toTrimmedString(row.title);
  const body = toTrimmedString(row.body);
  if (!noteDate || !title || !body) return null;
  return {
    noteDate,
    title,
    body,
    tags: toNullableString(row.tags),
    deleted: Evolu.sqliteFalse,
  };
}

const normalizers: Record<BackupTable, (row: UnknownRecord) => UnknownRecord | null> = {
  cryptoHolding: normalizeCryptoHolding,
  stockHolding: normalizeStockHolding,
  property: normalizeProperty,
  receivable: normalizeReceivable,
  savingsAccount: normalizeSavingsAccount,
  netWorthSnapshot: normalizeSnapshot,
  cashflowEntry: normalizeCashflowEntry,
  allocationTarget: normalizeAllocationTarget,
  portfolioNote: normalizePortfolioNote,
};

export function buildBackupPayload(data: Record<BackupTable, UnknownRecord[]>): BackupPayload {
  return {
    app: "wealth-tracker",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      cryptoHolding: data.cryptoHolding.map(stripMetadata),
      stockHolding: data.stockHolding.map(stripMetadata),
      property: data.property.map(stripMetadata),
      receivable: data.receivable.map(stripMetadata),
      savingsAccount: data.savingsAccount.map(stripMetadata),
      netWorthSnapshot: data.netWorthSnapshot.map(stripMetadata),
      cashflowEntry: data.cashflowEntry.map(stripMetadata),
      allocationTarget: data.allocationTarget.map(stripMetadata),
      portfolioNote: data.portfolioNote.map(stripMetadata),
    },
  };
}

export function parseBackupPayload(text: string): {
  payload: BackupPayload | null;
  issues: string[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { payload: null, issues: ["Backup file is not valid JSON."] };
  }

  if (!isRecord(parsed)) {
    return { payload: null, issues: ["Backup file must contain a JSON object."] };
  }

  if (parsed.app !== "wealth-tracker") {
    return { payload: null, issues: ["Backup file is not from Wealth Tracker."] };
  }

  if (!isRecord(parsed.data)) {
    return { payload: null, issues: ["Backup file is missing the data section."] };
  }

  const issues: string[] = [];
  const normalizedData = {} as Record<BackupTable, UnknownRecord[]>;

  for (const table of BACKUP_TABLES) {
    const rawRows = parsed.data[table];
    if (!Array.isArray(rawRows)) {
      normalizedData[table] = [];
      issues.push(`${table}: expected an array, imported 0 rows.`);
      continue;
    }
    const validRows = rawRows
      .filter(isRecord)
      .map((row) => normalizers[table](row))
      .filter((row): row is UnknownRecord => row !== null);
    const skipped = rawRows.length - validRows.length;
    if (skipped > 0) {
      issues.push(`${table}: skipped ${skipped} invalid row${skipped === 1 ? "" : "s"}.`);
    }
    normalizedData[table] = validRows;
  }

  return {
    payload: {
      app: "wealth-tracker",
      version:
        typeof parsed.version === "number" && Number.isFinite(parsed.version)
          ? parsed.version
          : BACKUP_VERSION,
      exportedAt:
        typeof parsed.exportedAt === "string"
          ? parsed.exportedAt
          : new Date().toISOString(),
      data: normalizedData,
    },
    issues,
  };
}
