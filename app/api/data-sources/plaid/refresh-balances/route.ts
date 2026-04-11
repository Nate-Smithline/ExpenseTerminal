import { NextResponse } from "next/server";
import { createSupabaseRouteClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { decryptAccessToken } from "@/lib/plaid";
import { persistPlaidBalancesForPlaidItem } from "@/lib/plaid-balance-persist";
import { requireOrgIdForAccounts } from "@/lib/data-sources/require-active-org";
import { canMutateWorkspaceDataSource } from "@/lib/data-sources/workspace-account-list-scope";

function getRequestHostname(req: Request): string {
  const xfHost = req.headers.get("x-forwarded-host");
  const host = req.headers.get("host");
  const raw = (xfHost ?? host ?? "").split(",")[0]?.trim();
  if (raw) return raw.split(":")[0] ?? raw;
  return new URL(req.url).hostname;
}

/**
 * Refresh stored balances for one Plaid-linked data source (same Item may update sibling accounts).
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
  const org = await requireOrgIdForAccounts(supabase as any, userId);
  if ("error" in org) {
    return NextResponse.json({ error: org.error }, { status: org.status });
  }

  const { data: row, error: fetchErr } = await (supabase as any)
    .from("data_sources")
    .select("id, user_id, source_type, plaid_access_token, plaid_item_id")
    .eq("id", dataSourceId)
    .eq("org_id", org.orgId)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const ownerId = row.user_id as string;
  const allowed = await canMutateWorkspaceDataSource(supabase as any, org.orgId, userId, ownerId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (row.source_type !== "plaid" || !row.plaid_access_token || !row.plaid_item_id) {
    return NextResponse.json({ error: "Not a Plaid-linked account" }, { status: 400 });
  }

  try {
    const accessToken = decryptAccessToken(row.plaid_access_token as string);
    const hostname = getRequestHostname(req);
    const runAsMemberOnPeerAccount = ownerId !== userId;
    let db = supabase as any;
    if (runAsMemberOnPeerAccount) {
      try {
        db = createSupabaseServiceClient();
      } catch {
        return NextResponse.json(
          { error: "Shared account refresh is not configured (missing service key)." },
          { status: 503 },
        );
      }
    }
    await persistPlaidBalancesForPlaidItem(
      db,
      ownerId,
      hostname,
      accessToken,
      row.plaid_item_id as string,
      org.orgId,
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Balance refresh failed";
    console.error("[plaid/refresh-balances]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
