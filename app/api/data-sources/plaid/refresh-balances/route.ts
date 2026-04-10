import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { decryptAccessToken } from "@/lib/plaid";
import { persistPlaidBalancesForPlaidItem } from "@/lib/plaid-balance-persist";

function getRequestHostname(req: Request): string {
  const xfHost = req.headers.get("x-forwarded-host");
  const host = req.headers.get("host");
  const raw = (xfHost ?? host ?? "").split(",")[0]?.trim();
  if (raw) return raw.split(":")[0] ?? raw;
  return new URL(req.url).hostname;
}

/**
 * Refresh cached Plaid balances for the Plaid item tied to this data source (all accounts on that item).
 */
export async function POST(req: Request) {
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

  let body: { data_source_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const dataSourceId = body.data_source_id;
  if (!dataSourceId || typeof dataSourceId !== "string") {
    return NextResponse.json({ error: "data_source_id is required" }, { status: 400 });
  }

  const supabase = authClient;
  const { data: row, error: fetchError } = await (supabase as any)
    .from("data_sources")
    .select("id, source_type, plaid_item_id, plaid_access_token")
    .eq("id", dataSourceId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !row) {
    return NextResponse.json({ error: "Data source not found" }, { status: 404 });
  }
  if (row.source_type !== "plaid" || !row.plaid_access_token || !row.plaid_item_id) {
    return NextResponse.json(
      { error: "Only Plaid-linked accounts support balance refresh." },
      { status: 400 },
    );
  }

  const hostname = getRequestHostname(req);
  try {
    const token = decryptAccessToken(row.plaid_access_token as string);
    await persistPlaidBalancesForPlaidItem(
      supabase,
      userId,
      hostname,
      token,
      row.plaid_item_id as string,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Balance refresh failed";
    console.warn("[plaid/refresh-balances]", msg);
    return NextResponse.json(
      { error: safeErrorMessage(msg, "Could not refresh bank balance") },
      { status: 500 },
    );
  }
}
