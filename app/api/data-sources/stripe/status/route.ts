import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { getStripeClient, getStripeMode } from "@/lib/stripe";

/**
 * GET ?data_source_id= — returns Stripe Financial Connections account status for a direct-feed source.
 * Used to show "Repair" when status is disconnected or inactive.
 */
export async function GET(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;

  const url = new URL(req.url);
  const dataSourceId = url.searchParams.get("data_source_id");
  if (!dataSourceId) {
    return NextResponse.json({ error: "data_source_id required" }, { status: 400 });
  }

  const supabase = authClient;
  const { data: row, error: fetchError } = await (supabase as any)
    .from("data_sources")
    .select("id, source_type, financial_connections_account_id")
    .eq("id", dataSourceId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !row) {
    return NextResponse.json({ error: "Data source not found" }, { status: 404 });
  }
  if (row.source_type !== "stripe" || !row.financial_connections_account_id) {
    return NextResponse.json({ status: "n/a" });
  }

  try {
    const mode = getStripeMode(url.hostname);
    const stripe = getStripeClient(mode);
    const account = await (stripe as any).financialConnections?.accounts?.retrieve(
      row.financial_connections_account_id
    );
    const status = account?.status ?? "unknown";
    return NextResponse.json({ status });
  } catch {
    return NextResponse.json({ status: "unknown" });
  }
}
