import { NextResponse } from "next/server";
import { SYMBOL_TO_ID } from "@/lib/coingecko";
import { getDemoCryptoHistory } from "@/lib/demoMarket";
import { isDemoModeRequest } from "@/lib/demoMode";

const BASE = "https://api.coingecko.com/api/v3";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.toUpperCase() ?? "";
  const days = parseInt(searchParams.get("days") ?? "30", 10);
  const currency = (searchParams.get("currency") ?? "czk").toLowerCase();

  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  if (isDemoModeRequest(req)) {
    return NextResponse.json({
      symbol,
      currency: currency.toUpperCase(),
      days,
      points: getDemoCryptoHistory(symbol, days, currency),
      demo: true,
    });
  }

  const id = SYMBOL_TO_ID[symbol] ?? symbol.toLowerCase();
  const url = `${BASE}/coins/${id}/market_chart?vs_currency=${currency}&days=${days}&interval=daily`;

  const headers: Record<string, string> = { Accept: "application/json" };
  const customKey = req.headers.get("x-wt-coingecko-api-key")?.trim();
  const key = customKey || process.env.COINGECKO_API_KEY;
  if (key) headers["x-cg-demo-api-key"] = key;

  try {
    const res = await fetch(url, {
      headers,
      next: { revalidate: 3600 }, // cache 1h — historical data doesn't change
    });

    if (!res.ok) {
      return NextResponse.json({ error: `CoinGecko error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    const points = (data.prices as [number, number][]).map(([ts, price]) => ({
      date: new Date(ts).toISOString().split("T")[0],
      price: Math.round(price * 100) / 100,
    }));

    return NextResponse.json({ symbol, currency: currency.toUpperCase(), days, points });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
