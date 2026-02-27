import { NextResponse } from "next/server";
import { SYMBOL_TO_ID } from "@/lib/coingecko";

const BASE = "https://api.coingecko.com/api/v3";

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const key = process.env.COINGECKO_API_KEY;
  if (key) headers["x-cg-demo-api-key"] = key;
  return headers;
}

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

  // Build symbol → id and id → symbol maps
  const symbolToId: Record<string, string> = {};
  const idToSymbol: Record<string, string> = {};
  for (const sym of symbols) {
    const id = SYMBOL_TO_ID[sym] ?? sym.toLowerCase();
    symbolToId[sym] = id;
    idToSymbol[id] = sym;
  }
  const ids = Object.values(symbolToId).join(",");
  const headers = getHeaders();

  // Fetch multi-currency prices + market metadata in parallel
  const [simpleRes, marketsRes] = await Promise.all([
    fetch(
      `${BASE}/simple/price?ids=${ids}&vs_currencies=czk,usd,eur&include_24hr_change=true`,
      { headers, next: { revalidate: 0 } }
    ),
    fetch(
      `${BASE}/coins/markets?vs_currency=czk&ids=${ids}&per_page=50`,
      { headers, next: { revalidate: 0 } }
    ),
  ]);

  if (!simpleRes.ok || !marketsRes.ok) {
    const status = !simpleRes.ok ? simpleRes.status : marketsRes.status;
    return NextResponse.json({ error: `CoinGecko error: ${status}` }, { status });
  }

  const [simpleData, marketsData] = await Promise.all([
    simpleRes.json() as Promise<Record<string, Record<string, number>>>,
    marketsRes.json() as Promise<Array<{ id: string; name: string; image: string; symbol: string }>>,
  ]);

  // Build metadata map: id → { name, image }
  const meta: Record<string, { name: string; image: string }> = {};
  for (const coin of marketsData) {
    meta[coin.id] = { name: coin.name, image: coin.image };
  }

  // Combine into final response keyed by symbol
  const prices: Record<string, {
    czk: number; usd: number; eur: number;
    change24h: number;
    name: string; image: string;
  }> = {};

  for (const sym of symbols) {
    const id = symbolToId[sym];
    const simple = simpleData[id];
    const coinMeta = meta[id];
    if (!simple) continue;
    prices[sym] = {
      czk: simple["czk"] ?? 0,
      usd: simple["usd"] ?? 0,
      eur: simple["eur"] ?? 0,
      change24h: simple["czk_24h_change"] ?? 0,
      name: coinMeta?.name ?? sym,
      image: coinMeta?.image ?? "",
    };
  }

  return NextResponse.json({ prices, fetchedAt: new Date().toISOString() });
}
