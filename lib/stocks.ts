// Alpha Vantage free API — requires ALPHA_VANTAGE_API_KEY env variable
// Free tier: 25 requests/day, 5 requests/min
// Sign up at https://www.alphavantage.co/support/#api-key

const BASE = "https://www.alphavantage.co/query";

export interface StockQuote {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  name: string;
}

export async function getStockQuote(ticker: string): Promise<StockQuote | null> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    // Return mock data when no API key configured
    return {
      ticker,
      price: 0,
      change: 0,
      changePercent: 0,
      currency: "USD",
      name: ticker,
    };
  }

  const url = `${BASE}?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) return null;

  const data = await res.json();
  const quote = data["Global Quote"];
  if (!quote || !quote["05. price"]) return null;

  return {
    ticker,
    price: parseFloat(quote["05. price"]),
    change: parseFloat(quote["09. change"]),
    changePercent: parseFloat(quote["10. change percent"].replace("%", "")),
    currency: "USD",
    name: ticker,
  };
}

export async function getStockHistory(
  ticker: string,
  outputsize: "compact" | "full" = "compact"
): Promise<{ date: string; close: number }[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) return [];

  const url = `${BASE}?function=TIME_SERIES_DAILY&symbol=${ticker}&outputsize=${outputsize}&apikey=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];

  const data = await res.json();
  const series = data["Time Series (Daily)"];
  if (!series) return [];

  return Object.entries(series)
    .map(([date, values]: [string, unknown]) => ({
      date,
      close: parseFloat((values as Record<string, string>)["4. close"]),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
