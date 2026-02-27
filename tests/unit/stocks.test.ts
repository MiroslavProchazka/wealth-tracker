import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getStockQuote, getStockHistory } from "@/lib/stocks";

// ─────────────────────────────────────────────
// getStockQuote
// ─────────────────────────────────────────────
describe("getStockQuote", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Výchozí: bez API klíče
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("bez API klíče (mock fallback)", () => {
    it("vrátí mock data s cenou 0", async () => {
      const result = await getStockQuote("AAPL");
      expect(result).not.toBeNull();
      expect(result!.ticker).toBe("AAPL");
      expect(result!.price).toBe(0);
      expect(result!.change).toBe(0);
      expect(result!.changePercent).toBe(0);
    });

    it("mock data mají měnu USD", async () => {
      const result = await getStockQuote("MSFT");
      expect(result!.currency).toBe("USD");
    });

    it("mock data mají name = ticker", async () => {
      const result = await getStockQuote("TSLA");
      expect(result!.name).toBe("TSLA");
    });

    it("nevolá fetch bez API klíče", async () => {
      global.fetch = vi.fn();
      await getStockQuote("GOOG");
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("s API klíčem", () => {
    beforeEach(() => {
      vi.stubEnv("ALPHA_VANTAGE_API_KEY", "TEST_KEY_123");
    });

    it("parsuje validní Alpha Vantage odpověď", async () => {
      const mockResponse = {
        "Global Quote": {
          "01. symbol": "AAPL",
          "05. price": "175.50",
          "09. change": "2.30",
          "10. change percent": "1.33%",
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as unknown as Response);

      const result = await getStockQuote("AAPL");
      expect(result).not.toBeNull();
      expect(result!.price).toBe(175.5);
      expect(result!.change).toBe(2.3);
      expect(result!.changePercent).toBeCloseTo(1.33);
    });

    it("prázdná odpověď (neznámý ticker) → null", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ "Global Quote": {} }),
      } as unknown as Response);

      const result = await getStockQuote("UNKNOWN123");
      expect(result).toBeNull();
    });

    it("chybná HTTP odpověď → null", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as unknown as Response);

      const result = await getStockQuote("AAPL");
      expect(result).toBeNull();
    });

    it("URL obsahuje ticker a API klíč", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ "Global Quote": {} }),
      } as unknown as Response);

      await getStockQuote("AAPL");
      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(calledUrl).toContain("AAPL");
      expect(calledUrl).toContain("TEST_KEY_123");
      expect(calledUrl).toContain("GLOBAL_QUOTE");
    });

    it("parseFloat správně zpracuje zápornou změnu", async () => {
      const mockResponse = {
        "Global Quote": {
          "05. price": "150.00",
          "09. change": "-5.50",
          "10. change percent": "-3.53%",
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as unknown as Response);

      const result = await getStockQuote("AAPL");
      expect(result!.change).toBe(-5.5);
      expect(result!.changePercent).toBeCloseTo(-3.53);
    });
  });
});

// ─────────────────────────────────────────────
// getStockHistory
// ─────────────────────────────────────────────
describe("getStockHistory", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("bez API klíče vrátí prázdné pole", async () => {
    global.fetch = vi.fn();
    const result = await getStockHistory("AAPL");
    expect(result).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  describe("s API klíčem", () => {
    beforeEach(() => {
      vi.stubEnv("ALPHA_VANTAGE_API_KEY", "TEST_KEY_123");
    });

    it("parsuje a řadí historická data dle data vzestupně", async () => {
      const mockResponse = {
        "Time Series (Daily)": {
          "2024-01-05": { "4. close": "178.00" },
          "2024-01-03": { "4. close": "172.00" },
          "2024-01-04": { "4. close": "175.50" },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as unknown as Response);

      const result = await getStockHistory("AAPL");
      expect(result).toHaveLength(3);
      expect(result[0].date).toBe("2024-01-03");
      expect(result[1].date).toBe("2024-01-04");
      expect(result[2].date).toBe("2024-01-05");
    });

    it("správně parsuje close price jako číslo", async () => {
      const mockResponse = {
        "Time Series (Daily)": {
          "2024-01-01": { "4. close": "155.75" },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as unknown as Response);

      const result = await getStockHistory("AAPL");
      expect(result[0].close).toBe(155.75);
      expect(typeof result[0].close).toBe("number");
    });

    it("chybějící Time Series → prázdné pole", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ Note: "API rate limit" }),
      } as unknown as Response);

      const result = await getStockHistory("AAPL");
      expect(result).toEqual([]);
    });

    it("HTTP error → prázdné pole", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      } as unknown as Response);

      const result = await getStockHistory("AAPL");
      expect(result).toEqual([]);
    });

    it("compact outputsize v URL (výchozí)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ "Time Series (Daily)": {} }),
      } as unknown as Response);

      await getStockHistory("AAPL");
      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(calledUrl).toContain("outputsize=compact");
    });

    it("full outputsize v URL", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ "Time Series (Daily)": {} }),
      } as unknown as Response);

      await getStockHistory("AAPL", "full");
      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(calledUrl).toContain("outputsize=full");
    });
  });
});
