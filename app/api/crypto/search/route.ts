import { NextResponse } from "next/server";
import { SYMBOL_TO_ID } from "@/lib/coingecko";

const BASE = "https://api.coingecko.com/api/v3";

// Well-known names mapped directly to avoid an API round-trip
const SYMBOL_TO_NAME: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  BNB: "BNB",
  ADA: "Cardano",
  XRP: "XRP",
  DOT: "Polkadot",
  MATIC: "Polygon",
  LINK: "Chainlink",
  UNI: "Uniswap",
  AVAX: "Avalanche",
  ATOM: "Cosmos",
  LTC: "Litecoin",
  USDT: "Tether",
  USDC: "USD Coin",
  DOGE: "Dogecoin",
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.toUpperCase() ?? "";

  if (!symbol) return NextResponse.json({ name: null });

  // Return immediately for known symbols
  if (SYMBOL_TO_NAME[symbol]) {
    return NextResponse.json({ name: SYMBOL_TO_NAME[symbol], id: SYMBOL_TO_ID[symbol] });
  }

  // Fall back to CoinGecko search API
  try {
    const customKey = req.headers.get("x-wt-coingecko-api-key")?.trim();
    const apiKey = customKey || process.env.COINGECKO_API_KEY;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey) headers["x-cg-demo-api-key"] = apiKey;

    const res = await fetch(
      `${BASE}/search?query=${encodeURIComponent(symbol)}`,
      { headers, next: { revalidate: 3600 } }
    );
    if (!res.ok) return NextResponse.json({ name: null });

    const data = await res.json();
    const match = data.coins?.find(
      (c: { symbol: string; name: string; id: string }) =>
        c.symbol?.toUpperCase() === symbol
    );
    return NextResponse.json({ name: match?.name ?? null, id: match?.id ?? null });
  } catch {
    return NextResponse.json({ name: null });
  }
}
