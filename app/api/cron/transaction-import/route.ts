import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { runSyncForDataSource } from "@/lib/data-sources/sync-runner";
import { runAnalysisForIds } from "@/lib/ai/analyze-transactions";
import { applyAllAutoSortRulesForUser } from "@/lib/auto-sort";
import { applyAllMarkerRulesForUser } from "@/lib/triage/marker-rules";
import { snapshotAllUsersNetWorth } from "@/lib/accounts/net-worth-snapshots";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Vercel Cron — runs at 2:00 AM EST (07:00 UTC) every night.
 *
 * For each connected data source:
 *  1. Sync new transactions from Plaid or Stripe.
 *  2. Auto-analyze any pending, uncategorized transactions for that user.
 *     Cached vendor patterns resolve instantly; only genuinely new merchants hit the AI.
 *
 * Zero-click design: by the time the user opens the app, their transactions
 * are already categorized. No second button required.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const { data: sources } = await (supabase as any)
    .from("data_sources")
    .select("id, user_id, source_type")
    .in("source_type", ["stripe", "plaid"]);

  const xfHost = req.headers.get("x-forwarded-host");
  const host = req.headers.get("host");
  const hostname = (xfHost ?? host ?? "").split(",")[0]?.trim()?.split(":")[0] || new URL(req.url).hostname;

  const results: {
    id: string;
    source_type: string;
    sync: { success: boolean; error?: string };
    analysis?: { successful: number; failed: number; cachedCount: number; total: number };
  }[] = [];

  for (const row of sources ?? []) {
    // ── Step 1: Sync ────────────────────────────────────────────────────────
    const syncResult = await runSyncForDataSource(
      supabase,
      row.user_id,
      row.id,
      row.source_type,
      { hostname },
    );

    const entry: (typeof results)[number] = {
      id: row.id,
      source_type: row.source_type,
      sync: { success: syncResult.success, error: syncResult.error },
    };

    // ── Step 2: Apply saved vendor rules to new pending transactions ────────
    if (syncResult.success) {
      try {
        await applyAllAutoSortRulesForUser(supabase, row.user_id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[cron/transaction-import] Auto-sort rules error", { userId: row.user_id, sourceId: row.id, msg });
      }
      try {
        await applyAllMarkerRulesForUser(supabase, row.user_id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[cron/transaction-import] Marker rules error", { userId: row.user_id, sourceId: row.id, msg });
      }
    }

    // ── Step 3: Auto-analyze (only on successful sync) ─────────────────────
    if (syncResult.success) {
      try {
        const analysisResult = await autoAnalyzeForUser(supabase, row.user_id, row.id);
        entry.analysis = analysisResult;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[cron/transaction-import] Auto-analyze error", { userId: row.user_id, sourceId: row.id, msg });
        entry.analysis = { successful: 0, failed: 0, cachedCount: 0, total: 0 };
      }
    }

    results.push(entry);
  }

  // Step 4: Record per-account balance snapshots for net worth history.
  const snapshotResult = await snapshotAllUsersNetWorth(supabase);

  return NextResponse.json({ ok: true, results, snapshots: snapshotResult });
}

/**
 * Fetch pending, uncategorized transactions for this user's data source,
 * then run AI analysis on them. Capped at 300 per run to keep within cron limits.
 */
async function autoAnalyzeForUser(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  userId: string,
  dataSourceId: string,
): Promise<{ successful: number; failed: number; cachedCount: number; total: number }> {
  // Fetch business industry for context-aware prompting
  const { data: orgRow } = await (supabase as any)
    .from("org_settings")
    .select("business_industry")
    .eq("user_id", userId)
    .single();
  const businessIndustry: string | null = orgRow?.business_industry ?? null;

  // Get pending, uncategorized transactions for this data source.
  // We order by created_at DESC so the freshest transactions (just synced) go first.
  const { data: pendingRows } = await (supabase as any)
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("data_source_id", dataSourceId)
    .eq("status", "pending")
    .is("category", null)
    .order("created_at", { ascending: false })
    .limit(300);

  const ids: string[] = (pendingRows ?? []).map((r: { id: string }) => r.id);
  if (ids.length === 0) {
    return { successful: 0, failed: 0, cachedCount: 0, total: 0 };
  }

  const result = await runAnalysisForIds(supabase as any, userId, ids, businessIndustry);
  console.log("[cron/transaction-import] Auto-analyze complete", {
    userId,
    dataSourceId,
    total: result.total,
    successful: result.successful,
    cachedCount: result.cachedCount,
    failed: result.failed,
  });

  return result;
}
