import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { getPlaidClient, encryptAccessToken } from "@/lib/plaid";

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
    start_date?: string | null;
    account_prefs?: Record<string, boolean>;
    metadata?: {
      institution?: { institution_id?: string; name?: string };
      accounts?: Array<{ id?: string; name?: string; type?: string; subtype?: string; mask?: string }>;
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
  const hostname = getRequestHostname(req);
  const plaid = getPlaidClient(hostname);

  try {
    // Preflight: ensure DB has Plaid columns (migration applied).
    const preflight = await (supabase as any)
      .from("data_sources")
      .select("plaid_access_token")
      .limit(1);
    if (preflight?.error) {
      const msg = preflight.error.message ?? "Database is missing Plaid columns";
      return NextResponse.json(
        {
          error: "Database schema is missing Plaid columns. Apply the migration, then try again.",
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
    const startDate = body.start_date ?? null;
    // Per-account opt-in: { [plaidAccountId]: true = import transactions, false = balance only }
    const accountPrefs: Record<string, boolean> = body.account_prefs ?? {};

    const now = new Date().toISOString();
    const createdIds: string[] = [];
    const syncIds: string[] = [];
    let firstSaveError: string | null = null;

    // Check if this item already exists (reconnect scenario)
    const { data: existingByItem } = await (supabase as any)
      .from("data_sources")
      .select("id")
      .eq("user_id", userId)
      .eq("plaid_item_id", itemId)
      .limit(1);

      if (existingByItem && existingByItem.length > 0) {
      // Reconnecting an existing item — update the access token
      for (const existing of existingByItem) {
        const { error: updateErr } = await (supabase as any)
          .from("data_sources")
          .update({
            plaid_access_token: encryptedToken,
            connected_at: now,
            last_failed_sync_at: null,
            last_error_summary: null,
          })
          .eq("id", existing.id)
          .eq("user_id", userId);
        if (updateErr) {
          firstSaveError = firstSaveError ?? updateErr.message ?? String(updateErr);
        } else {
          createdIds.push(existing.id);
          syncIds.push(existing.id); // On reconnect always sync to catch up
        }
      }
    } else {
      // New connection — create a data source per account (or one for the item).
      // Core insert uses only columns guaranteed to exist in the base schema.
      // New columns (plaid_account_id, mask, plaid_sync_start_date, institution_name)
      // are applied in a separate update so a missing migration never blocks account creation.
      const accountsToInsert = accounts.length > 0
        ? accounts.map(acc => ({
            plaidAccountId: acc.id ?? null,
            mask: acc.mask ?? null,
            displayName: acc.name ?? institutionName ?? "Bank account",
            accountType:
              acc.subtype === "credit card" ? "credit"
              : acc.type === "depository" ? "checking"
              : "other",
          }))
        : [{ plaidAccountId: null, mask: null, displayName: institutionName ?? "Bank account", accountType: "checking" }];

      for (const acc of accountsToInsert) {
        const wantsTxns = accountPrefs[acc.plaidAccountId ?? ""] ?? true;
        const { data: inserted, error: insertErr } = await (supabase as any)
          .from("data_sources")
          .insert({
              user_id: userId,
              name: acc.displayName,
              account_type: acc.accountType,
              institution: institutionName,
              source_type: "plaid",
              pull_transactions: wantsTxns,
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
          continue;
        }

        if (inserted?.id) {
          createdIds.push(inserted.id);
          if (wantsTxns) syncIds.push(inserted.id);

          // Apply new-schema columns as a non-fatal update (requires migration to have run)
          const extras: Record<string, unknown> = {};
          if (acc.plaidAccountId) extras.plaid_account_id = acc.plaidAccountId;
          if (acc.mask) extras.mask = acc.mask;
          if (startDate) extras.plaid_sync_start_date = startDate;
          if (institutionName) extras.institution_name = institutionName;

          if (Object.keys(extras).length > 0) {
            const { error: extErr } = await (supabase as any)
              .from("data_sources")
              .update(extras)
              .eq("id", inserted.id)
              .eq("user_id", userId);
            if (extErr) {
              console.warn("[plaid/exchange-token] Extra columns update skipped (run migration):", extErr.message);
            }
          }
        }
      }
    }

    if (createdIds.length === 0) {
      const detail = firstSaveError ?? "Unknown insert error";
      console.error("[plaid/exchange-token] All inserts failed:", detail);
      return NextResponse.json({ error: detail }, { status: 500 });
    }

    // Fetch live balances from Plaid and persist them (non-fatal — requires balance+mask columns)
    try {
      const balanceRes = await plaid.accountsGet({ access_token: accessToken });
      const plaidAccounts = balanceRes.data.accounts;
      const now2 = new Date().toISOString();

      type PlaidAccount = { account_id: string; mask?: string | null; balances?: { current?: number | null } };
      // Build a lookup by account_id so we can match multi-account items
      const byPlaidId = new Map(
        plaidAccounts.map((a: PlaidAccount) => [a.account_id, a])
      );

      const { data: createdRows } = await (supabase as any)
        .from("data_sources")
        .select("id, plaid_account_id")
        .in("id", createdIds);

      for (const row of createdRows ?? []) {
        const match: PlaidAccount | undefined =
          (row.plaid_account_id ? byPlaidId.get(row.plaid_account_id) : undefined) ??
          (plaidAccounts.length === 1 ? (plaidAccounts[0] as PlaidAccount) : undefined);
        if (!match) continue;

        const { error: balErr } = await (supabase as any)
          .from("data_sources")
          .update({
            balance: match.balances?.current ?? null,
            balance_updated_at: now2,
            mask: match.mask ?? null,
          })
          .eq("id", row.id)
          .eq("user_id", userId);
        if (balErr) {
          console.warn("[plaid/exchange-token] Balance update skipped (run migration):", balErr.message);
        }
      }
    } catch (balanceErr) {
      console.warn("[plaid/exchange-token] Balance fetch failed:", balanceErr instanceof Error ? balanceErr.message : String(balanceErr));
    }

    return NextResponse.json({
      success: true,
      accountCount: createdIds.length,
      dataSourceIds: createdIds,
      syncIds,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Token exchange failed";
    console.error("[plaid/exchange-token]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
