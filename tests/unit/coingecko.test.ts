import { describe, it, expect, vi, beforeEach } from "vitest";
import { SYMBOL_TO_ID, getCryptoPrices, getCryptoHistory } from "@/lib/coingecko";

// ─────────────────────────────────────────────
// SYMBOL_TO_ID mapování
// ─────────────────────────────────────────────
describe("SYMBOL_TO_ID mapování", () => {
  const expectedMappings: [string, string][] = [
    ["BTC", "bitcoin"],
    ["ETH", "ethereum"],
    ["SOL", "solana"],
    ["BNB", "binancecoin"],
    ["ADA", "cardano"],
    ["XRP", "ripple"],
    ["DOT", "polkadot"],
    ["MATIC", "matic-network"],
    ["LINK", "chainlink"],
    ["UNI", "uniswap"],
    ["AVAX", "avalanche-2"],
    ["ATOM", "cosmos"],
    ["LTC", "litecoin"],
    ["USDT", "tether"],
    ["USDC", "usd-coin"],
    ["DOGE", "dogecoin"],
  ];

  it.each(expectedMappings)("%s → %s", (symbol, id) => {
    expect(SYMBOL_TO_ID[symbol]).toBe(id);
  });

  it("obsahuje přesně 16 mapování", () => {
    expect(Object.keys(SYMBOL_TO_ID)).toHaveLength(16);
  });

  it("nezná neznámý symbol", () => {
    expect(SYMBOL_TO_ID["UNKNOWN"]).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// getCryptoPrices
// ─────────────────────────────────────────────
describe("getCryptoPrices", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("vrátí data při úspěšném volání", async () => {
    const mockData = [
      {
        id: "bitcoin",
        symbol: "btc",
        name: "Bitcoin",
        current_price: 2_500_000,
        price_change_percentage_24h: 2.5,
        market_cap: 50_000_000_000,
        image: "https://example.com/btc.png",
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    } as unknown as Response);

    const result = await getCryptoPrices(["BTC"]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("bitcoin");
    expect(result[0].current_price).toBe(2_500_000);
  });

  it("prázdný seznam symbolů → vrátí []", async () => {
    global.fetch = vi.fn();
    const result = await getCryptoPrices([]);
    expect(result).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("neznámý symbol → použije lowercase jako ID", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as unknown as Response);

    await getCryptoPrices(["MYTOKEN"]);

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("mytoken");
  });

  it("příznivý mix — symbol v mapování + neznámý", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as unknown as Response);

    await getCryptoPrices(["BTC", "MYTOKEN"]);

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("bitcoin");
    expect(calledUrl).toContain("mytoken");
  });

  it("API error (non-ok response) → vyhodí chybu", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    } as unknown as Response);

    await expect(getCryptoPrices(["BTC"])).rejects.toThrow("CoinGecko API error: 429");
  });

  it("nastavuje správnou vs_currency (default czk)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as unknown as Response);

    await getCryptoPrices(["BTC"]);

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("vs_currency=czk");
  });

  it("respektuje vlastní vs_currency", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as unknown as Response);

    await getCryptoPrices(["ETH"], "usd");

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("vs_currency=usd");
  });

  it("symbol je case-insensitive (btc i BTC)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    } as unknown as Response);

    await getCryptoPrices(["btc"]);
    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("bitcoin");
  });
});

// ─────────────────────────────────────────────
// getCryptoHistory
// ─────────────────────────────────────────────
describe("getCryptoHistory", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("vrátí pole {date, price} objektů", async () => {
    const mockResponse = {
      prices: [
        [1_700_000_000_000, 2_400_000],
        [1_700_086_400_000, 2_450_000],
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as unknown as Response);

    const result = await getCryptoHistory("BTC", 7);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty("date");
    expect(result[0]).toHaveProperty("price");
    expect(typeof result[0].date).toBe("string");
    expect(typeof result[0].price).toBe("number");
  });

  it("date je ve formátu YYYY-MM-DD", async () => {
    const ts = new Date("2024-01-15").getTime();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ prices: [[ts, 100]] }),
    } as unknown as Response);

    const result = await getCryptoHistory("BTC", 7);
    expect(result[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("API error → vyhodí chybu", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as unknown as Response);

    await expect(getCryptoHistory("BTC", 30)).rejects.toThrow("CoinGecko history error: 500");
  });

  it("neznámý symbol použije lowercase jako ID", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ prices: [] }),
    } as unknown as Response);

    await getCryptoHistory("PEPE", 7);
    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("/pepe/");
  });

  it("days parametr se promítne do URL", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ prices: [] }),
    } as unknown as Response);

    await getCryptoHistory("BTC", 90);
    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("days=90");
  });
});
