import { NextResponse } from "next/server";
import { SYMBOL_TO_ID } from "@/lib/coingecko";

const BASE = "https://api.coingecko.com/api/v3";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minut

function getHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const customKey = req.headers.get("x-wt-coingecko-api-key")?.trim();
  const key = customKey || process.env.COINGECKO_API_KEY;
  if (key) headers["x-cg-demo-api-key"] = key;
  return headers;
}

// ── Server-side in-memory cache ───────────────────────────────────────────────
interface CacheEntry {
  data: Record<string, PriceData>;
  fetchedAt: number;
}

interface PriceData {
  czk: number;
  usd: number;
  eur: number;
  change24h: number;
  name: string;
  image: string;
}

const cache = new Map<string, CacheEntry>();

// Coin names (fallback, keyed by CoinGecko ID)
const ID_TO_NAME: Record<string, string> = {
  bitcoin: "Bitcoin", ethereum: "Ethereum", solana: "Solana",
  binancecoin: "BNB", cardano: "Cardano", ripple: "XRP",
  polkadot: "Polkadot", "matic-network": "Polygon", chainlink: "Chainlink",
  uniswap: "Uniswap", "avalanche-2": "Avalanche", cosmos: "Cosmos",
  litecoin: "Litecoin", tether: "Tether", "usd-coin": "USD Coin",
  dogecoin: "Dogecoin",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbolsParam = searchParams.get("symbols") ?? "";
  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length === 0) {
    return NextResponse.json({ prices: {}, fetchedAt: new Date().toISOString() });
  }

  // Cache key = sorted symbols
  const cacheKey = [...symbols].sort().join(",");
  const cached = cache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({
      prices: cached.data,
      fetchedAt: new Date(cached.fetchedAt).toISOString(),
      cached: true,
    });
  }

  // Build maps
  const symbolToId: Record<string, string> = {};
  const idToSymbol: Record<string, string> = {};
  for (const sym of symbols) {
    const id = SYMBOL_TO_ID[sym] ?? sym.toLowerCase();
    symbolToId[sym] = id;
    idToSymbol[id] = sym;
  }
  const ids = Object.values(symbolToId).join(",");

  // Single request — simple/price gives czk+usd+eur + 24h change in one shot
  const url =
    `${BASE}/simple/price?ids=${ids}` +
    `&vs_currencies=czk,usd,eur` +
    `&include_24hr_change=true`;

  let res: Response;
  try {
    res = await fetch(url, { headers: getHeaders(req), next: { revalidate: 0 } });
  } catch {
    // Network error — return stale cache if available
    if (cached) {
      return NextResponse.json({
        prices: cached.data,
        fetchedAt: new Date(cached.fetchedAt).toISOString(),
        cached: true,
        stale: true,
      });
    }
    return NextResponse.json({ error: "Network error" }, { status: 503 });
  }

  if (res.status === 429) {
    // Rate limited — return stale cache if available, otherwise 429
    if (cached) {
      return NextResponse.json({
        prices: cached.data,
        fetchedAt: new Date(cached.fetchedAt).toISOString(),
        cached: true,
        stale: true,
      });
    }
    const retryAfter = res.headers.get("Retry-After") ?? "60";
    return NextResponse.json(
      { error: "Rate limited by CoinGecko", retryAfter: parseInt(retryAfter) },
      { status: 429, headers: { "Retry-After": retryAfter } }
    );
  }

  if (!res.ok) {
    if (cached) {
      return NextResponse.json({
        prices: cached.data,
        fetchedAt: new Date(cached.fetchedAt).toISOString(),
        cached: true,
        stale: true,
      });
    }
    return NextResponse.json({ error: `CoinGecko error: ${res.status}` }, { status: res.status });
  }

  const simpleData = (await res.json()) as Record<string, Record<string, number>>;

  // Build response
  const prices: Record<string, PriceData> = {};
  for (const sym of symbols) {
    const id = symbolToId[sym];
    const simple = simpleData[id];
    if (!simple) continue;
    prices[sym] = {
      czk: simple["czk"] ?? 0,
      usd: simple["usd"] ?? 0,
      eur: simple["eur"] ?? 0,
      change24h: simple["czk_24h_change"] ?? 0,
      name: ID_TO_NAME[id] ?? sym,
      image: "", // images handled client-side via cryptocurrency-icons
    };
  }

  // Store in cache
  cache.set(cacheKey, { data: prices, fetchedAt: now });

  return NextResponse.json({ prices, fetchedAt: new Date(now).toISOString() });
}
