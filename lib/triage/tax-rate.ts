import type { Marker } from "@/components/MarkerPill";

/** Blended effective rate for the live tax meter (SE tax + federal bracket ≈ 30%). */
export const DEFAULT_TRIAGE_TAX_RATE = 0.3;

export function getTriageTaxRate(_userId?: string): number {
  // Hook: refine from org tax estimate when available
  return DEFAULT_TRIAGE_TAX_RATE;
}

export type TriageTaxImpact = {
  deltaDeduction: number;
  deltaTax: number;
};

/** Estimated deduction (expense) or taxable income (income) and tax effect for one tagged transaction. */
export function triageTransactionImpact(
  amount: number,
  marker: Marker,
  businessPct: number,
  transactionType: "income" | "expense",
  userId?: string,
): TriageTaxImpact {
  if (!marker) return { deltaDeduction: 0, deltaTax: 0 };
  const rate = getTriageTaxRate(userId);
  if (transactionType === "expense") {
    const deltaDeduction = deductionFromMarker(amount, marker, businessPct);
    return { deltaDeduction, deltaTax: deltaDeduction * rate };
  }
  const taxable = taxableIncomeFromMarker(amount, marker, businessPct);
  return { deltaDeduction: taxable, deltaTax: taxable * rate };
}

export function deductionFromMarker(
  amount: number,
  marker: "Personal" | "Business" | "Partial",
  businessPct: number,
): number {
  const abs = Math.abs(amount);
  if (marker === "Personal") return 0;
  if (marker === "Business") return abs;
  return abs * (businessPct / 100);
}

export function taxableIncomeFromMarker(
  amount: number,
  marker: "Personal" | "Business" | "Partial",
  businessPct: number,
): number {
  if (marker === "Personal") return 0;
  if (marker === "Business") return amount;
  return amount * (businessPct / 100);
}
