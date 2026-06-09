import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

/**
 * GET /api/budget/transactions?month=YYYY-MM&assigned=false&search=...
 *
 * Returns transactions for a given month, optionally filtered to only
 * unassigned ones (not yet dropped onto a budget line).
 */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const { searchParams } = req.nextUrl;
  const month = searchParams.get("month");
  const assignedParam = searchParams.get("assigned"); // "false" = only unassigned
  const budgetLineId = searchParams.get("budget_line_id");
  const search = searchParams.get("search")?.trim() ?? "";
  // "true" = return transactions OUTSIDE the selected month (for the
  // "other months" section of the budget sidebar) instead of within it.
  const otherMonths = searchParams.get("other_months") === "true";

  const db = supabase as Supa;

  const columns =
    "id,date,vendor,description,amount,transaction_type,marker,business_pct,business_purpose,hint_vendor,hint_plaid_category,category,schedule_c_line,status";

  // When fetching all transactions for a specific line, month filter is optional
  if (budgetLineId) {
    const { data: line } = await db
      .from("budget_lines")
      .select("id")
      .eq("id", budgetLineId)
      .eq("user_id", userId)
      .single();
    if (!line) return NextResponse.json({ error: "Line not found" }, { status: 404 });

    const { data: links } = await db
      .from("budget_line_transactions")
      .select("transaction_id")
      .eq("budget_line_id", budgetLineId)
      .eq("user_id", userId);

    const assignedIds = (links ?? []).map((r: { transaction_id: string }) => r.transaction_id);
    if (assignedIds.length === 0) return NextResponse.json({ transactions: [] });

    let lineQuery = db
      .from("transactions")
      .select(columns)
      .eq("user_id", userId)
      .in("id", assignedIds)
      .order("date", { ascending: false })
      .limit(500);

    if (search) lineQuery = lineQuery.ilike("vendor", `%${search}%`);

    const { data: lineTxns, error: lineErr } = await lineQuery;
    if (lineErr) return NextResponse.json({ error: lineErr.message }, { status: 500 });
    return NextResponse.json({ transactions: lineTxns ?? [] });
  }

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month param required (YYYY-MM)" }, { status: 400 });
  }

  const [y, m] = month.split("-").map(Number);
  const startDate = `${month}-01`;
  const endDate = new Date(y, m, 0).toISOString().slice(0, 10);

  let query = db
    .from("transactions")
    .select(columns)
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(200);

  if (otherMonths) {
    // Everything except the selected month.
    query = query.or(`date.lt.${startDate},date.gt.${endDate}`);
  } else {
    query = query.gte("date", startDate).lte("date", endDate);
  }

  if (search) {
    query = query.ilike("vendor", `%${search}%`);
  }

  const { data: txns, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If only unassigned requested, filter out those with a budget_line_transactions row
  if (assignedParam === "false" && txns?.length) {
    const txIds = txns.map((t: { id: string }) => t.id);
    const { data: assigned } = await db
      .from("budget_line_transactions")
      .select("transaction_id")
      .eq("user_id", userId)
      .in("transaction_id", txIds);

    const assignedSet = new Set((assigned ?? []).map((r: { transaction_id: string }) => r.transaction_id));
    return NextResponse.json({
      transactions: (txns ?? []).filter((t: { id: string }) => !assignedSet.has(t.id)),
    });
  }

  return NextResponse.json({ transactions: txns ?? [] });
}
