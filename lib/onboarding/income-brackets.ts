/**
 * Shared income brackets for signup onboarding + dashboard checklist.
 * Midpoints are approximate USD for savings estimates (not tax advice).
 */

export type FilingStatus = "single" | "married_filing_jointly";

export type IncomeBracket = {
  id: string;
  label: string;
  taxRate: number;
  /** Representative midpoint of the bracket in USD for estimates */
  midpointUsd: number;
};

export const INCOME_BRACKETS: Record<FilingStatus, IncomeBracket[]> = {
  single: [
    { id: "single:0-11925", label: "$0 - $11,925 (10%)", taxRate: 0.1, midpointUsd: 5962.5 },
    { id: "single:11926-48475", label: "$11,926 - $48,475 (12%)", taxRate: 0.12, midpointUsd: 30200.5 },
    { id: "single:48476-103350", label: "$48,476 - $103,350 (22%)", taxRate: 0.22, midpointUsd: 75913 },
    { id: "single:103351-197300", label: "$103,351 - $197,300 (24%)", taxRate: 0.24, midpointUsd: 150325.5 },
    { id: "single:197301-250525", label: "$197,301 - $250,525 (32%)", taxRate: 0.32, midpointUsd: 223913 },
    { id: "single:250526-626350", label: "$250,526 - $626,350 (35%)", taxRate: 0.35, midpointUsd: 438438 },
    { id: "single:626351-plus", label: "$626,351+ (37%)", taxRate: 0.37, midpointUsd: 750_000 },
  ],
  married_filing_jointly: [
    { id: "joint:0-23850", label: "$0 - $23,850 (10%)", taxRate: 0.1, midpointUsd: 11925 },
    { id: "joint:23851-96950", label: "$23,851 - $96,950 (12%)", taxRate: 0.12, midpointUsd: 60400.5 },
    { id: "joint:96951-206700", label: "$96,951 - $206,700 (22%)", taxRate: 0.22, midpointUsd: 151825.5 },
    { id: "joint:206701-394600", label: "$206,701 - $394,600 (24%)", taxRate: 0.24, midpointUsd: 300650.5 },
    { id: "joint:394601-501050", label: "$394,601 - $501,050 (32%)", taxRate: 0.32, midpointUsd: 447825.5 },
    { id: "joint:501051-752800", label: "$501,051 - $752,800 (35%)", taxRate: 0.35, midpointUsd: 626925.5 },
    { id: "joint:752801-plus", label: "$752,801+ (37%)", taxRate: 0.37, midpointUsd: 1_000_000 },
  ],
};

export const SIGNUP_BUSINESS_TYPES: Array<{ label: string; value: string }> = [
  { label: "Sole proprietor", value: "sole_prop" },
  { label: "Single-member LLC", value: "llc" },
  { label: "LLC (multi-member)", value: "llc_multi" },
  { label: "S-Corp", value: "s_corp" },
  { label: "Partnership", value: "partnership" },
  { label: "C-Corp", value: "c_corp" },
  { label: "Other", value: "other" },
];

export function findBracket(
  filingStatus: FilingStatus,
  rangeId: string
): IncomeBracket | undefined {
  return INCOME_BRACKETS[filingStatus]?.find((b) => b.id === rangeId);
}

/** Deterministic “random” rate in [0.10, 0.15] from a seed string */
export function savingsRateFromSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = (h >>> 0) / 2 ** 32;
  return 0.1 + u * 0.05;
}

export function formatMoneyTwoDecimals(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
