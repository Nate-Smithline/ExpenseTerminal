import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

/**
 * GET /api/budget/months-with-groups
 * Returns { months: string[] } — month keys ("YYYY-MM") that have at least one budget group,
 * sorted descending (newest first).
 */
export async function GET() {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const db = supabase as Supa;

  const { data: months, error } = await db
    .from("budget_months")
    .select(`month_key, budget_groups ( id )`)
    .eq("user_id", userId)
    .order("month_key", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const monthsWithGroups: string[] = (months ?? [])
    .filter((m: Supa) => (m.budget_groups?.length ?? 0) > 0)
    .map((m: Supa) => m.month_key as string);

  return NextResponse.json({ months: monthsWithGroups });
}
