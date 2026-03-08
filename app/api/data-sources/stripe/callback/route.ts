import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { safeErrorMessage } from "@/lib/api/safe-error";

/**
 * Callback after Stripe Financial Connections flow.
 * Query params: session_id (Stripe FC session id). Add format=json to get JSON instead of redirect.
 * Creates or updates data_sources row with source_type=stripe and runs initial transaction pull.
 */
export async function GET(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  const userId = auth.userId;

  const url = new URL(req.url);
  const returnJson = url.searchParams.get("format") === "json";
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) {
    return returnJson
      ? NextResponse.json({ success: false, error: "missing_session" }, { status: 400 })
      : NextResponse.redirect(new URL("/data-sources?error=missing_session", req.url));
  }

  const supabase = authClient;
  const { getStripeClient, getStripeMode } = await import("@/lib/stripe");
  const mode = getStripeMode(url.hostname);
  const stripe = getStripeClient(mode);

  try {
    const fc = (stripe as any).financialConnections;
    if (!fc?.sessions?.retrieve) {
      return returnJson ? NextResponse.json({ success: false, error: "stripe_fc_unavailable" }, { status: 501 }) : NextResponse.redirect(new URL("/data-sources?error=stripe_fc_unavailable", req.url));
    }

    // Session can be "pending" briefly after redirect; retry a few times before failing.
    let session: { status?: string; account?: { id: string }; accounts?: { data?: Array<{ id: string }> }; account_holder?: { customer?: string } } | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      session = await fc.sessions.retrieve(sessionId);
      if (!session) break;
      if (session.status === "succeeded") break;
      if (session.status === "cancelled" || session.status === "failed") {
        return returnJson ? NextResponse.json({ success: false, error: "session_not_succeeded" }, { status: 400 }) : NextResponse.redirect(new URL("/data-sources?error=session_not_succeeded", req.url));
      }
      // pending or no status yet — wait and retry
      if (attempt < 3) await new Promise((r) => setTimeout(r, 800));
    }

    if (!session) {
      return returnJson ? NextResponse.json({ success: false, error: "session_not_succeeded" }, { status: 400 }) : NextResponse.redirect(new URL("/data-sources?error=session_not_succeeded", req.url));
    }

    // All accounts from session (user may have selected multiple).
    const accountList = session.accounts?.data ?? [];
    if (accountList.length === 0) {
      if (session.status !== "succeeded") {
        return returnJson ? NextResponse.json({ success: false, error: "session_not_succeeded" }, { status: 400 }) : NextResponse.redirect(new URL("/data-sources?error=session_not_succeeded", req.url));
      }
      return returnJson ? NextResponse.json({ success: true, stripe_fc: "no_account", accountCount: 0 }) : NextResponse.redirect(new URL("/data-sources?error=no_account", req.url));
    }

    // Read lookback/start_date from cookie (set by client before opening Stripe).
    const cookieHeader = req.headers.get("cookie") ?? "";
    let stripeSyncStartDate: string | null = null;
    try {
      const match = cookieHeader.match(/\bstripe_fc_lookback=([^;]+)/);
      if (match) {
        const decoded = decodeURIComponent(match[1].trim());
        const parsed = JSON.parse(decoded) as { lookback?: string; start_date?: string };
        if (parsed.lookback === "custom" && parsed.start_date) stripeSyncStartDate = parsed.start_date;
        else if (parsed.lookback === "2years") {
          const d = new Date();
          d.setFullYear(d.getFullYear() - 2);
          stripeSyncStartDate = d.toISOString().slice(0, 10);
        }
        // "forward" = no historical pull, leave stripeSyncStartDate null
      }
    } catch {
      // ignore cookie parse errors
    }

    const now = new Date().toISOString();
    const customerId = session.account_holder?.customer ?? null;
    const idsToSync: string[] = [];
    let onlyUpdates = true;
    let saveError: string | null = null;

    function isStripeSyncStartDateError(msg: string): boolean {
      return /stripe_sync_start_date/i.test(msg) && (/schema cache|column/i.test(msg) || msg.includes("Could not find"));
    }

    for (const acc of accountList) {
      const accountId = typeof acc === "string" ? acc : (acc as { id: string }).id;
      if (!accountId) continue;

      const { data: existingById } = await (supabase as any)
        .from("data_sources")
        .select("id")
        .eq("user_id", userId)
        .eq("financial_connections_account_id", accountId)
        .maybeSingle();

      if (existingById?.id) {
        const updatePayload: Record<string, unknown> = {
          connected_at: now,
          last_successful_sync_at: now,
          last_failed_sync_at: null,
          last_error_summary: null,
        };
        if (stripeSyncStartDate) updatePayload.stripe_sync_start_date = stripeSyncStartDate;
        let { error: updateErr } = await (supabase as any)
          .from("data_sources")
          .update(updatePayload)
          .eq("id", existingById.id)
          .eq("user_id", userId);
        if (updateErr && isStripeSyncStartDateError(updateErr.message) && stripeSyncStartDate) {
          delete updatePayload.stripe_sync_start_date;
          const retry = await (supabase as any)
            .from("data_sources")
            .update(updatePayload)
            .eq("id", existingById.id)
            .eq("user_id", userId);
          updateErr = retry.error;
        }
        if (updateErr) saveError = saveError ?? updateErr.message;
        else idsToSync.push(existingById.id);
        continue;
      }

      onlyUpdates = false;
      const account = await (stripe as any).financialConnections?.accounts?.retrieve(accountId);
      const displayName = account?.display_name ?? account?.institution_name ?? "Bank account";
      const institutionName = account?.institution_name ?? null;

      const row: Record<string, unknown> = {
        name: displayName,
        account_type: "checking",
        institution: institutionName,
        source_type: "stripe",
        stripe_account_id: customerId,
        financial_connections_account_id: accountId,
        connected_at: now,
        last_successful_sync_at: null,
        last_failed_sync_at: null,
        last_error_summary: null,
        transaction_count: 0,
      };
      if (stripeSyncStartDate) row.stripe_sync_start_date = stripeSyncStartDate;

      // If there's an existing Direct Feed row with no bank link (orphan), attach this account to it so we don't create duplicates.
      const { data: orphanData } = await (supabase as any)
        .from("data_sources")
        .select("id")
        .eq("user_id", userId)
        .eq("source_type", "stripe")
        .is("financial_connections_account_id", null)
        .order("created_at", { ascending: false })
        .limit(1);
      const orphan = Array.isArray(orphanData) ? orphanData[0] : orphanData;

      if (orphan?.id) {
        const orphanPayload: Record<string, unknown> = {
          name: displayName,
          institution: institutionName,
          stripe_account_id: customerId,
          financial_connections_account_id: accountId,
          connected_at: now,
          last_successful_sync_at: null,
          last_failed_sync_at: null,
          last_error_summary: null,
        };
        if (stripeSyncStartDate) orphanPayload.stripe_sync_start_date = stripeSyncStartDate;
        let { error: updateErr } = await (supabase as any)
          .from("data_sources")
          .update(orphanPayload)
          .eq("id", orphan.id)
          .eq("user_id", userId);
        if (updateErr && isStripeSyncStartDateError(updateErr.message) && stripeSyncStartDate) {
          delete orphanPayload.stripe_sync_start_date;
          const retry = await (supabase as any)
            .from("data_sources")
            .update(orphanPayload)
            .eq("id", orphan.id)
            .eq("user_id", userId);
          updateErr = retry.error;
        }
        if (updateErr) saveError = saveError ?? updateErr.message;
        else idsToSync.push(orphan.id);
      } else {
        let { data: inserted, error: insertErr } = await (supabase as any)
          .from("data_sources")
          .insert({ user_id: userId, ...row })
          .select("id")
          .single();
        if (insertErr && isStripeSyncStartDateError(insertErr.message) && stripeSyncStartDate) {
          const rowWithoutDate = { ...row };
          delete rowWithoutDate.stripe_sync_start_date;
          const retry = await (supabase as any)
            .from("data_sources")
            .insert({ user_id: userId, ...rowWithoutDate })
            .select("id")
            .single();
          insertErr = retry.error;
          inserted = retry.data;
        }
        if (insertErr) saveError = saveError ?? insertErr.message;
        else if (inserted?.id) idsToSync.push(inserted.id);
      }
    }

    if (saveError) {
      const errMsg = "Could not save account: " + saveError;
      return returnJson ? NextResponse.json({ success: false, error: errMsg }, { status: 500 }) : NextResponse.redirect(new URL(`/data-sources?error=${encodeURIComponent(errMsg)}`, req.url));
    }
    if (accountList.length > 0 && idsToSync.length === 0) {
      const errMsg = "Accounts could not be saved. Please try again.";
      return returnJson ? NextResponse.json({ success: false, error: errMsg }, { status: 500 }) : NextResponse.redirect(new URL("/data-sources?error=" + encodeURIComponent(errMsg), req.url));
    }

    // Trigger initial transaction pull for all linked sources (new and re-linked).
    const { runSyncForDataSource } = await import("@/lib/data-sources/sync-runner");
    const stripeMode = (await import("@/lib/stripe")).getStripeMode(url.hostname);
    for (const id of idsToSync) {
      runSyncForDataSource(supabase, userId, id, "stripe", { stripeMode }).catch(() => {});
    }

    const stripeFc = onlyUpdates ? "already_linked" : "success";
    if (returnJson) {
      const res = NextResponse.json({ success: true, stripe_fc: stripeFc, accountCount: idsToSync.length });
      res.headers.append("Set-Cookie", "stripe_fc_lookback=; Path=/; Max-Age=0; SameSite=Lax");
      return res;
    }
    const redirectUrl = new URL("/data-sources", req.url);
    redirectUrl.searchParams.set("stripe_fc", stripeFc);
    const res = NextResponse.redirect(redirectUrl);
    res.headers.append("Set-Cookie", "stripe_fc_lookback=; Path=/; Max-Age=0; SameSite=Lax");
    return res;
  } catch (e) {
    const message = safeErrorMessage(e instanceof Error ? e.message : "Callback failed", "Connection failed");
    return returnJson ? NextResponse.json({ success: false, error: message }, { status: 500 }) : NextResponse.redirect(new URL(`/data-sources?error=${encodeURIComponent(message)}`, req.url));
  }
}
