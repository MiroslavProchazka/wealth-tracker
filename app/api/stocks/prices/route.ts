import { NextResponse } from "next/server";
import YahooFinanceClass from "yahoo-finance2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinanceClass as any)({ suppressNotices: ["yahooSurvey"] });

// ── Exchange rate cache (foreign currency → CZK) ──────────────────────────────
let rateCache: Record<string, number> = {};
let rateCachedAt = 0;
const RATE_TTL = 15 * 60 * 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const RAPIDAPI_HOST = "yh-finance.p.rapidapi.com";

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

function mapQuoteToPrice(
  q: Record<string, unknown>,
  fallbackTicker: string,
  rates: Record<string, number>,
) {
  const regularMarketPrice = Number(q.regularMarketPrice ?? 0);
  if (!Number.isFinite(regularMarketPrice) || regularMarketPrice <= 0) return null;

  const currency = String(q.currency ?? "USD").toUpperCase();
  const czk = toCZK(regularMarketPrice, currency, rates);
  const usd = currency === "USD" ? regularMarketPrice : czk / (rates.USD ?? 23.5);
  const eur = currency === "EUR" ? regularMarketPrice : czk / (rates.EUR ?? 25.4);

  return {
    czk: Math.round(czk * 100) / 100,
    usd: Math.round(usd * 100) / 100,
    eur: Math.round(eur * 100) / 100,
    originalPrice: regularMarketPrice,
    originalCurrency: currency,
    change24h: Number(q.regularMarketChangePercent ?? 0),
    changeAbs: Number(q.regularMarketChange ?? 0),
    name: String(q.shortName ?? q.longName ?? fallbackTicker),
    open: q.regularMarketOpen === undefined ? null : Number(q.regularMarketOpen),
    high: q.regularMarketDayHigh === undefined ? null : Number(q.regularMarketDayHigh),
    low: q.regularMarketDayLow === undefined ? null : Number(q.regularMarketDayLow),
    volume: q.regularMarketVolume === undefined ? null : Number(q.regularMarketVolume),
    marketCap:
      q.marketCap === undefined || q.marketCap === null
        ? null
        : toCZK(Number(q.marketCap), currency, rates),
    pe: q.trailingPE === undefined || q.trailingPE === null ? null : Number(q.trailingPE),
    dividendYield:
      q.dividendYield === undefined || q.dividendYield === null
        ? null
        : Number(q.dividendYield),
    week52High:
      q.fiftyTwoWeekHigh === undefined || q.fiftyTwoWeekHigh === null
        ? null
        : Number(q.fiftyTwoWeekHigh),
    week52Low:
      q.fiftyTwoWeekLow === undefined || q.fiftyTwoWeekLow === null
        ? null
        : Number(q.fiftyTwoWeekLow),
    quoteType: String(q.quoteType ?? "EQUITY"),
    exchange: String(q.exchange ?? ""),
  };
}

async function getRapidApiQuotes(
  tickers: string[],
  apiKey: string,
): Promise<Record<string, Record<string, unknown>>> {
  const url = new URL(`https://${RAPIDAPI_HOST}/market/v2/get-quotes`);
  url.searchParams.set("region", "US");
  url.searchParams.set("symbols", tickers.join(","));

  const response = await fetch(url.toString(), {
    headers: {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": RAPIDAPI_HOST,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`RapidAPI quote fetch failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    quoteResponse?: { result?: Array<Record<string, unknown>> };
  };

  const quotes = payload.quoteResponse?.result ?? [];
  const quoteMap: Record<string, Record<string, unknown>> = {};
  for (const quote of quotes) {
    const symbol = String(quote.symbol ?? "").toUpperCase();
    if (!symbol) continue;
    quoteMap[symbol] = quote;
  }

  return quoteMap;
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
  const yahooApiKey = req.headers.get("x-wt-yahoo-finance-api-key")?.trim();
  const emptyQuoteMap: Record<string, Record<string, unknown>> = {};

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ ...cached.data, cached: true });
  }

  try {
    const [rates, quoteResults, rapidApiQuotes] = await Promise.all([
      getExchangeRates(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Promise.allSettled(tickers.map((ticker) => (yf as any).quote(ticker))),
      yahooApiKey
        ? getRapidApiQuotes(tickers, yahooApiKey).catch(() => emptyQuoteMap)
        : Promise.resolve(emptyQuoteMap),
    ]);

    const prices: StockPriceResponse["prices"] = {};

    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i];
      const rapidApiQuote = rapidApiQuotes[ticker];
      if (rapidApiQuote) {
        const mappedFromRapidApi = mapQuoteToPrice(rapidApiQuote, ticker, rates);
        if (mappedFromRapidApi) {
          prices[ticker] = mappedFromRapidApi;
          continue;
        }
      }

      const result = quoteResults[i];
      if (result.status !== "fulfilled" || !result.value) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedFromYahooFinance2 = mapQuoteToPrice(result.value as any, ticker, rates);
      if (mappedFromYahooFinance2) {
        prices[ticker] = mappedFromYahooFinance2;
      }
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
