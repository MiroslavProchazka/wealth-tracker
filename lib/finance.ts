/**
 * Pure finance utility functions — extracted for testability.
 * No side effects, no external dependencies.
 */

export interface PnLResult {
  pnl: number;
  pnlPercent: number;
}

/** Výpočet P&L pro crypto / stock holding */
export function calculatePnL(
  currentPrice: number,
  buyPrice: number,
  amount: number
): PnLResult {
  const currentValue = currentPrice * amount;
  const costBasis = buyPrice * amount;
  const pnl = currentValue - costBasis;
  const pnlPercent = costBasis === 0 ? 0 : (pnl / costBasis) * 100;
  return { pnl, pnlPercent };
}

/** Výpočet equity nemovitosti */
export function calculateEquity(
  estimatedValue: number,
  remainingLoan: number
): number {
  return estimatedValue - remainingLoan;
}

/** Výpočet čistého jmění */
export function calculateNetWorth(
  totalAssets: number,
  totalLiabilities: number
): number {
  return totalAssets - totalLiabilities;
}

/** Roční úrok ze spořicího účtu */
export function calculateAnnualInterest(
  balance: number,
  interestRatePercent: number
): number {
  return (balance * interestRatePercent) / 100;
}

/** Procentuální splacení hypotéky (0–100) */
export function calculateMortgageProgress(
  originalLoan: number,
  remainingLoan: number
): number {
  if (originalLoan <= 0) return 0;
  const paid = originalLoan - remainingLoan;
  return Math.min(100, Math.max(0, (paid / originalLoan) * 100));
}

/** Zbývající roky hypotéky od dnešního dne */
export function calculateMortgageYearsLeft(endDateStr: string): number {
  const end = new Date(endDateStr);
  const now = new Date();
  if (end <= now) return 0;
  const msPerYear = 1000 * 60 * 60 * 24 * 365.25;
  return (end.getTime() - now.getTime()) / msPerYear;
}

/** Alokace aktiv v procentech */
export function calculateAllocation(
  categories: Record<string, number>
): Record<string, number> {
  const total = Object.values(categories).reduce((s, v) => s + v, 0);
  if (total === 0) return Object.fromEntries(Object.keys(categories).map((k) => [k, 0]));
  return Object.fromEntries(
    Object.entries(categories).map(([k, v]) => [k, (v / total) * 100])
  );
}

/** Procento plnění cíle */
export function calculateGoalProgress(
  currentAmount: number,
  targetAmount: number
): number {
  if (targetAmount <= 0) return 0;
  return Math.min(100, (currentAmount / targetAmount) * 100);
}
