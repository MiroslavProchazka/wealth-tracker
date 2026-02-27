import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  calculatePnL,
  calculateEquity,
  calculateNetWorth,
  calculateAnnualInterest,
  calculateMortgageProgress,
  calculateMortgageYearsLeft,
  calculateAllocation,
  calculateGoalProgress,
} from "@/lib/finance";

// ─────────────────────────────────────────────
// P&L výpočty
// ─────────────────────────────────────────────
describe("calculatePnL", () => {
  it("zisk — nákup levně, prodej draze", () => {
    const result = calculatePnL(100, 80, 10); // 10 ks, buy @80, now @100
    expect(result.pnl).toBeCloseTo(200);         // (100-80)*10
    expect(result.pnlPercent).toBeCloseTo(25);   // 200/800*100
  });

  it("ztráta — nákup draho, kleslo", () => {
    const result = calculatePnL(60, 100, 5); // buy @100, now @60
    expect(result.pnl).toBeCloseTo(-200);        // (60-100)*5
    expect(result.pnlPercent).toBeCloseTo(-40);  // -200/500*100
  });

  it("break even — stejná cena", () => {
    const result = calculatePnL(50, 50, 100);
    expect(result.pnl).toBe(0);
    expect(result.pnlPercent).toBe(0);
  });

  it("nulová buy price → pnlPercent je 0 (bez dělení nulou)", () => {
    const result = calculatePnL(100, 0, 1);
    expect(result.pnlPercent).toBe(0);
  });

  it("zlomkové množství (crypto)", () => {
    const result = calculatePnL(2_000_000, 1_500_000, 0.5); // 0.5 BTC
    expect(result.pnl).toBeCloseTo(250_000);
  });

  it("velké částky (CZK BTC)", () => {
    const result = calculatePnL(2_500_000, 2_000_000, 1);
    expect(result.pnl).toBe(500_000);
    expect(result.pnlPercent).toBe(25);
  });
});

// ─────────────────────────────────────────────
// Nemovitosti — equity
// ─────────────────────────────────────────────
describe("calculateEquity", () => {
  it("equity = hodnota minus zbývající hypotéka", () => {
    expect(calculateEquity(5_000_000, 3_000_000)).toBe(2_000_000);
  });

  it("nemovitost bez hypotéky → equity = plná hodnota", () => {
    expect(calculateEquity(4_500_000, 0)).toBe(4_500_000);
  });

  it("hypotéka > hodnota → záporná equity (underwater)", () => {
    expect(calculateEquity(2_000_000, 2_500_000)).toBe(-500_000);
  });

  it("nulová hodnota i hypotéka", () => {
    expect(calculateEquity(0, 0)).toBe(0);
  });
});

// ─────────────────────────────────────────────
// Net worth
// ─────────────────────────────────────────────
describe("calculateNetWorth", () => {
  it("assets > liabilities → kladné čisté jmění", () => {
    expect(calculateNetWorth(10_000_000, 3_000_000)).toBe(7_000_000);
  });

  it("liabilities > assets → záporné čisté jmění", () => {
    expect(calculateNetWorth(1_000_000, 2_000_000)).toBe(-1_000_000);
  });

  it("žádné závazky → net worth = assets", () => {
    expect(calculateNetWorth(5_000_000, 0)).toBe(5_000_000);
  });

  it("vše nulové", () => {
    expect(calculateNetWorth(0, 0)).toBe(0);
  });
});

// ─────────────────────────────────────────────
// Roční úrok
// ─────────────────────────────────────────────
describe("calculateAnnualInterest", () => {
  it("3 % z 100 000", () => {
    expect(calculateAnnualInterest(100_000, 3)).toBeCloseTo(3_000);
  });

  it("0 % úroková sazba → nulový úrok", () => {
    expect(calculateAnnualInterest(500_000, 0)).toBe(0);
  });

  it("nulový zůstatek → nulový úrok", () => {
    expect(calculateAnnualInterest(0, 5)).toBe(0);
  });

  it("5,5 % z 200 000", () => {
    expect(calculateAnnualInterest(200_000, 5.5)).toBeCloseTo(11_000);
  });

  it("100 % úrok (okrajový případ)", () => {
    expect(calculateAnnualInterest(50_000, 100)).toBe(50_000);
  });
});

