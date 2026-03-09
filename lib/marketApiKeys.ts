export const MARKET_API_STORAGE_KEYS = {
  coingecko: "wealthTracker_marketApiKey_coingecko",
  yahooFinance: "wealthTracker_marketApiKey_yahooFinance",
} as const;

export interface MarketApiKeys {
  coingecko: string;
  yahooFinance: string;
}

function safeStorageGet(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return (window.localStorage.getItem(key) ?? "").trim();
  } catch {
    return "";
  }
}

export function readMarketApiKeys(): MarketApiKeys {
  return {
    coingecko: safeStorageGet(MARKET_API_STORAGE_KEYS.coingecko),
    yahooFinance: safeStorageGet(MARKET_API_STORAGE_KEYS.yahooFinance),
  };
}

export function saveMarketApiKeys(keys: Partial<MarketApiKeys>) {
  if (typeof window === "undefined") return;

  try {
    if (keys.coingecko !== undefined) {
      const value = keys.coingecko.trim();
      if (value) {
        window.localStorage.setItem(MARKET_API_STORAGE_KEYS.coingecko, value);
      } else {
        window.localStorage.removeItem(MARKET_API_STORAGE_KEYS.coingecko);
      }
    }

    if (keys.yahooFinance !== undefined) {
      const value = keys.yahooFinance.trim();
      if (value) {
        window.localStorage.setItem(MARKET_API_STORAGE_KEYS.yahooFinance, value);
      } else {
        window.localStorage.removeItem(MARKET_API_STORAGE_KEYS.yahooFinance);
      }
    }
  } catch {
    // Ignore localStorage failures (private mode, denied storage, etc.)
  }
}

export function withMarketApiHeaders(init: RequestInit = {}): RequestInit {
  const keys = readMarketApiKeys();
  if (!keys.coingecko && !keys.yahooFinance) return init;

  const headers = new Headers(init.headers);
  if (keys.coingecko) {
    headers.set("x-wt-coingecko-api-key", keys.coingecko);
  }
  if (keys.yahooFinance) {
    headers.set("x-wt-yahoo-finance-api-key", keys.yahooFinance);
  }

  return {
    ...init,
    headers,
  };
}
