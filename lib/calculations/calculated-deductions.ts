/**
 * Server-side calculated deduction math (home office dual method, mileage, % bills, fixed amounts).
 * Persists derived fields in `deductions.metadata` JSON; never trust client for final amounts.
 */

export const IRS_RATES = {
  mileage: {
    2024: 0.67,
    2025: 0.7,
    2026: 0.7,
  } as Record<number, number>,
  homeOfficeSimplifiedRatePerSqFt: 5,
  homeOfficeSimplifiedMaxSqFt: 300,
} as const;

export type HomeOfficeMethod = "simplified" | "regular";

export interface HomeOfficeInput {
  workspaceSqFt: number;
  totalHomeSqFt: number;
  monthlyRent: number;
  monthlyUtilities?: number;
  year: number;
}

export interface HomeOfficeDerived {
  homeOfficePercent: number;
  homeOfficeSimplified: number;
  homeOfficeRegular: number;
  homeOfficeMethodUsed: HomeOfficeMethod;
  homeOfficeAnnualDeduction: number;
}

export function calculateHomeOffice(input: HomeOfficeInput): HomeOfficeDerived {
  const { workspaceSqFt, totalHomeSqFt, monthlyRent, monthlyUtilities = 0 } = input;

  const homeOfficePercent = totalHomeSqFt > 0 ? workspaceSqFt / totalHomeSqFt : 0;

  const qualifyingSqFt = Math.min(workspaceSqFt, IRS_RATES.homeOfficeSimplifiedMaxSqFt);
  const homeOfficeSimplified = qualifyingSqFt * IRS_RATES.homeOfficeSimplifiedRatePerSqFt;

  const annualHousingCost = (monthlyRent + monthlyUtilities) * 12;
  const homeOfficeRegular = homeOfficePercent * annualHousingCost;

  const homeOfficeMethodUsed: HomeOfficeMethod =
    homeOfficeRegular >= homeOfficeSimplified ? "regular" : "simplified";
  const homeOfficeAnnualDeduction = Math.max(homeOfficeSimplified, homeOfficeRegular);

  return {
    homeOfficePercent: Math.round(homeOfficePercent * 10000) / 10000,
    homeOfficeSimplified: Math.round(homeOfficeSimplified * 100) / 100,
    homeOfficeRegular: Math.round(homeOfficeRegular * 100) / 100,
    homeOfficeMethodUsed,
    homeOfficeAnnualDeduction: Math.round(homeOfficeAnnualDeduction * 100) / 100,
  };
}

export function mileageRateForYear(year: number): number {
  return IRS_RATES.mileage[year] ?? IRS_RATES.mileage[2026];
}

export function calculateMileageDeduction(miles: number, year: number): number {
  const rate = mileageRateForYear(year);
  return Math.round(miles * rate * 100) / 100;
}

export function calculatePercentageBasedAnnual(
  monthlyBill: number,
  businessUsePercent: number
): number {
  return Math.round(monthlyBill * 12 * (businessUsePercent / 100) * 100) / 100;
}

/** Metadata blob stored alongside deductions row for transparency UI */
export interface CalculatedDeductionMetadata {
  home_office?: HomeOfficeDerived & {
    workspaceSqFt?: number;
    totalHomeSqFt?: number;
    monthlyRent?: number;
    monthlyUtilities?: number;
  };
  mileage?: { miles: number; irsRatePerMile: number; mileageAnnualDeduction: number };
  percentage?: {
    monthlyBillAmount: number;
    businessUsePercent: number;
    percentageAnnualDeduction: number;
  };
  label?: string;
  computedAt: string;
}

export type CalculatedDeductionType =
  | "home_office"
  | "mileage"
  | "phone"
  | "internet"
  | "health_insurance"
  | "retirement"
  | "other";
