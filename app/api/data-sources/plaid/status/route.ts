import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { getPlaidClient, decryptAccessToken } from "@/lib/plaid";

function getRequestHostname(req: Request): string {
  const xfHost = req.headers.get("x-forwarded-host");
  const host = req.headers.get("host");
  const raw = (xfHost ?? host ?? "").split(",")[0]?.trim();
  if (raw) return raw.split(":")[0] ?? raw;
  return new URL(req.url).hostname;
}

/**
 * GET ?data_source_id= — check Plaid item health for the "Repair connection" UI.
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
    .select("id, source_type, plaid_access_token, plaid_item_id")
    .eq("id", dataSourceId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !row) {
    return NextResponse.json({ error: "Data source not found" }, { status: 404 });
  }
  if (row.source_type !== "plaid" || !row.plaid_access_token) {
    return NextResponse.json({ status: "n/a" });
  }

  try {
    const plaid = getPlaidClient(getRequestHostname(req));
    const accessToken = decryptAccessToken(row.plaid_access_token);
    const itemRes = await plaid.itemGet({ access_token: accessToken });
    const item = itemRes.data.item;

    if (item.error) {
      const errorCode = item.error.error_code;
      if (errorCode === "ITEM_LOGIN_REQUIRED") {
        return NextResponse.json({ status: "login_required" });
      }
      return NextResponse.json({ status: "error", error_code: errorCode });
    }

    return NextResponse.json({ status: "good" });
  } catch {
    return NextResponse.json({ status: "unknown" });
  }
}
