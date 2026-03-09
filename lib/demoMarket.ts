export const DEMO_FIAT_RATES_TO_CZK: Record<string, number> = {
  CZK: 1,
  USD: 23.1,
  EUR: 25.2,
  GBP: 29.3,
  CHF: 26.2,
  PLN: 5.9,
};

const DEMO_CRYPTO_PRICE_MAP: Record<
  string,
  {
    name: string;
    usd: number;
    change24h: number;
  }
> = {
  BTC: { name: "Bitcoin", usd: 68420, change24h: 1.8 },
  ETH: { name: "Ethereum", usd: 3425, change24h: -0.6 },
  SOL: { name: "Solana", usd: 162, change24h: 3.1 },
  USDT: { name: "Tether", usd: 1, change24h: 0 },
  XRP: { name: "XRP", usd: 0.62, change24h: 1.1 },
};

const DEMO_STOCK_PRICE_MAP: Record<
  string,
  {
    name: string;
    currency: "USD" | "EUR" | "CZK";
    originalPrice: number;
    change24h: number;
    changeAbs: number;
    open: number;
    high: number;
    low: number;
    volume: number;
    marketCap: number | null;
    pe: number | null;
    dividendYield: number | null;
    week52High: number | null;
    week52Low: number | null;
    quoteType: string;
    exchange: string;
  }
> = {
  AAPL: {
    name: "Apple Inc.",
    currency: "USD",
    originalPrice: 221.45,
    change24h: 0.7,
    changeAbs: 1.54,
    open: 220.9,
    high: 222.1,
    low: 219.8,
    volume: 58200000,
    marketCap: 3_380_000_000_000,
    pe: 31.2,
    dividendYield: 0.48,
    week52High: 237.2,
    week52Low: 164.1,
    quoteType: "EQUITY",
    exchange: "NASDAQ",
  },
  CEZ: {
    name: "CEZ Group",
    currency: "CZK",
    originalPrice: 942,
    change24h: -0.3,
    changeAbs: -2.8,
    open: 945,
    high: 948,
    low: 938,
    volume: 782000,
    marketCap: 503_000_000_000,
    pe: 9.4,
    dividendYield: 7.2,
    week52High: 1081,
    week52Low: 811,
    quoteType: "EQUITY",
    exchange: "PSE",
  },
  VWCE: {
    name: "Vanguard FTSE All-World UCITS ETF",
    currency: "EUR",
    originalPrice: 125.8,
    change24h: 0.2,
    changeAbs: 0.25,
    open: 125.4,
    high: 126.1,
    low: 125.0,
    volume: 645000,
    marketCap: null,
    pe: null,
    dividendYield: null,
    week52High: 128.4,
    week52Low: 106.8,
    quoteType: "ETF",
    exchange: "XETRA",
  },
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toCZK(amount: number, fromCurrency: string): number {
  return amount * (DEMO_FIAT_RATES_TO_CZK[fromCurrency] ?? 1);
}

function convertFromCZK(czkAmount: number, toCurrency: "USD" | "EUR"): number {
  return czkAmount / DEMO_FIAT_RATES_TO_CZK[toCurrency];
}

function buildFallbackCrypto(symbol: string) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i += 1) {
    hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  }
  const usd = 5 + (hash % 5000) / 10;
  const change24h = ((hash % 120) - 60) / 10;
  return {
    name: symbol,
    usd,
    change24h,
  };
}

function buildFallbackStock(ticker: string) {
  let hash = 0;
  for (let i = 0; i < ticker.length; i += 1) {
    hash = (hash * 33 + ticker.charCodeAt(i)) >>> 0;
  }
  const originalPrice = 40 + (hash % 3000) / 10;
  const change24h = ((hash % 80) - 40) / 10;
  const changeAbs = (originalPrice * change24h) / 100;
  return {
    name: ticker,
    currency: "USD" as const,
    originalPrice,
    change24h,
    changeAbs,
    open: originalPrice - 0.8,
    high: originalPrice + 1.2,
    low: originalPrice - 1.3,
    volume: 1200000,
    marketCap: null,
    pe: null,
    dividendYield: null,
    week52High: originalPrice + 12,
    week52Low: Math.max(1, originalPrice - 16),
    quoteType: "EQUITY",
    exchange: "DEMO",
  };
}

