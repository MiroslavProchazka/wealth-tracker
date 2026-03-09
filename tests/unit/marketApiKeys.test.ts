import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_MODE_STORAGE_KEY, DEMO_MODE_HEADER } from "@/lib/demoMode";
import {
  saveMarketApiKeys,
  withMarketApiHeaders,
} from "@/lib/marketApiKeys";

describe("withMarketApiHeaders", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("vrací původní init bez headerů pokud nejsou klíče ani demo", () => {
    const init = withMarketApiHeaders({ method: "GET" });
    expect(init.headers).toBeUndefined();
    expect(init.method).toBe("GET");
  });

  it("přidá provider klíče do headerů", () => {
    saveMarketApiKeys({
      coingecko: "cg-key",
      yahooFinance: "yf-key",
    });

    const init = withMarketApiHeaders();
    const headers = new Headers(init.headers);

    expect(headers.get("x-wt-coingecko-api-key")).toBe("cg-key");
    expect(headers.get("x-wt-yahoo-finance-api-key")).toBe("yf-key");
  });

  it("přidá demo mode header i bez provider klíčů", () => {
    window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, "1");

    const init = withMarketApiHeaders();
    const headers = new Headers(init.headers);

    expect(headers.get(DEMO_MODE_HEADER)).toBe("1");
    expect(headers.get("x-wt-coingecko-api-key")).toBeNull();
  });
});
