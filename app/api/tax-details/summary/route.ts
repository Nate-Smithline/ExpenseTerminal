import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { calculateTaxSummary, filterByQuarter, filterDeductibleTransactions } from "@/lib/tax/form-calculations";

export async function GET(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;
  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const supabase = authClient;

  const { searchParams } = new URL(req.url);
  const taxYear = parseInt(searchParams.get("tax_year") || String(new Date().getFullYear()), 10);
  const quarter = searchParams.get("quarter") ? parseInt(searchParams.get("quarter")!, 10) : null;

  const txCols =
    "id,vendor,amount,date,status,transaction_type,schedule_c_line,category,is_meal,is_travel,deduction_percent,quick_label,business_purpose,notes,marker,business_pct";

  // Income: include all statuses — visibility is gated by marker/line assignment below
  const { data: incomeTx } = await (supabase as any)
    .from("transactions")
    .select(txCols)
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .eq("transaction_type", "income")
    .order("date", { ascending: false });

  // Expenses: keep the reviewed-only filter so only confirmed expenses are deducted
  const { data: expenseTx } = await (supabase as any)
    .from("transactions")
    .select(txCols)
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .eq("transaction_type", "expense")
    .in("status", ["completed", "auto_sorted"])
    .order("date", { ascending: false });

  // For income transactions that don't have a direct marker, check if they belong
  // to a budget line that is marked Business or Partial — and inherit that marker.
  const incomeIds = (incomeTx ?? []).map((t: { id: string }) => t.id);
  let lineMarkerMap: Map<string, { marker: string; pct: number }> = new Map();

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
        .in("default_marker", ["Business", "Partial"]);

      const lineById = new Map(
        (lines ?? []).map((l: { id: string; default_marker: string; default_business_pct: number | null }) =>
          [l.id, { marker: l.default_marker, pct: l.default_business_pct ?? 100 }]
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

  // Annotate income transactions: use their own marker if set, else inherit from line
  const annotatedIncome = (incomeTx ?? []).map((t: Record<string, unknown> & { id: string; marker?: string | null; business_pct?: number | null }) => {
    if (t.marker === "Business" || t.marker === "Partial") return t;
    const lineInfo = lineMarkerMap.get(t.id);
    if (lineInfo) {
      return { ...t, marker: lineInfo.marker, business_pct: lineInfo.pct };
    }
    // No direct marker and no qualifying line — mark as Personal to exclude from income
    return { ...t, marker: "Personal" };
  });

  const allTransactions = [...annotatedIncome, ...(expenseTx ?? [])];

  const { data: pendingTx } = await (supabase as any)
    .from("transactions")
    .select("amount,deduction_percent,is_meal")
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .eq("status", "pending")
    .eq("transaction_type", "expense");

  const deductionCols = "type,amount";
  const { data: deductions } = await (supabase as any)
    .from("deductions")
    .select(deductionCols)
    .eq("user_id", userId)
    .eq("tax_year", taxYear);

  // Fetch tax rate
  const { data: taxSettings } = await (supabase as any)
    .from("tax_year_settings")
    .select("tax_rate")
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .single();

  // Fetch org settings for filing type
  const { data: orgSettings } = await (supabase as any)
    .from("org_settings")
    .select("filing_type")
    .eq("user_id", userId)
    .single();

  const taxRate = taxSettings?.tax_rate ? Number(taxSettings.tax_rate) : 0.24;
  const transactions = filterByQuarter(allTransactions ?? [], quarter);
  const summary = calculateTaxSummary(transactions, deductions ?? [], taxRate);
  const deductibleTransactions = filterDeductibleTransactions(transactions ?? []);

  const pendingCount = pendingTx?.length ?? 0;
  const pendingDeductionPotential =
    pendingTx?.reduce((sum: number, t: { amount: string; deduction_percent?: number | null; is_meal?: boolean }) => {
      const amt = Math.abs(Number(t.amount));
      const pct = (t.deduction_percent ?? 100) / 100;
      return sum + (t.is_meal ? amt * 0.5 * pct : amt * pct);
    }, 0) ?? 0;

  return NextResponse.json(
    {
      ...summary,
      taxYear,
      quarter,
      filingType: orgSettings?.filing_type ?? null,
      transactionCount: transactions.length,
      transactions,
      deductibleTransactions,
      pendingCount,
      pendingDeductionPotential,
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