// ─────────────────────────────────────────────
// Mortgage progress
// ─────────────────────────────────────────────
describe("calculateMortgageProgress", () => {
  it("hypotéka splacena 50 %", () => {
    expect(calculateMortgageProgress(4_000_000, 2_000_000)).toBe(50);
  });

  it("plně splaceno → 100 %", () => {
    expect(calculateMortgageProgress(3_000_000, 0)).toBe(100);
  });

  it("nesplaceno nic → 0 %", () => {
    expect(calculateMortgageProgress(3_000_000, 3_000_000)).toBe(0);
  });

  it("zbývá víc než původní (přeplacení) → capped na 100", () => {
    expect(calculateMortgageProgress(1_000_000, -100_000)).toBe(100);
  });

  it("nulový originalLoan → 0 (bez dělení nulou)", () => {
    expect(calculateMortgageProgress(0, 0)).toBe(0);
  });

  it("66.6 % splaceno", () => {
    expect(calculateMortgageProgress(3_000_000, 1_000_000)).toBeCloseTo(66.67, 1);
  });
});

// ─────────────────────────────────────────────
// Mortgage years left
// ─────────────────────────────────────────────
describe("calculateMortgageYearsLeft", () => {
  beforeEach(() => {
    // Zmrazíme čas na 2026-01-01
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("datum v budoucnosti → kladný počet let", () => {
    const years = calculateMortgageYearsLeft("2036-01-01");
    expect(years).toBeGreaterThan(9);
    expect(years).toBeLessThan(11);
  });

  it("datum v minulosti → 0", () => {
    expect(calculateMortgageYearsLeft("2020-01-01")).toBe(0);
  });

  it("dnešní datum → 0", () => {
    expect(calculateMortgageYearsLeft("2026-01-01")).toBe(0);
  });

  it("přibližně 5 let", () => {
    const years = calculateMortgageYearsLeft("2031-01-01");
    expect(years).toBeGreaterThan(4.9);
    expect(years).toBeLessThan(5.1);
  });
});

// ─────────────────────────────────────────────
// Asset allocation
// ─────────────────────────────────────────────
describe("calculateAllocation", () => {
  it("dvě stejné kategorie → 50/50", () => {
    const result = calculateAllocation({ crypto: 1000, stocks: 1000 });
    expect(result.crypto).toBe(50);
    expect(result.stocks).toBe(50);
  });

  it("jedna kategorie → 100 %", () => {
    const result = calculateAllocation({ property: 5_000_000 });
    expect(result.property).toBe(100);
  });

  it("vše nulové → 0 % pro každou kategorii", () => {
    const result = calculateAllocation({ crypto: 0, stocks: 0, cash: 0 });
    expect(result.crypto).toBe(0);
    expect(result.stocks).toBe(0);
    expect(result.cash).toBe(0);
  });

  it("součet procent je 100", () => {
    const result = calculateAllocation({ a: 300, b: 500, c: 200 });
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(100);
  });

  it("nerovnoměrné rozdělení (30/70)", () => {
    const result = calculateAllocation({ small: 300, big: 700 });
    expect(result.small).toBeCloseTo(30);
    expect(result.big).toBeCloseTo(70);
  });
});

// ─────────────────────────────────────────────
// Goal progress
// ─────────────────────────────────────────────
describe("calculateGoalProgress", () => {
  it("50 % splnění cíle", () => {
    expect(calculateGoalProgress(500_000, 1_000_000)).toBe(50);
  });

  it("cíl splněn → 100 %", () => {
    expect(calculateGoalProgress(1_000_000, 1_000_000)).toBe(100);
  });

  it("přesažení cíle → capped na 100 %", () => {
    expect(calculateGoalProgress(1_500_000, 1_000_000)).toBe(100);
  });

  it("nulový cíl → 0 (bez dělení nulou)", () => {
    expect(calculateGoalProgress(500_000, 0)).toBe(0);
  });

  it("nulový aktuální stav → 0 %", () => {
    expect(calculateGoalProgress(0, 1_000_000)).toBe(0);
  });

  it("0.1 % plnění (začátek spoření)", () => {
    expect(calculateGoalProgress(1_000, 1_000_000)).toBeCloseTo(0.1);
  });
});
