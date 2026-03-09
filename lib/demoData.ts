import * as Evolu from "@evolu/common";
import {
  NET_WORTH_SNAPSHOT_SCHEMA_VERSION,
  PORTFOLIO_NOTES_FEATURE_ENABLED_KEY,
  TAG_CLOUD_FEATURE_ENABLED_KEY,
  TARGET_ALLOCATION_FEATURE_ENABLED_KEY,
} from "@/lib/evolu";

export function seedDemoAccount(
  evolu: {
    insert: (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      table: any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      value: any,
    ) => { ok: boolean };
  },
): void {
  const today = new Date();
  const day = (offsetDays: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split("T")[0];
  };

  const cryptoHoldings = [
    {
      symbol: "BTC",
      name: "Bitcoin",
      amount: 0.42,
      buyPrice: 1210000,
      tags: "core, long-term",
      notes: "Long-term position",
      deleted: Evolu.sqliteFalse,
    },
    {
      symbol: "ETH",
      name: "Ethereum",
      amount: 5.5,
      buyPrice: 61000,
      tags: "growth, defi",
      notes: "Staking-ready allocation",
      deleted: Evolu.sqliteFalse,
    },
    {
      symbol: "SOL",
      name: "Solana",
      amount: 24,
      buyPrice: 2600,
      tags: "growth",
      notes: null,
      deleted: Evolu.sqliteFalse,
    },
  ];

  const stockHoldings = [
    {
      ticker: "AAPL",
      name: "Apple Inc.",
      shares: 18,
      currency: "USD",
      buyPrice: 188,
      exchange: "NASDAQ",
      sector: "Technology",
      tags: "core, quality",
      notes: "Monthly DCA",
      deleted: Evolu.sqliteFalse,
    },
    {
      ticker: "CEZ",
      name: "CEZ Group",
      shares: 36,
      currency: "CZK",
      buyPrice: 915,
      exchange: "PSE",
      sector: "Utilities",
      tags: "dividend, czech",
      notes: "Dividend anchor",
      deleted: Evolu.sqliteFalse,
    },
    {
      ticker: "VWCE",
      name: "Vanguard FTSE All-World UCITS ETF",
      shares: 22,
      currency: "EUR",
      buyPrice: 118,
      exchange: "XETRA",
      sector: "ETF",
      tags: "etf, passive",
      notes: null,
      deleted: Evolu.sqliteFalse,
    },
  ];

  const properties = [
    {
      name: "Prague Apartment",
      address: "Vinohrady, Prague",
      estimatedValue: 7900000,
      currency: "CZK",
      hasMortgage: Evolu.sqliteTrue,
      originalLoan: 4800000,
      remainingLoan: 3320000,
      monthlyPayment: 23800,
      interestRate: 4.29,
      mortgageStart: "2021-04-01",
      mortgageEnd: "2051-03-31",
      tags: "home, mortgage",
      notes: "Primary residence",
      deleted: Evolu.sqliteFalse,
    },
  ];

  const savingsAccounts = [
    {
      name: "Emergency Fund",
      bank: "Moneta",
      balance: 420000,
      currency: "CZK",
      interestRate: 4.1,
      tags: "cash, reserve",
      notes: "6 months runway",
      deleted: Evolu.sqliteFalse,
    },
    {
      name: "EUR Reserve",
      bank: "Wise",
      balance: 6700,
      currency: "EUR",
      interestRate: 2.3,
      tags: "travel, eur",
      notes: null,
      deleted: Evolu.sqliteFalse,
    },
  ];

  const receivables = [
    {
      description: "Consulting retainer (March)",
      client: "Acme Labs",
      amount: 54000,
      currency: "CZK",
      status: "INVOICED",
      dueDate: day(11),
      tags: "consulting, recurring",
      notes: "Net 14",
      deleted: Evolu.sqliteFalse,
    },
    {
      description: "Advisory workshop",
      client: "Northstar Ventures",
      amount: 24000,
      currency: "CZK",
      status: "PENDING",
      dueDate: day(21),
      tags: "one-off",
      notes: null,
      deleted: Evolu.sqliteFalse,
    },
  ];

  const cashflowEntries = [
    {
      entryDate: day(-45),
      type: "CONTRIBUTION",
      category: "Monthly contribution",
      amount: 35000,
      currency: "CZK",
      tags: "investing",
      notes: null,
      deleted: Evolu.sqliteFalse,
    },
    {
      entryDate: day(-30),
      type: "WITHDRAWAL",
      category: "Vacation",
      amount: 18000,
      currency: "CZK",
      tags: "spending",
      notes: "Family trip",
      deleted: Evolu.sqliteFalse,
    },
    {
      entryDate: day(-14),
      type: "CONTRIBUTION",
      category: "Bonus allocation",
      amount: 50000,
      currency: "CZK",
      tags: "bonus",
      notes: null,
      deleted: Evolu.sqliteFalse,
    },
  ];

  const snapshots = [
    {
      snapshotDate: day(-60),
      totalAssets: 9510000,
      totalLiabilities: 3460000,
      netWorth: 6050000,
      cryptoValue: 860000,
      stocksValue: 1530000,
      propertyValue: 7380000,
      savingsValue: 420000,
      receivablesValue: 0,
      schemaVersion: NET_WORTH_SNAPSHOT_SCHEMA_VERSION,
      deleted: Evolu.sqliteFalse,
    },
    {
      snapshotDate: day(-30),
      totalAssets: 9960000,
      totalLiabilities: 3390000,
      netWorth: 6570000,
      cryptoValue: 950000,
      stocksValue: 1620000,
      propertyValue: 7520000,
      savingsValue: 470000,
      receivablesValue: 0,
      schemaVersion: NET_WORTH_SNAPSHOT_SCHEMA_VERSION,
      deleted: Evolu.sqliteFalse,
    },
    {
      snapshotDate: day(-7),
      totalAssets: 10480000,
      totalLiabilities: 3340000,
      netWorth: 7140000,
      cryptoValue: 1040000,
      stocksValue: 1730000,
      propertyValue: 7900000,
      savingsValue: 550000,
      receivablesValue: 60000,
      schemaVersion: NET_WORTH_SNAPSHOT_SCHEMA_VERSION,
      deleted: Evolu.sqliteFalse,
    },
  ];

  const allocationTargets = [
    { assetClass: "Property", targetPercent: 35, notes: null, deleted: Evolu.sqliteFalse },
    { assetClass: "Savings", targetPercent: 10, notes: null, deleted: Evolu.sqliteFalse },
    { assetClass: "Stocks", targetPercent: 35, notes: null, deleted: Evolu.sqliteFalse },
    { assetClass: "Crypto", targetPercent: 12, notes: null, deleted: Evolu.sqliteFalse },
    { assetClass: "Receivables", targetPercent: 8, notes: null, deleted: Evolu.sqliteFalse },
  ];

  const portfolioNotes = [
    {
      noteDate: day(-8),
      title: "Quarterly rebalance plan",
      body: "If stocks exceed 40%, redirect new money to savings and CZK bonds.",
      tags: "rebalance, risk",
      deleted: Evolu.sqliteFalse,
    },
    {
      noteDate: day(-3),
      title: "Liquidity target",
      body: "Keep at least 350k CZK in liquid cash for planned renovation.",
      tags: "liquidity, planning",
      deleted: Evolu.sqliteFalse,
    },
  ];

  for (const row of cryptoHoldings) evolu.insert("cryptoHolding", row);
  for (const row of stockHoldings) evolu.insert("stockHolding", row);
  for (const row of properties) evolu.insert("property", row);
  for (const row of savingsAccounts) evolu.insert("savingsAccount", row);
  for (const row of receivables) evolu.insert("receivable", row);
  for (const row of cashflowEntries) evolu.insert("cashflowEntry", row);
  for (const row of snapshots) evolu.insert("netWorthSnapshot", row);
  for (const row of allocationTargets) evolu.insert("allocationTarget", row);
  for (const row of portfolioNotes) evolu.insert("portfolioNote", row);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(TARGET_ALLOCATION_FEATURE_ENABLED_KEY, "true");
    window.localStorage.setItem(PORTFOLIO_NOTES_FEATURE_ENABLED_KEY, "true");
    window.localStorage.setItem(TAG_CLOUD_FEATURE_ENABLED_KEY, "true");
  }
}
