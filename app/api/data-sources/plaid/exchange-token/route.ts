import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { getPlaidClient, encryptAccessToken } from "@/lib/plaid";
import { persistPlaidBalancesForPlaidItem } from "@/lib/plaid-balance-persist";
import { requireOrgIdForAccounts } from "@/lib/data-sources/require-active-org";

function getRequestHostname(req: Request): string {
  const xfHost = req.headers.get("x-forwarded-host");
  const host = req.headers.get("host");
  const raw = (xfHost ?? host ?? "").split(",")[0]?.trim();
  if (raw) return raw.split(":")[0] ?? raw;
  return new URL(req.url).hostname;
}

/**
 * Exchange a Plaid public_token for an access_token and persist the linked account.
 * Called by the client after Plaid Link `onSuccess`.
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

  let body: {
    public_token?: string;
    metadata?: {
      institution?: { institution_id?: string; name?: string };
      accounts?: Array<{ id?: string; name?: string; type?: string; subtype?: string }>;
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const publicToken = body.public_token;
  if (!publicToken || typeof publicToken !== "string") {
    return NextResponse.json({ error: "public_token is required" }, { status: 400 });
  }

  const supabase = authClient;
  const org = await requireOrgIdForAccounts(supabase as any, userId);
  if ("error" in org) {
    return NextResponse.json({ error: org.error }, { status: org.status });
  }

  const hostname = getRequestHostname(req);
  const plaid = getPlaidClient(hostname);

  try {
    // Preflight: ensure DB has Plaid columns (migration applied).
    // If these columns don't exist, inserts will fail and the UI will show a generic error.
    const preflight = await (supabase as any)
      .from("data_sources")
      .select("plaid_access_token")
      .limit(1);
    if (preflight?.error) {
      const msg = preflight.error.message ?? "Database is missing Plaid columns";
      return NextResponse.json(
        {
          error:
            "Database schema is missing Plaid columns. Apply the Plaid migration, then try again.",
          debug: process.env.NODE_ENV !== "production" ? { detail: msg } : undefined,
        },
        { status: 503 },
      );
    }

    const exchangeRes = await plaid.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = exchangeRes.data.access_token;
    const itemId = exchangeRes.data.item_id;
    const encryptedToken = encryptAccessToken(accessToken);

    const institutionName = body.metadata?.institution?.name ?? null;
    const institutionId = body.metadata?.institution?.institution_id ?? null;
    const accounts = body.metadata?.accounts ?? [];

    const now = new Date().toISOString();
    const createdIds: string[] = [];
    let firstSaveError: string | null = null;

    // Check if this item already exists (reconnect scenario)
    const { data: existingByItem } = await (supabase as any)
      .from("data_sources")
      .select("id")
      .eq("user_id", userId)
      .eq("org_id", org.orgId)
      .eq("plaid_item_id", itemId);

    if (existingByItem && existingByItem.length > 0) {
      // Reconnecting an existing item — refresh the access token on every row for this Plaid item
      const existingIds = existingByItem.map((r: { id: string }) => r.id);
      const { error: bulkUpdateErr } = await (supabase as any)
        .from("data_sources")
        .update({
          plaid_access_token: encryptedToken,
          connected_at: now,
          last_failed_sync_at: null,
          last_error_summary: null,
        })
        .in("id", existingIds)
        .eq("user_id", userId)
        .eq("org_id", org.orgId);
      if (bulkUpdateErr) {
        firstSaveError = firstSaveError ?? bulkUpdateErr.message ?? String(bulkUpdateErr);
      } else {
        createdIds.push(...existingIds);
      }
    } else {
      // New connection -- create a data source per account (or one for the item)
      if (accounts.length > 0) {
        for (const acc of accounts) {
          const displayName = acc.name ?? institutionName ?? "Bank account";
          const accountType = acc.subtype === "credit card" ? "credit"
            : acc.type === "depository" ? "checking"
            : "other";

          const { data: inserted, error: insertErr } = await (supabase as any)
            .from("data_sources")
            .insert({
              org_id: org.orgId,
              user_id: userId,
              name: displayName,
              account_type: accountType,
              institution: institutionName,
              source_type: "plaid",
              plaid_access_token: encryptedToken,
              plaid_item_id: itemId,
              plaid_account_id: acc.id ?? null,
              plaid_institution_id: institutionId,
              plaid_cursor: null,
              connected_at: now,
              last_successful_sync_at: null,
              last_failed_sync_at: null,
              last_error_summary: null,
              transaction_count: 0,
            })
            .select("id")
            .single();
          if (insertErr) {
            console.error("[plaid/exchange-token] Insert error", insertErr.message);
            firstSaveError = firstSaveError ?? insertErr.message ?? String(insertErr);
          } else if (inserted?.id) {
            createdIds.push(inserted.id);
          }
        }
      } else {
        // No account metadata -- create a single data source for the item
        const { data: inserted, error: insertErr } = await (supabase as any)
          .from("data_sources")
          .insert({
            org_id: org.orgId,
            user_id: userId,
            name: institutionName ?? "Bank account",
            account_type: "checking",
            institution: institutionName,
            source_type: "plaid",
            plaid_access_token: encryptedToken,
            plaid_item_id: itemId,
            plaid_institution_id: institutionId,
            plaid_cursor: null,
            connected_at: now,
            last_successful_sync_at: null,
            last_failed_sync_at: null,
            last_error_summary: null,
            transaction_count: 0,
          })
          .select("id")
          .single();
        if (insertErr) {
          console.error("[plaid/exchange-token] Insert error", insertErr.message);
          firstSaveError = firstSaveError ?? insertErr.message ?? String(insertErr);
        } else if (inserted?.id) {
          createdIds.push(inserted.id);
        }
      }
    }

    if (createdIds.length === 0) {
      return NextResponse.json(
        {
          error: "Could not save linked account. Please try again.",
          ...(process.env.NODE_ENV !== "production" && firstSaveError
            ? { debug: { detail: firstSaveError } }
            : {}),
        },
        { status: 500 },
      );
    }

    try {
      await persistPlaidBalancesForPlaidItem(supabase, userId, hostname, accessToken, itemId, org.orgId);
    } catch (balErr) {
      console.warn("[plaid/exchange-token] Balance snapshot failed", balErr);
    }

    return NextResponse.json({
      success: true,
      accountCount: createdIds.length,
      dataSourceIds: createdIds,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Token exchange failed";
    console.error("[plaid/exchange-token]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
