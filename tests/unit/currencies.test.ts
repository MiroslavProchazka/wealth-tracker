import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatPercent,
  CURRENCIES,
  CURRENCY_SYMBOLS,
  DEFAULT_CURRENCY,
} from "@/lib/currencies";

describe("formatCurrency", () => {
  describe("výchozí měna CZK", () => {
    it("formátuje kladnou hodnotu v CZK", () => {
      const result = formatCurrency(1000, "CZK");
      expect(result).toContain("Kč");
      expect(result).toContain("1");
    });

    it("formátuje nulu", () => {
      const result = formatCurrency(0, "CZK");
      expect(result).toContain("0");
      expect(result).toContain("Kč");
    });

    it("formátuje zápornou hodnotu", () => {
      const result = formatCurrency(-5000, "CZK");
      // Intl může používat ASCII "-" nebo Unicode "−" dle prostředí
      expect(result).toMatch(/[-−]/);
      expect(result).toContain("Kč");
    });

    it("formátuje velká čísla (milion)", () => {
      const result = formatCurrency(1_500_000, "CZK");
      expect(result).toContain("Kč");
    });
  });

  describe("všechny podporované měny", () => {
    it("USD obsahuje $ symbol", () => {
      expect(formatCurrency(100, "USD")).toContain("$");
    });

    it("EUR obsahuje € symbol", () => {
      expect(formatCurrency(100, "EUR")).toContain("€");
    });

    it("GBP obsahuje £ symbol", () => {
      expect(formatCurrency(100, "GBP")).toContain("£");
    });

    it("CHF obsahuje Fr symbol", () => {
      expect(formatCurrency(100, "CHF")).toContain("Fr");
    });
  });

  describe("compact mód", () => {
    it("nezapíná compact pod 1000", () => {
      const result = formatCurrency(999, "CZK", true);
      expect(result).not.toContain("k");
      expect(result).not.toContain("M");
    });

    it("compact pro tisíce zobrazí 'k'", () => {
      const result = formatCurrency(25_000, "CZK", true);
      expect(result).toContain("k");
    });

    it("compact pro miliony zobrazí 'M'", () => {
      const result = formatCurrency(2_500_000, "CZK", true);
      expect(result).toContain("M");
    });

    it("compact milion má 2 desetinná místa", () => {
      const result = formatCurrency(1_500_000, "CZK", true);
      expect(result).toContain("1.50M");
    });

    it("compact tisíce má 1 desetinné místo", () => {
      const result = formatCurrency(25_500, "CZK", true);
      expect(result).toContain("25.5k");
    });

    it("compact záporný milion", () => {
      const result = formatCurrency(-3_000_000, "CZK", true);
      expect(result).toContain("M");
    });
  });

  describe("neznámá měna", () => {
    it("pro neznámou měnu použije kód jako symbol", () => {
      const result = formatCurrency(100, "JPY");
      expect(result).toContain("JPY");
    });
  });

  describe("bez měny — výchozí CZK", () => {
    it("bez měnového parametru použije DEFAULT_CURRENCY", () => {
      const result = formatCurrency(500);
      expect(result).toContain("Kč");
    });
  });
});

describe("formatPercent", () => {
  it("kladná hodnota má prefix '+'", () => {
    expect(formatPercent(5.5)).toBe("+5.50 %");
  });

  it("záporná hodnota má prefix '-'", () => {
    expect(formatPercent(-3.14)).toBe("-3.14 %");
  });

  it("nula má prefix '+'", () => {
    expect(formatPercent(0)).toBe("+0.00 %");
  });

  it("respektuje vlastní počet desetinných míst", () => {
    expect(formatPercent(12.3456, 4)).toBe("+12.3456 %");
  });

  it("zaokrouhluje na 2 des. místa", () => {
    expect(formatPercent(1.999)).toBe("+2.00 %");
  });

  it("100 %", () => {
    expect(formatPercent(100)).toBe("+100.00 %");
  });
});

describe("konstanty", () => {
  it("CURRENCIES obsahuje všech 5 měn", () => {
    expect(CURRENCIES).toHaveLength(5);
    expect(CURRENCIES).toContain("CZK");
    expect(CURRENCIES).toContain("USD");
    expect(CURRENCIES).toContain("EUR");
  });

  it("DEFAULT_CURRENCY je CZK", () => {
    expect(DEFAULT_CURRENCY).toBe("CZK");
  });

  it("CURRENCY_SYMBOLS má záznam pro každou měnu", () => {
    for (const c of CURRENCIES) {
      expect(CURRENCY_SYMBOLS[c]).toBeTruthy();
    }
  });
});
