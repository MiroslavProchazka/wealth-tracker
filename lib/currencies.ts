// Supported currencies with display info
export const CURRENCIES = ["CZK", "USD", "EUR", "GBP", "CHF"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  CZK: "Kč",
  USD: "$",
  EUR: "€",
  GBP: "£",
  CHF: "Fr",
};

export const DEFAULT_CURRENCY: Currency = "CZK";

export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  compact = false
): string {
  const symbol = CURRENCY_SYMBOLS[currency as Currency] ?? currency;
  if (compact && Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M ${symbol}`;
  }
  if (compact && Math.abs(amount) >= 1_000) {
    return `${(amount / 1_000).toFixed(1)}k ${symbol}`;
  }
  return new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount) + " " + symbol;
}

export function formatPercent(value: number, decimals = 2): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)} %`;
}
