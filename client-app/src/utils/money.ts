export type CurrencyCode = 'BDT' | 'INR';

export function normalizeCurrency(code?: string | null): CurrencyCode {
  return code === 'INR' ? 'INR' : 'BDT';
}

export function currencySymbol(code?: string | null): string {
  return normalizeCurrency(code) === 'INR' ? '₹' : '৳';
}

/** Format an amount with nursery currency (৳ BDT / ₹ INR) and en-IN grouping. */
export function formatMoney(amount: number | string | null | undefined, currencyCode?: string | null): string {
  const symbol = currencySymbol(currencyCode);
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${symbol}${amount ?? ''}`;
  return `${symbol}${n.toLocaleString('en-IN')}`;
}

export function isInr(currencyCode?: string | null): boolean {
  return normalizeCurrency(currencyCode) === 'INR';
}
