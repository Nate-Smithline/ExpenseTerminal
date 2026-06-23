import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { mapTransactionToQueueItem } from "@/lib/triage/queue-map";
import { normalizeVendor } from "@/lib/vendor-matching";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;

  const params = req.nextUrl.searchParams;
  const countOnly = params.get("count_only") === "true";
  const db = supabase as any;

  if (countOnly) {
    const [{ count: expenseCount, error: expenseErr }, { count: incomeCount, error: incomeErr }] =
      await Promise.all([
        db
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("marker", null)
          .eq("transaction_type", "expense"),
        db
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("marker", null)
          .eq("transaction_type", "income"),
      ]);
    if (expenseErr || incomeErr) {
      const message = expenseErr?.message ?? incomeErr?.message ?? "Count failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
    const expenses = expenseCount ?? 0;
    const income = incomeCount ?? 0;
    return NextResponse.json({
      count: expenses + income,
      expenseCount: expenses,
      incomeCount: income,
      total: expenses + income,
    });
  }

  const { data: rows, error } = await db
    .from("transactions")
    .select(
      `id, date, vendor, vendor_normalized, amount, category, schedule_c_line, ai_confidence, ai_reasoning, ai_suggestions,
       business_purpose, quick_label, deduction_percent, description, is_meal, is_travel, transaction_type, data_source_id,
       data_sources ( name, institution, mask )`,
    )
    .eq("user_id", userId)
    .is("marker", null)
    .in("transaction_type", ["expense", "income"])
    .order("date", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: seenRows } = await (supabase as any)
    .from("transactions")
    .select("vendor_normalized, vendor")
    .eq("user_id", userId)
    .not("marker", "is", null);

  const seenByVendor = new Map<string, number>();
  for (const row of seenRows ?? []) {
    const key =
      row.vendor_normalized ||
      (row.vendor ? normalizeVendor(String(row.vendor)) : "");
    if (!key) continue;
    seenByVendor.set(key, (seenByVendor.get(key) ?? 0) + 1);
  }

  const items = (rows ?? []).map((tx: Parameters<typeof mapTransactionToQueueItem>[0]) =>
    mapTransactionToQueueItem(tx, seenByVendor),
  );

  const { data: markerRules } = await (supabase as any)
    .from("auto_sort_rules")
    .select("id, vendor_pattern, marker, business_pct, conditions")
    .eq("user_id", userId)
    .not("marker", "is", null);

  const rules = (markerRules ?? []).map(
    (r: {
      id: string;
      vendor_pattern: string;
      marker: string;
      business_pct: number | null;
      conditions: { transaction_type?: string };
    }) => ({
      id: r.id,
      vendorKey: r.vendor_pattern,
      vendor: r.vendor_pattern,
      marker: r.marker,
      businessPct: r.business_pct ?? 50,
      mode:
        r.conditions?.transaction_type === "income" ? "income" : "expenses",
    }),
  );

  return NextResponse.json({
    mode: "all",
    items,
    rules,
  });
}
