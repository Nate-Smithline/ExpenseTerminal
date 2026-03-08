/**
 * Site-wide formatting: all decimals round to 2 places.
 */

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatPercent(n: number): string {
  return `${Number(n.toFixed(2))}%`;
}

export function formatDecimal(n: number): string {
  return Number(n.toFixed(2)).toLocaleString();
}
