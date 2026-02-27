import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { getPlanLimitsForUser } from "@/lib/billing/get-user-plan";

export async function GET() {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;
  const supabase = authClient;

  const limits = await getPlanLimitsForUser(supabase, userId);
  const maxCsv = limits.maxCsvTransactionsForAi === Number.POSITIVE_INFINITY
    ? null
    : limits.maxCsvTransactionsForAi;

  const { count: totalCsvUploaded } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source", "csv_upload");

  const { count: eligibleForAi } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source", "csv_upload")
    .eq("eligible_for_ai", true);

  const total = totalCsvUploaded ?? 0;
  const eligible = eligibleForAi ?? 0;
  const overLimitCount = maxCsv != null ? Math.max(0, total - maxCsv) : 0;
  const overLimit = maxCsv != null && total > maxCsv;

  const { data: subRow } = await (supabase as any)
    .from("subscriptions")
    .select("current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentPeriodEnd = subRow?.current_period_end ?? null;
  const cancelAtPeriodEnd = subRow?.cancel_at_period_end ?? false;

  return NextResponse.json({
    plan: limits.plan,
    maxCsvTransactionsForAi: maxCsv,
    csvTransactions: {
      totalCsvUploaded: total,
      eligibleForAi: eligible,
      overLimitCount,
    },
    overLimit,
    subscriptionStatus: limits.subscription?.status ?? null,
    currentPeriodEnd,
    cancelAtPeriodEnd,
  });
}
