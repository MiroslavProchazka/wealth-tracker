import { NextResponse } from "next/server";
import YahooFinanceClass from "yahoo-finance2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinanceClass as any)({ suppressNotices: ["yahooSurvey"] });

// ── Exchange rate cache (foreign currency → CZK) ──────────────────────────────
let rateCache: Record<string, number> = {};
let rateCachedAt = 0;
const RATE_TTL = 15 * 60 * 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface StockPriceResponse {
  prices: Record<
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
  >;
  rates: Record<string, number>;
  fetchedAt: string;
  cached?: boolean;
  stale?: boolean;
}

const priceCache = new Map<string, { data: StockPriceResponse; fetchedAt: number }>();

async function getExchangeRates(): Promise<Record<string, number>> {
  if (Date.now() - rateCachedAt < RATE_TTL && Object.keys(rateCache).length > 0) {
    return rateCache;
  }
  try {
    const pairs = ["USDCZK=X", "EURCZK=X", "GBPCZK=X", "CHFCZK=X", "PLNCZK=X"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await Promise.allSettled(pairs.map((p) => (yf as any).quote(p)));
    const rates: Record<string, number> = { CZK: 1 };
    for (const r of results) {
      if (r.status === "fulfilled") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const q = r.value as any;
        if (q?.regularMarketPrice && q?.symbol) {
          const ccy = (q.symbol as string).replace("CZK=X", "");
          rates[ccy] = q.regularMarketPrice as number;
        }
      }
    }
    rateCache = rates;
    rateCachedAt = Date.now();
    return rates;
  } catch {
    return { CZK: 1, USD: 23.5, EUR: 25.4, GBP: 29.8, CHF: 26.1, PLN: 5.8 };
  }
}

function toCZK(amount: number, fromCurrency: string, rates: Record<string, number>): number {
  if (fromCurrency === "CZK") return amount;
  return amount * (rates[fromCurrency] ?? 1);
}

// GET /api/stocks/prices?tickers=AAPL,MSFT,CEZ.PR
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tickersParam = searchParams.get("tickers") ?? "";
  const tickers = tickersParam.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);

  if (tickers.length === 0) {
    return NextResponse.json({ prices: {}, fetchedAt: new Date().toISOString() });
  }

  const cacheKey = [...tickers].sort().join(",");
  const cached = priceCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ ...cached.data, cached: true });
  }

  try {
    const [rates, quoteResults] = await Promise.all([
      getExchangeRates(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Promise.allSettled(tickers.map((ticker) => (yf as any).quote(ticker))),
    ]);

    const prices: StockPriceResponse["prices"] = {};

    for (let i = 0; i < tickers.length; i++) {
      const result = quoteResults[i];
      if (result.status !== "fulfilled" || !result.value) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = result.value as any;
      if (!q.regularMarketPrice) continue;

      const origPrice = q.regularMarketPrice as number;
      const currency = ((q.currency ?? "USD") as string).toUpperCase();
      const czk = toCZK(origPrice, currency, rates);
      const usd = currency === "USD" ? origPrice : czk / (rates["USD"] ?? 23.5);
      const eur = currency === "EUR" ? origPrice : czk / (rates["EUR"] ?? 25.4);

      prices[tickers[i]] = {
        czk: Math.round(czk * 100) / 100,
        usd: Math.round(usd * 100) / 100,
        eur: Math.round(eur * 100) / 100,
        originalPrice: origPrice,
        originalCurrency: currency,
        change24h: (q.regularMarketChangePercent ?? 0) as number,
        changeAbs: (q.regularMarketChange ?? 0) as number,
        name: (q.shortName ?? q.longName ?? tickers[i]) as string,
        open: (q.regularMarketOpen ?? null) as number | null,
        high: (q.regularMarketDayHigh ?? null) as number | null,
        low: (q.regularMarketDayLow ?? null) as number | null,
        volume: (q.regularMarketVolume ?? null) as number | null,
        marketCap: q.marketCap ? toCZK(q.marketCap as number, currency, rates) : null,
        pe: (q.trailingPE ?? null) as number | null,
        dividendYield: (q.dividendYield ?? null) as number | null,
        week52High: (q.fiftyTwoWeekHigh ?? null) as number | null,
        week52Low: (q.fiftyTwoWeekLow ?? null) as number | null,
        quoteType: (q.quoteType ?? "EQUITY") as string,
        exchange: (q.exchange ?? "") as string,
      };
    }

    if (Object.keys(prices).length === 0) {
      if (cached) {
        return NextResponse.json({ ...cached.data, cached: true, stale: true });
      }
      return NextResponse.json(
        { error: "No stock prices could be fetched right now." },
        { status: 503 },
      );
    }

    const response: StockPriceResponse = {
      prices,
      rates,
      fetchedAt: new Date().toISOString(),
    };
    priceCache.set(cacheKey, { data: response, fetchedAt: now });
    return NextResponse.json(response);
  } catch (err) {
    if (cached) {
      return NextResponse.json({ ...cached.data, cached: true, stale: true });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch prices" },
      { status: 500 }
    );
  }
}
