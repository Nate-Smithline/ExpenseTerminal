import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateTaxSummary } from "./form-calculations";

const TX_COLS =
  "id,amount,date,status,transaction_type,schedule_c_line,category,is_meal,is_travel,deduction_percent,quick_label,business_purpose,marker,business_pct";

/** 1-indexed month (1–12) parsed from a YYYY-MM-DD date string without timezone shifts. */
function monthOf(dateStr: string): number {
  const part = String(dateStr).slice(0, 10);
  const m = parseInt(part.slice(5, 7), 10);
  return Number.isNaN(m) ? new Date(dateStr).getMonth() + 1 : m;
}

/**
 * Estimated tax owed (self-employment + income tax) for one IRS estimated-tax
 * income period for a single user.
 *
 * Mirrors the income/expense loading and budget-line marker annotation used by
 * GET /api/tax-details/summary, but filters by the IRS income months for the
 * period (e.g. Q2 covers April–May only) rather than even calendar quarters, so
 * the figure matches the "covers ___ income" copy in the reminder email.
 *
 * @param months 1-indexed months covered by the IRS period (e.g. Q2 = [4, 5]).
 * @returns rounded dollar estimate, or null when there's no taxable activity.
 */
export async function getQuarterlyTaxEstimate(
  supabase: SupabaseClient,
  userId: string,
  taxYear: number,
  months: number[]
): Promise<number | null> {
  const monthSet = new Set(months);

  // Income: all statuses — taxability is decided by marker/line below.
  const { data: incomeTx } = await (supabase as any)
    .from("transactions")
    .select(TX_COLS)
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .eq("transaction_type", "income");

  // Expenses: reviewed-only, matching the tax summary route.
  const { data: expenseTx } = await (supabase as any)
    .from("transactions")
    .select(TX_COLS)
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .eq("transaction_type", "expense")
    .in("status", ["completed", "auto_sorted"]);

  // Budget-line marker annotation for income: a line's default_marker
  // (including Personal) overrides the transaction's own marker.
  const incomeIds = (incomeTx ?? []).map((t: { id: string }) => t.id);
  const lineMarkerMap = new Map<string, { marker: string; pct: number }>();

  if (incomeIds.length > 0) {
    const { data: links } = await (supabase as any)
      .from("budget_line_transactions")
      .select("transaction_id, budget_line_id")
      .eq("user_id", userId)
      .in("transaction_id", incomeIds);

    if (links && links.length > 0) {
      const lineIds = [...new Set(links.map((l: { budget_line_id: string }) => l.budget_line_id))];
      const { data: lines } = await (supabase as any)
        .from("budget_lines")
        .select("id, default_marker, default_business_pct")
        .eq("user_id", userId)
        .in("id", lineIds)
        .in("default_marker", ["Business", "Partial", "Personal"]);

      const lineById = new Map(
        (lines ?? []).map(
          (l: { id: string; default_marker: string; default_business_pct: number | null }) => {
            const pct = l.default_marker === "Personal" ? 0 : (l.default_business_pct ?? 100);
            return [l.id, { marker: l.default_marker, pct }];
          }
        )
      );

      for (const link of links) {
        const lineInfo = lineById.get(link.budget_line_id) as { marker: string; pct: number } | undefined;
        if (lineInfo && !lineMarkerMap.has(link.transaction_id)) {
          lineMarkerMap.set(link.transaction_id, lineInfo);
        }
      }
    }
  }

  const annotatedIncome = (incomeTx ?? []).map(
    (t: Record<string, unknown> & { id: string; marker?: string | null; business_pct?: number | null }) => {
      const lineInfo = lineMarkerMap.get(t.id);
      if (lineInfo) return { ...t, marker: lineInfo.marker, business_pct: lineInfo.pct };
      if (t.marker === "Business" || t.marker === "Partial") return t;
      return { ...t, marker: "Personal" };
    }
  );

  const all = [...annotatedIncome, ...(expenseTx ?? [])];
  const periodTxns = all.filter((t: { date: string }) => monthSet.has(monthOf(t.date)));

  if (periodTxns.length === 0) return null;

  const { data: taxSettings } = await (supabase as any)
    .from("tax_year_settings")
    .select("tax_rate")
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .maybeSingle();

  const taxRate = taxSettings?.tax_rate ? Number(taxSettings.tax_rate) : 0.24;
  const summary = calculateTaxSummary(periodTxns, [], taxRate);
  // estimatedQuarterlyPayment is annualLiability / 4; undo it to get this period's total.
  const totalTax = summary.estimatedQuarterlyPayment * 4;

  if (totalTax <= 0) return null;
  return Math.round(totalTax * 100) / 100;
}
