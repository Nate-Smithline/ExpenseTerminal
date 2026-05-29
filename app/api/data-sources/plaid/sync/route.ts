import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { runSyncForDataSource } from "@/lib/data-sources/sync-runner";

export const maxDuration = 300;

function getHostname(req: Request): string {
  const xfHost = req.headers.get("x-forwarded-host");
  const host = req.headers.get("host");
  const raw = (xfHost ?? host ?? "").split(",")[0]?.trim();
  return raw ? (raw.split(":")[0] ?? raw) : new URL(req.url).hostname;
}

/**
 * POST /api/data-sources/plaid/sync
 * Body: { dataSourceId: string }
 *
 * Runs a full Plaid transactions/sync for a single data source.
 * Used by "Sync now" in the account edit modal and by the post-import flow.
 */
export async function POST(req: Request) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;

  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { dataSourceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { dataSourceId } = body;
  if (!dataSourceId) {
    return NextResponse.json({ error: "dataSourceId is required" }, { status: 400 });
  }

  // Verify this data source belongs to the authenticated user
  const { data: row, error: fetchErr } = await (supabase as any)
    .from("data_sources")
    .select("id, source_type")
    .eq("id", dataSourceId)
    .eq("user_id", userId)
    .single();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Data source not found" }, { status: 404 });
  }

  if (row.source_type !== "plaid") {
    return NextResponse.json({ error: "Only Plaid data sources can be synced via this endpoint" }, { status: 400 });
  }

  const hostname = getHostname(req);
  const result = await runSyncForDataSource(supabase, userId, dataSourceId, "plaid", { hostname });

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Sync failed" }, { status: result.status ?? 500 });
  }

  return NextResponse.json({
    ok: true,
    message: result.message,
    diagnostics: result.plaidDiagnostics,
  });
}
