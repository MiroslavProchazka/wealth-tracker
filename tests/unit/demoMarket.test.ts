import { describe, it, expect } from "vitest";
import {
  DEMO_FIAT_RATES_TO_CZK,
  getDemoCryptoHistory,
  getDemoCryptoPrices,
  getDemoStockHistory,
  getDemoStockPrices,
} from "@/lib/demoMarket";

describe("demoMarket", () => {
  it("vrací hardcoded CZK rate", () => {
    expect(DEMO_FIAT_RATES_TO_CZK.CZK).toBe(1);
    expect(DEMO_FIAT_RATES_TO_CZK.USD).toBeGreaterThan(20);
  });

  it("vrací demo crypto prices pro zadané symboly", () => {
    const prices = getDemoCryptoPrices(["BTC", "ETH"]);

    expect(prices.BTC).toBeDefined();
    expect(prices.ETH).toBeDefined();
    expect(prices.BTC.czk).toBeGreaterThan(prices.ETH.czk);
    expect(prices.BTC.name).toBe("Bitcoin");
  });

  it("vrací demo stock prices a rates", () => {
    const prices = getDemoStockPrices(["AAPL", "CEZ.PR"]);

    expect(prices.AAPL).toBeDefined();
    expect(prices["CEZ.PR"]).toBeDefined();
    expect(prices.AAPL.czk).toBeGreaterThan(0);
    expect(prices["CEZ.PR"].originalCurrency).toBe("CZK");
  });

  it("generuje demo history pro crypto", () => {
    const points = getDemoCryptoHistory("BTC", 30, "czk");

    expect(points).toHaveLength(30);
    expect(points[0].date).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(points[0].price).toBeGreaterThan(0);
  });

  it("generuje demo history pro stocks", () => {
    const points = getDemoStockHistory("AAPL", 14, "usd");

    expect(points).toHaveLength(14);
    expect(points[0].open).toBeTypeOf("number");
    expect(points[0].high).toBeGreaterThan(points[0].low);
  });
});
