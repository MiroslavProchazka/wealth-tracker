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
  compact = false,
  locale = "cs-CZ",
): string {
  const symbol = CURRENCY_SYMBOLS[currency as Currency] ?? currency;
  const abs = Math.abs(amount);

  if (compact && abs >= 1_000_000) {
    const short = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(amount / 1_000_000);
    const suffix = locale.startsWith("cs") ? " mil" : "M";
    return `${short}${suffix} ${symbol}`;
  }
  if (compact && abs >= 1_000) {
    const short = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: abs >= 100_000 ? 0 : 1,
    }).format(amount / 1_000);
    return `${short}k ${symbol}`;
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + " " + symbol;
}

export function formatPercent(value: number, decimals = 2): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)} %`;
}
