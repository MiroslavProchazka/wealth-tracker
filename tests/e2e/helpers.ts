import { Page, Route } from "@playwright/test";

/**
 * Mock CoinGecko /coins/markets endpoint
 */
export async function mockCoinGecko(page: Page) {
  await page.route("**/api.coingecko.com/**", (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "bitcoin",
          symbol: "btc",
          name: "Bitcoin",
          current_price: 2_500_000,
          price_change_percentage_24h: 3.14,
          market_cap: 49_000_000_000_000,
          image: "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png",
        },
        {
          id: "ethereum",
          symbol: "eth",
          name: "Ethereum",
          current_price: 90_000,
          price_change_percentage_24h: -1.5,
          market_cap: 10_000_000_000_000,
          image: "https://coin-images.coingecko.com/coins/images/279/large/ethereum.png",
        },
      ]),
    });
  });
}

/**
 * Mock Next.js API route pro crypto prices
 */
export async function mockCryptoPricesApi(page: Page) {
  await page.route("**/api/crypto/prices**", (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        BTC: {
          id: "bitcoin",
          symbol: "btc",
          name: "Bitcoin",
          current_price: 2_500_000,
          price_change_percentage_24h: 3.14,
          market_cap: 49_000_000_000_000,
          image: "",
        },
        ETH: {
          id: "ethereum",
          symbol: "eth",
          name: "Ethereum",
          current_price: 90_000,
          price_change_percentage_24h: -1.5,
          market_cap: 10_000_000_000_000,
          image: "",
        },
      }),
    });
  });
}

/**
 * Mock API route pro stock prices
 */
export async function mockStockPricesApi(page: Page) {
  await page.route("**/api/stocks/prices**", (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        AAPL: { ticker: "AAPL", price: 175.5, change: 2.3, changePercent: 1.33, currency: "USD", name: "AAPL" },
      }),
    });
  });
}

/**
 * Mock Next.js API route pro Clockify (GET /api/clockify)
 */
export async function mockClockifyApi(page: Page, projects = [
  { id: "proj-001", name: "Client Alpha", totalHours: 12.5, entryCount: 8 },
  { id: "proj-002", name: "Client Beta",  totalHours: 7.0,  entryCount: 4 },
]) {
  const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  await page.route("**/api/clockify**", (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ projects, month, fetchedAt: new Date().toISOString() }),
    });
  });
}

/**
 * Mock Clockify API — vrátí 503 jako při chybějícím API klíči
 */
export async function mockClockifyApiMissing(page: Page) {
  await page.route("**/api/clockify**", (route: Route) => {
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "CLOCKIFY_API_KEY není nastavený" }),
    });
  });
}

/**
 * Počká na hydrataci Next.js a Evolu (WASM worker)
 */
export async function waitForApp(page: Page) {
  // Počkáme na sidebar jako indikátor plné hydratace
  await page.waitForSelector("aside", { timeout: 15_000 });
}
