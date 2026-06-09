import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { upsertNetWorthSnapshots } from "@/lib/accounts/net-worth-snapshots";

/**
 * POST /api/net-worth/snapshot
 * Records today's per-account balance snapshots so the net worth chart can build history.
 */
export async function POST() {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const { data: accounts, error } = await (supabase as any)
    .from("data_sources")
    .select("id, account_type, balance")
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await upsertNetWorthSnapshots(supabase, userId, accounts ?? []);

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
