/**
 * Section 199A Qualified Business Income (QBI) deduction calculation.
 * Applies IRS income thresholds, phase-out, and W-2/qualified property limits.
 */

export type FilingStatus =
  | "single"
  | "married_filing_joint"
  | "married_filing_separate"
  | "head_of_household";

export interface QbiInput {
  taxYear: number;
  filingStatus: FilingStatus;
  /** Net qualified business income (QBI) for the year */
  qbiAmount: number;
  /** Taxable income before the QBI deduction (and before the deduction cap) */
  taxableIncomePreQbi: number;
  /** W-2 wages paid by the business (allocable to QBI) */
  w2Wages: number;
  /** Unadjusted basis immediately after acquisition of qualified property */
  qualifiedPropertyUbia: number;
  /** True if a specified service trade or business (e.g. health, law, accounting, consulting) */
  isSstb: boolean;
}

export interface QbiResult {
  /** Deduction amount in dollars */
  deduction: number;
  /** True if deduction was capped by 20% of taxable income */
  cappedByTaxable: boolean;
  /** True if deduction was limited by W-2/property limit (non-SSTB, above threshold) */
  cappedByW2Limit: boolean;
  /** True if in phase-out range and deduction was reduced */
  phaseoutApplied: boolean;
  /** True if deduction is fully disallowed (e.g. SSTB above phase-out) */
  fullyDisallowed: boolean;
  /** deduction / qbiAmount (0–0.2); effective rate of QBI allowed */
  effectiveRate: number;
  /** Short explanation for UI */
  explanation: string;
}

/** Thresholds and phase-out ranges by year (inflation-adjusted). */
const QBI_CONFIG: Record<
  number,
  Record<FilingStatus, { threshold: number; phaseoutRange: number }>
> = {
  2024: {
    single: { threshold: 191_950, phaseoutRange: 50_000 },
    married_filing_joint: { threshold: 383_900, phaseoutRange: 100_000 },
    married_filing_separate: { threshold: 191_950, phaseoutRange: 50_000 },
    head_of_household: { threshold: 191_950, phaseoutRange: 50_000 },
  },
  2025: {
    single: { threshold: 197_300, phaseoutRange: 50_000 },
    married_filing_joint: { threshold: 394_600, phaseoutRange: 100_000 },
    married_filing_separate: { threshold: 197_300, phaseoutRange: 50_000 },
    head_of_household: { threshold: 197_300, phaseoutRange: 50_000 },
  },
};

function getConfig(
  taxYear: number,
  filingStatus: FilingStatus
): { threshold: number; phaseoutRange: number } {
  const yearConfig = QBI_CONFIG[taxYear] ?? QBI_CONFIG[2025];
  return yearConfig[filingStatus] ?? yearConfig.single;
}

/**
 * Compute the greater of: 50% of W-2 wages, or 25% of W-2 wages + 2.5% of UBIA.
 */
function w2PropertyLimit(w2Wages: number, qualifiedPropertyUbia: number): number {
  const option1 = 0.5 * w2Wages;
  const option2 = 0.25 * w2Wages + 0.025 * qualifiedPropertyUbia;
  return Math.max(option1, option2);
}

/**
 * Calculates the Section 199A QBI deduction based on current IRS rules.
 * Handles thresholds, phase-out for high income, and SSTB disallowance.
 */
