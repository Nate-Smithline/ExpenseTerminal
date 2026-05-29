/**
 * Combined W-2 + side hustle tax estimation.
 *
 * This is a practical estimate, not a full tax return calculation.
 * Uses the user's configured marginal tax rate against combined taxable income.
 * Good enough for the "$X under-withheld" headline; user should verify with a CPA.
 */

import {
  SE_TAX_RATE,
  SOCIAL_SECURITY_RATE,
  MEDICARE_RATE,
  SOCIAL_SECURITY_WAGE_BASE_2026,
} from "./schedule-c-lines";

export interface CombinedTaxInputs {
  /** Side hustle gross revenue (from categorized income transactions). */
  sideHustleRevenue: number;
  /** Total side hustle deductions taken (from categorized expense transactions). */
  sideHustleDeductions: number;
  /** User's W-2 gross income (entered manually). Null if not provided. */
  w2GrossIncome: number | null;
  /** Federal taxes withheld YTD from W-2 (entered manually). Null if not provided. */
  w2WithholdingYtd: number | null;
  /** User's effective marginal tax rate (from tax_year_settings.tax_rate). */
  marginalTaxRate: number;
}

export interface CombinedTaxEstimate {
  /** Net profit from side hustle after deductions. */
  sideHustleNetProfit: number;
  /** Self-employment tax (SS + Medicare) on side hustle net profit. */
  seTax: number;
  /** The deductible half of SE tax (reduces taxable income). */
  deductibleSETax: number;
  /**
   * Estimated income tax attributable to side hustle income.
   * Calculated at the marginal rate on (net profit - deductibleSETax).
   */
  sideHustleIncomeTax: number;
  /**
   * Total additional taxes owed from the side hustle.
   * = seTax + sideHustleIncomeTax
   */
  totalSideHustleTax: number;
  /**
   * Full combined tax estimate (only available if W-2 data provided).
   * = income tax on all combined income + seTax on side hustle
   */
  totalCombinedTax: number | null;
  /**
   * Amount still owed after W-2 withholding (positive = under-withheld, negative = over-withheld).
   * Null if W-2 data not provided.
   */
  netAmountOwed: number | null;
  /**
   * Whether the user appears under-withheld. Null if W-2 data not provided.
   */
  isUnderWithheld: boolean | null;
  /** Whether W-2 income data was provided. */
  hasW2Data: boolean;
  /** Recommended quarterly payment on side hustle income (total / 4). */
  recommendedQuarterlyPayment: number;
}

/**
 * Estimate the combined tax picture for a W-2 earner with a side hustle.
 */
export function estimateCombinedTax(inputs: CombinedTaxInputs): CombinedTaxEstimate {
  const {
    sideHustleRevenue,
    sideHustleDeductions,
    w2GrossIncome,
    w2WithholdingYtd,
    marginalTaxRate,
  } = inputs;

  // ── Side hustle net profit ───────────────────────────────────────────────
  const sideHustleNetProfit = Math.max(0, sideHustleRevenue - sideHustleDeductions);

  // ── Self-employment tax ──────────────────────────────────────────────────
  // Only 92.35% of net profit is subject to SE tax (the "net earnings from SE" rule).
  const seEarnings = sideHustleNetProfit * SE_TAX_RATE;
  const ssTax = Math.min(seEarnings, SOCIAL_SECURITY_WAGE_BASE_2026) * SOCIAL_SECURITY_RATE;
  const medicareTax = seEarnings * MEDICARE_RATE;
  const seTax = ssTax + medicareTax;
  const deductibleSETax = seTax / 2;

  // ── Income tax on side hustle ────────────────────────────────────────────
  // Use marginal rate on net profit after the deductible SE tax half.
  const sideHustleTaxableIncome = Math.max(0, sideHustleNetProfit - deductibleSETax);
  const sideHustleIncomeTax = sideHustleTaxableIncome * marginalTaxRate;

  const totalSideHustleTax = seTax + sideHustleIncomeTax;
  const recommendedQuarterlyPayment = totalSideHustleTax / 4;

  // ── Combined picture (requires W-2 data) ────────────────────────────────
  const hasW2Data =
    w2GrossIncome != null && w2WithholdingYtd != null;

  let totalCombinedTax: number | null = null;
  let netAmountOwed: number | null = null;
  let isUnderWithheld: boolean | null = null;

  if (hasW2Data && w2GrossIncome != null && w2WithholdingYtd != null) {
    // Combined taxable income = W-2 + side hustle net - deductible SE tax
    // (Simplified — does not apply standard deduction separately here;
    //  the marginal rate is applied as if on the top bracket slice.)
    const combinedTaxableIncome = Math.max(
      0,
      w2GrossIncome + sideHustleNetProfit - deductibleSETax
    );
    const combinedIncomeTax = combinedTaxableIncome * marginalTaxRate;
    totalCombinedTax = combinedIncomeTax + seTax;
    netAmountOwed = totalCombinedTax - w2WithholdingYtd;
    isUnderWithheld = netAmountOwed > 0;
  }

  return {
    sideHustleNetProfit,
    seTax,
    deductibleSETax,
    sideHustleIncomeTax,
    totalSideHustleTax,
    totalCombinedTax,
    netAmountOwed,
    isUnderWithheld,
    hasW2Data,
    recommendedQuarterlyPayment,
  };
}

/** Format a dollar amount for display (no cents for large numbers). */
export function formatTaxDollars(n: number): string {
  return Math.abs(n).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
