import { normalizeScheduleLineKey } from "@/lib/triage/schedule-c-display";

/** Typical Schedule C expense as % of gross receipts (sole proprietor benchmarks). */
const BENCHMARKS: Record<string, { low: number; high: number }> = {
  "8": { low: 1, high: 8 },
  "9": { low: 2, high: 12 },
  "10": { low: 0.5, high: 5 },
  "11": { low: 3, high: 25 },
  "13": { low: 1, high: 8 },
  "14": { low: 0.5, high: 5 },
  "15": { low: 0.5, high: 4 },
  "16a": { low: 0.5, high: 5 },
  "16b": { low: 0.5, high: 3 },
  "17": { low: 0.5, high: 4 },
  "18": { low: 1, high: 6 },
  "20a": { low: 1, high: 8 },
  "20b": { low: 2, high: 12 },
  "21": { low: 0.5, high: 4 },
  "22": { low: 1, high: 5 },
  "23": { low: 0.5, high: 3 },
  "24a": { low: 0.5, high: 5 },
  "24b": { low: 0.3, high: 3 },
  "25": { low: 0.5, high: 4 },
  "27": { low: 1, high: 10 },
};

export type ExpenseRateBand = "low" | "normal" | "high";

export function expenseRateBand(
  lineKey: string,
  amount: number,
  grossIncome: number,
): ExpenseRateBand | null {
  if (grossIncome <= 0 || amount <= 0) return null;
  const key = normalizeScheduleLineKey(lineKey) ?? lineKey;
  const bench = BENCHMARKS[key];
  if (!bench) return null;
  const pct = (amount / grossIncome) * 100;
  if (pct < bench.low) return "low";
  if (pct > bench.high) return "high";
  return "normal";
}

export const EXPENSE_RATE_BAND_LABELS: Record<ExpenseRateBand, string> = {
  low: "Low",
  normal: "Typical",
  high: "High",
};

export const EXPENSE_RATE_BAND_TOOLTIP =
  "Compared to typical sole-proprietor expense ratios as a share of gross receipts. Ranges vary by industry—use as a sanity check, not a rule.";