export function calculateQbiDeduction(input: QbiInput): QbiResult {
  const {
    taxYear,
    filingStatus,
    qbiAmount,
    taxableIncomePreQbi,
    w2Wages,
    qualifiedPropertyUbia,
    isSstb,
  } = input;

  const { threshold, phaseoutRange } = getConfig(taxYear, filingStatus);
  const top = threshold + phaseoutRange;

  const qbiBase = 0.2 * qbiAmount;
  const taxableCap = 0.2 * Math.max(0, taxableIncomePreQbi);

  const zeroResult = (
    explanation: string,
    phaseoutApplied: boolean,
    fullyDisallowed: boolean
  ): QbiResult => ({
    deduction: 0,
    cappedByTaxable: false,
    cappedByW2Limit: false,
    phaseoutApplied,
    fullyDisallowed,
    effectiveRate: qbiAmount > 0 ? 0 : 0,
    explanation,
  });

  if (qbiAmount <= 0) {
    return zeroResult("Enter qualified business income to see your deduction.", false, false);
  }

  // Case A: Income at or below threshold — full 20% subject only to taxable income cap
  if (taxableIncomePreQbi <= threshold) {
    const deduction = Math.min(qbiBase, taxableCap);
    return {
      deduction,
      cappedByTaxable: deduction <= qbiBase && taxableCap < qbiBase,
      cappedByW2Limit: false,
      phaseoutApplied: false,
      fullyDisallowed: false,
      effectiveRate: qbiAmount > 0 ? deduction / qbiAmount : 0,
      explanation:
        deduction >= qbiBase
          ? "You qualify for the full 20% QBI deduction (limited by 20% of taxable income)."
          : "Your deduction is limited to 20% of your taxable income.",
    };
  }

  // Case B: Income at or above top of phase-out
  if (taxableIncomePreQbi >= top) {
    if (isSstb) {
      return zeroResult(
        "Above the income limit, the QBI deduction is not allowed for specified service businesses (e.g. health, law, accounting, consulting).",
        true,
        true
      );
    }
    const limit = w2PropertyLimit(w2Wages, qualifiedPropertyUbia);
    const deductionBeforeCap = Math.min(qbiBase, limit);
    const deduction = Math.min(deductionBeforeCap, taxableCap);
    return {
      deduction,
      cappedByTaxable: deduction < deductionBeforeCap,
      cappedByW2Limit: limit < qbiBase,
      phaseoutApplied: true,
      fullyDisallowed: false,
      effectiveRate: qbiAmount > 0 ? deduction / qbiAmount : 0,
      explanation:
        limit >= qbiBase
          ? "Your deduction is limited by 20% of taxable income."
          : "Your deduction is limited by W-2 wages and qualified property. Consider adding W-2 wages or qualified property to increase the limit.",
    };
  }

  // Case C: In phase-out range
  const excess = taxableIncomePreQbi - threshold;
  const phaseInPct = Math.min(1, Math.max(0, excess / phaseoutRange));

  if (isSstb) {
    // SSTB: deduction phases out to zero over the range
    const allowedRate = 0.2 * (1 - phaseInPct);
    const deduction = Math.min(qbiAmount * allowedRate, taxableCap);
    return {
      deduction,
      cappedByTaxable: deduction < qbiAmount * allowedRate,
      cappedByW2Limit: false,
      phaseoutApplied: true,
      fullyDisallowed: false,
      effectiveRate: qbiAmount > 0 ? deduction / qbiAmount : 0,
      explanation: `Your income is in the phase-out range. The QBI deduction for specified service businesses is reduced and will disappear above $${(top / 1000).toFixed(0)}k.`,
    };
  }

  // Non-SSTB in phase-out: W-2/property limit phases in
  const w2Limit = w2PropertyLimit(w2Wages, qualifiedPropertyUbia);
  const excessQbi = Math.max(0, qbiBase - Math.min(qbiBase, w2Limit));
  const reduction = phaseInPct * excessQbi;
  const allowedQbi = qbiBase - reduction;
  const deduction = Math.min(allowedQbi, taxableCap);

  return {
    deduction,
    cappedByTaxable: deduction < allowedQbi,
    cappedByW2Limit: w2Limit < qbiBase,
    phaseoutApplied: true,
    fullyDisallowed: false,
    effectiveRate: qbiAmount > 0 ? deduction / qbiAmount : 0,
    explanation:
      "Your income is in the phase-out range. The deduction is reduced by the W-2/property limit. Adding W-2 wages or qualified property can increase your deduction.",
  };
}
