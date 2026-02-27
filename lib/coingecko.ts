const BASE = "https://api.coingecko.com/api/v3";
const API_KEY = process.env.COINGECKO_API_KEY;
const authHeaders: Record<string, string> = API_KEY ? { "x-cg-demo-api-key": API_KEY } : {};

export interface CoinPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
  market_cap: number;
  image: string;
}

// Maps common symbols to CoinGecko IDs
export const SYMBOL_TO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  ADA: "cardano",
  XRP: "ripple",
  DOT: "polkadot",
  MATIC: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  AVAX: "avalanche-2",
  ATOM: "cosmos",
  LTC: "litecoin",
  USDT: "tether",
  USDC: "usd-coin",
  DOGE: "dogecoin",
};

export async function getCryptoPrices(
  symbols: string[],
  vsCurrency = "czk"
): Promise<CoinPrice[]> {
  const ids = symbols
    .map((s) => SYMBOL_TO_ID[s.toUpperCase()] ?? s.toLowerCase())
    .filter(Boolean)
    .join(",");

  if (!ids) return [];

  const url = new URL(`${BASE}/coins/markets`);
  url.searchParams.set("vs_currency", vsCurrency);
  url.searchParams.set("ids", ids);
  url.searchParams.set("price_change_percentage", "24h,7d,30d");

  const res = await fetch(url.toString(), {
    next: { revalidate: 300 }, // cache 5 min
    headers: { Accept: "application/json", ...authHeaders },
  });

  if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`);
  return res.json();
}

export async function getCryptoHistory(
  symbol: string,
  days: number,
  vsCurrency = "czk"
): Promise<{ date: string; price: number }[]> {
  const id = SYMBOL_TO_ID[symbol.toUpperCase()] ?? symbol.toLowerCase();
  const url = `${BASE}/coins/${id}/market_chart?vs_currency=${vsCurrency}&days=${days}&interval=daily`;

  const res = await fetch(url, {
    next: { revalidate: 3600 },
    headers: { Accept: "application/json", ...authHeaders },
  });

  if (!res.ok) throw new Error(`CoinGecko history error: ${res.status}`);
  const data = await res.json();

  return (data.prices as [number, number][]).map(([ts, price]) => ({
    date: new Date(ts).toISOString().split("T")[0],
    price,
  }));
}