function historyPoints(current: number, days: number, amplitudePct: number) {
  const safeDays = Math.max(2, Math.min(365, days));
  return Array.from({ length: safeDays }, (_, index) => {
    const age = safeDays - index - 1;
    const wave = Math.sin(index / 4) * amplitudePct;
    const trend = ((index - safeDays / 2) / safeDays) * (amplitudePct * 0.8);
    const base = current / (1 + amplitudePct / 2);
    const price = base * (1 + wave + trend);
    const date = new Date();
    date.setDate(date.getDate() - age);
    return {
      date: date.toISOString().split("T")[0],
      price: round2(Math.max(0.01, price)),
    };
  });
}

export function getDemoCryptoPrices(symbols: string[]) {
  const prices: Record<
    string,
    { czk: number; usd: number; eur: number; change24h: number; name: string; image: string }
  > = {};

  for (const symbol of symbols) {
    const normalized = symbol.toUpperCase();
    const source = DEMO_CRYPTO_PRICE_MAP[normalized] ?? buildFallbackCrypto(normalized);
    const czk = round2(toCZK(source.usd, "USD"));
    const usd = round2(source.usd);
    const eur = round2(czk / DEMO_FIAT_RATES_TO_CZK.EUR);

    prices[normalized] = {
      czk,
      usd,
      eur,
      change24h: source.change24h,
      name: source.name,
      image: "",
    };
  }

  return prices;
}

export function getDemoStockPrices(tickers: string[]) {
  const prices: Record<
    string,
    {
      czk: number;
      usd: number;
      eur: number;
      originalPrice: number;
      originalCurrency: string;
      change24h: number;
      changeAbs: number;
      name: string;
      open: number | null;
      high: number | null;
      low: number | null;
      volume: number | null;
      marketCap: number | null;
      pe: number | null;
      dividendYield: number | null;
      week52High: number | null;
      week52Low: number | null;
      quoteType: string;
      exchange: string;
    }
  > = {};

  for (const ticker of tickers) {
    const normalized = ticker.toUpperCase().replace(/\.[A-Z]+$/, "");
    const source = DEMO_STOCK_PRICE_MAP[normalized] ?? buildFallbackStock(normalized);
    const czk = round2(toCZK(source.originalPrice, source.currency));

    prices[ticker.toUpperCase()] = {
      czk,
      usd: round2(convertFromCZK(czk, "USD")),
      eur: round2(convertFromCZK(czk, "EUR")),
      originalPrice: round2(source.originalPrice),
      originalCurrency: source.currency,
      change24h: round2(source.change24h),
      changeAbs: round2(source.changeAbs),
      name: source.name,
      open: round2(source.open),
      high: round2(source.high),
      low: round2(source.low),
      volume: source.volume,
      marketCap:
        source.marketCap === null ? null : round2(toCZK(source.marketCap, source.currency)),
      pe: source.pe,
      dividendYield: source.dividendYield,
      week52High: source.week52High,
      week52Low: source.week52Low,
      quoteType: source.quoteType,
      exchange: source.exchange,
    };
  }

  return prices;
}

export function getDemoCryptoHistory(symbol: string, days: number, currency: string) {
  const price = getDemoCryptoPrices([symbol])[symbol.toUpperCase()];
  if (!price) return [];

  const current =
    currency === "usd" ? price.usd : currency === "eur" ? price.eur : price.czk;
  return historyPoints(current, days, 0.07);
}

export function getDemoStockHistory(ticker: string, days: number, currency: string) {
  const price = getDemoStockPrices([ticker])[ticker.toUpperCase()];
  if (!price) return [];

  const current =
    currency === "usd" ? price.usd : currency === "eur" ? price.eur : price.czk;
  return historyPoints(current, days, 0.045).map((row) => ({
    ...row,
    open: row.price,
    high: round2(row.price * 1.01),
    low: round2(row.price * 0.99),
    volume: 1200000,
  }));
}
