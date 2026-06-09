import {
  SE_TAX_RATE,
  SE_COMBINED_RATE,
  SOCIAL_SECURITY_RATE,
  MEDICARE_RATE,
  SOCIAL_SECURITY_WAGE_BASE_2026,
} from "./schedule-c-lines";

export interface TaxSummary {
  grossIncome: number;
  totalExpenses: number;
  netProfit: number;
  selfEmploymentTax: number;
  deductibleSETax: number;
  estimatedQuarterlyPayment: number;
  effectiveTaxRate: number;
  lineBreakdown: Record<string, number>;
  categoryBreakdown: Record<string, number>;
}

interface Transaction {
  amount: string | number;
  transaction_type: string | null;
  schedule_c_line: string | null;
  category: string | null;
  is_meal: boolean | null;
  is_travel: boolean | null;
  deduction_percent: number | null;
  date: string;
  status?: string | null;
  quick_label?: string | null;
  business_purpose?: string | null;
  marker?: string | null;
  business_pct?: number | null;
}

interface Deduction {
  type: string;
  amount: string | number;
}

/** Schedule C expense line key — matches DB values; empty/null → Line 27. */
export function scheduleCLineKey(raw: string | null | undefined): string {
  if (!raw) return "27";
  const trimmed = String(raw).trim();
  return trimmed || "27";
}

/**
 * Calculate deductible amount considering meal rule, deduction percent, and business_pct for Partial.
 */
function deductibleAmount(t: Transaction): number {
  const amt = Math.abs(Number(t.amount));
  // Partial marker: apply business_pct first, then any other deduction rules
  const markerPct = t.marker === "Partial" ? (t.business_pct ?? 50) / 100 : 1;
  const deductPct = (t.deduction_percent ?? 100) / 100;
  const effectivePct = markerPct * deductPct;
  if (t.is_meal) return amt * 0.5 * effectivePct;
  return amt * effectivePct;
}

function passesExpenseDeductionFilters(t: Transaction): boolean {
  const pct = t.deduction_percent ?? 100;
  if (pct <= 0) return false;

  const status = (t.status ?? "").toLowerCase();
  if (status === "personal") return false;

  const label = (t.quick_label ?? "").trim().toLowerCase();
  if (label === "personal") return false;

  return true;
}

export function filterDeductibleTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => {
    if (!(t.transaction_type === "expense" || !t.transaction_type)) return false;

    const marker = t.marker ?? null;
    if (marker === "Personal") return false;
    if (!passesExpenseDeductionFilters(t)) return false;

    // Budget-tagged Business/Partial expenses count toward Schedule C regardless of triage status
    if (marker === "Business" || marker === "Partial") return true;

    // Legacy: reviewed expenses without an explicit budget marker
    const status = (t.status ?? "").toLowerCase();
    return status === "completed" || status === "auto_sorted";
  });
}

/**
 * Get 0-based month from a date string (YYYY-MM-DD or ISO) without timezone shifts.
 */
function getMonthFromDate(dateStr: string): number {
  const part = String(dateStr).slice(0, 10);
  const m = part.slice(5, 7);
  const month = parseInt(m, 10);
  return Number.isNaN(month) ? new Date(dateStr).getMonth() : month - 1;
}

/**
 * Filter transactions by quarter (1-4) or null for full year.
 */
export function filterByQuarter(
  transactions: Transaction[],
  quarter: number | null
): Transaction[] {
  if (!quarter) return transactions;
  const startMonth = (quarter - 1) * 3;
  const endMonth = startMonth + 3;
  return transactions.filter((t) => {
    const month = getMonthFromDate(t.date);
    return month >= startMonth && month < endMonth;
  });
}

/**
 * Build a full tax summary from transactions and additional deductions.
 */
export function calculateTaxSummary(
  transactions: Transaction[],
  deductions: Deduction[],
  taxRate: number = 0.24
): TaxSummary {
  const expenses = filterDeductibleTransactions(transactions);

  // Income: exclude Personal-marked transactions; apply business_pct for Partial
  const income = transactions.filter((t) => {
    if (t.transaction_type !== "income") return false;
    const m = t.marker ?? null;
    return m !== "Personal"; // null/unset and Business count fully; Partial counts proportionally
  });

  const grossIncome = income.reduce((sum, t) => {
    const amt = Math.abs(Number(t.amount));
    if (t.marker === "Partial") {
      return sum + amt * ((t.business_pct ?? 50) / 100);
    }
    return sum + amt;
  }, 0);

  // Line breakdown
  const lineBreakdown: Record<string, number> = {};
  const categoryBreakdown: Record<string, number> = {};

  for (const t of expenses) {
    const amt = deductibleAmount(t);
    const line = scheduleCLineKey(t.schedule_c_line);
    lineBreakdown[line] = (lineBreakdown[line] || 0) + amt;

    const cat = t.category || "Uncategorized";
    categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + amt;
  }

  // Additional deductions
  for (const d of deductions) {
    const amt = Math.abs(Number(d.amount));
    categoryBreakdown[d.type] = (categoryBreakdown[d.type] || 0) + amt;
  }

  const totalExpenses =
    Object.values(lineBreakdown).reduce((a, b) => a + b, 0) +
    deductions.reduce((sum, d) => sum + Math.abs(Number(d.amount)), 0);

  const netProfit = grossIncome - totalExpenses;

  // Self-employment tax calculation
  const seEarnings = Math.max(0, netProfit * SE_TAX_RATE);
  const ssTax = Math.min(seEarnings, SOCIAL_SECURITY_WAGE_BASE_2026) * SOCIAL_SECURITY_RATE;
  const medicareTax = seEarnings * MEDICARE_RATE;
  const selfEmploymentTax = ssTax + medicareTax;
  const deductibleSETax = selfEmploymentTax / 2;

  // Quarterly estimated payments
  const taxableIncome = Math.max(0, netProfit - deductibleSETax);
  const incomeTax = taxableIncome * taxRate;
  const totalTaxLiability = incomeTax + selfEmploymentTax;
  const estimatedQuarterlyPayment = totalTaxLiability / 4;

  const effectiveTaxRate = grossIncome > 0 ? totalTaxLiability / grossIncome : 0;

  return {
    grossIncome,
    totalExpenses,
    netProfit,
    selfEmploymentTax,
    deductibleSETax,
    estimatedQuarterlyPayment,
    effectiveTaxRate,
    lineBreakdown,
    categoryBreakdown,
  };
}

/**
 * Calculate Schedule SE amounts.
 */
export function calculateScheduleSE(netProfit: number) {
  const seEarnings = Math.max(0, netProfit * SE_TAX_RATE);
  const ssTax = Math.min(seEarnings, SOCIAL_SECURITY_WAGE_BASE_2026) * SOCIAL_SECURITY_RATE;
  const medicareTax = seEarnings * MEDICARE_RATE;
  const totalSETax = ssTax + medicareTax;
  return {
    netEarnings: seEarnings,
    socialSecurityTax: ssTax,
    medicareTax,
    totalSETax,
    deductibleHalf: totalSETax / 2,
  };
}
