/**
 * Shared Clockify balance calculation logic used by both the Dashboard and
 * the Billing page. Keeping it here prevents logic drift between the two.
 */

export interface RateEntry {
  clockifyProjectId: string;
  hourlyRate: number;
  currency: string;
  initialEarnings: number;
}

export interface EarningsEntry {
  clockifyProjectId: string;
  hours: number;
}

export interface InvoicedEntry {
  clockifyProjectId: string;
  amount: number;
  currency: string;
}

/**
 * Builds a per-project map of total invoiced amounts.
 * Only aggregates invoices whose currency matches the first invoice seen for
 * that project. Invoices in a different currency are intentionally skipped to
 * keep the balance conservative (avoids cross-currency arithmetic errors).
 */
export function buildTotalInvoicedMap(
  invoiced: InvoicedEntry[]
): Record<string, { amount: number; currency: string }> {
  const m: Record<string, { amount: number; currency: string }> = {};
  for (const inv of invoiced) {
    const { clockifyProjectId: pid, amount, currency: cur } = inv;
    if (!m[pid]) {
      m[pid] = { amount, currency: cur };
    } else if (m[pid].currency === cur) {
      m[pid].amount += amount;
    }
    // Different currency — intentionally skipped; balance stays conservative.
  }
  return m;
}

/**
 * Computes the total uninvoiced (nevyfakturováno) balance across all Clockify
 * projects. Only projects whose currency matches `filterCurrency` are included,
 * so the result can be safely added to a single-currency total (e.g. the CZK
 * Net Worth on the dashboard).
 */
export function computeUninvoicedBalance(
  rates: RateEntry[],
  earnings: EarningsEntry[],
  invoiced: InvoicedEntry[],
  filterCurrency = "CZK"
): number {
  const totalHoursMap: Record<string, number> = {};
  for (const e of earnings) {
    totalHoursMap[e.clockifyProjectId] =
      (totalHoursMap[e.clockifyProjectId] ?? 0) + e.hours;
  }

  const totalInvoicedMap = buildTotalInvoicedMap(invoiced);

  return rates.reduce((sum, rate) => {
    if (rate.currency !== filterCurrency) return sum;
    const totalEarned =
      rate.initialEarnings +
      (totalHoursMap[rate.clockifyProjectId] ?? 0) * rate.hourlyRate;
    const invoicedEntry = totalInvoicedMap[rate.clockifyProjectId];
    const totalInvoiced =
      invoicedEntry?.currency === rate.currency ? invoicedEntry.amount : 0;
    return sum + Math.max(0, totalEarned - totalInvoiced);
  }, 0);
}
