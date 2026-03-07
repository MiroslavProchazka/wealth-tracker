import { NextResponse } from "next/server";
import YahooFinanceClass from "yahoo-finance2";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinanceClass as any)({ suppressNotices: ["yahooSurvey"] });

// GET /api/stocks/search?q=apple
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  if (!q) return NextResponse.json({ results: [] });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await (yf as any).search(
      q,
      {
        newsCount: 0,
        quotesCount: 8,
        enableFuzzyQuery: true,
      },
      {
        // Yahoo search responses are not stable enough for strict validation.
        validateResult: false,
      },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quotes = ((results as any).quotes ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((r: any) => r.quoteType === "EQUITY" || r.quoteType === "ETF" || r.quoteType === "MUTUALFUND")
      .slice(0, 8)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => ({
        symbol: r.symbol as string,
        name: (r.shortname ?? r.longname ?? r.symbol) as string,
        exchange: (r.exchange ?? "") as string,
        quoteType: r.quoteType as string,
      }));
    return NextResponse.json({ results: quotes });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Search failed" }, { status: 500 });
  }
}
