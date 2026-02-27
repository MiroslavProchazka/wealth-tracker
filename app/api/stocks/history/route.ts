import { NextResponse } from "next/server";
import YahooFinanceClass from "yahoo-finance2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinanceClass as any)({ suppressNotices: ["yahooSurvey"] });

// GET /api/stocks/history?ticker=AAPL&days=30&currency=czk
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker")?.toUpperCase() ?? "";
  const days = parseInt(searchParams.get("days") ?? "30", 10);
  const currency = (searchParams.get("currency") ?? "czk").toLowerCase();

  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const period1 = startDate.toISOString().split("T")[0];
  const period2 = endDate.toISOString().split("T")[0];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const historical: any[] = await (yf as any).historical(ticker, {
      period1, period2, interval: "1d", events: "history",
    });

    // Fetch FX rate history for conversion if needed
    const fxMap: Record<string, number> = {};
    if (currency !== "usd") {
      const fxTicker = currency === "czk" ? "USDCZK=X" : currency === "eur" ? "USDEUR=X" : "USDGBP=X";
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fxData: any[] = await (yf as any).historical(fxTicker, {
          period1, period2, interval: "1d", events: "history",
        });
        for (const d of fxData) {
          if (d.close) fxMap[(d.date as Date).toISOString().split("T")[0]] = d.close as number;
        }
      } catch { /* ignore */ }
    }

    let lastRate = currency === "czk" ? 23.5 : currency === "eur" ? 0.94 : 0.79;
    const points = historical
      .filter((d) => d.close != null)
      .map((d) => {
        const dateKey = (d.date as Date).toISOString().split("T")[0];
        let price = d.close as number;
        if (currency !== "usd") {
          const rate = fxMap[dateKey] ?? lastRate;
          lastRate = rate;
          price = price * rate;
        }
        return {
          date: dateKey,
          price: Math.round(price * 100) / 100,
          open: (d.open ?? null) as number | null,
          high: (d.high ?? null) as number | null,
          low: (d.low ?? null) as number | null,
          volume: (d.volume ?? null) as number | null,
        };
      });

    return NextResponse.json({ ticker, currency: currency.toUpperCase(), days, points });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch history" },
      { status: 500 }
    );
  }
}
