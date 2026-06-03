/** Blended effective rate for the live tax meter (SE tax + federal bracket ≈ 30%). */
export const DEFAULT_TRIAGE_TAX_RATE = 0.3;

export function getTriageTaxRate(_userId?: string): number {
  // Hook: refine from org tax estimate when available
  return DEFAULT_TRIAGE_TAX_RATE;
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
