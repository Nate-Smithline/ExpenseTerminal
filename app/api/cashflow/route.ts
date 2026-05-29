import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

/**
 * GET /api/cashflow?months=6
 *
 * Returns month-by-month income/expense totals and top categories.
 * months: how many months back (default 6, max 24)
 */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const monthsBack = Math.min(24, Math.max(1, parseInt(req.nextUrl.searchParams.get("months") ?? "6", 10)));

  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const start = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);
  const startDate = start.toISOString().slice(0, 10);

  const db = supabase as Supa;

  const { data: txns, error } = await db
    .from("transactions")
    .select("date,amount,transaction_type,category,marker,business_pct")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Build month buckets
  const monthMap = new Map<string, { income: number; expenses: number }>();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1) + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, { income: 0, expenses: 0 });
  }

  // Category totals for top-spend
  const categoryTotals = new Map<string, number>();

  for (const tx of txns ?? []) {
    const key = tx.date.slice(0, 7); // YYYY-MM
    const bucket = monthMap.get(key);
    if (!bucket) continue;

    const abs = Math.abs(tx.amount);
    if (tx.transaction_type === "income") {
      bucket.income += abs;
    } else {
      bucket.expenses += abs;
      const cat = tx.category ?? "Uncategorized";
      categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + abs);
    }
  }

  // Summary totals across the window
  let totalIncome = 0;
  let totalExpenses = 0;
  for (const b of monthMap.values()) {
    totalIncome += b.income;
    totalExpenses += b.expenses;
  }

  // Top 8 categories
  const topCategories = [...categoryTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, amount]) => ({ category, amount }));

  const months = [...monthMap.entries()].map(([month, data]) => ({
    month,
    income: Math.round(data.income * 100) / 100,
    expenses: Math.round(data.expenses * 100) / 100,
    net: Math.round((data.income - data.expenses) * 100) / 100,
  }));

  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : null;

  return NextResponse.json({
    months,
    totals: {
      income: Math.round(totalIncome * 100) / 100,
      expenses: Math.round(totalExpenses * 100) / 100,
      net: Math.round((totalIncome - totalExpenses) * 100) / 100,
      savingsRate,
    },
    topCategories,
  });
}
