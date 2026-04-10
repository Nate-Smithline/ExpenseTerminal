import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { runSyncForDataSource } from "@/lib/data-sources/sync-runner";
import { refreshAllPlaidItemBalances } from "@/lib/plaid-balance-persist";
import { runOrgRulesDailyAllOrgs } from "@/lib/org-rules/executor";
import { upsertDailyFinancialSnapshotsForAllUsers } from "@/lib/financial-snapshots";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * EventBridge / Vercel Cron: daily transaction import + Plaid balance refresh for all connected sources.
 * Schedule: 2:00 AM EST (07:00 UTC) per `vercel.json`.
 * - Stripe / Plaid: incremental transaction sync per `data_sources` row.
 * - Plaid: after syncs, one `accountsBalanceGet` per Plaid item (deduped) so balances update even if txn sync fails.
 * Secured by CRON_SECRET: set in Vercel (and .env.local for local testing).
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured. Set CRON_SECRET in Vercel Environment Variables (and .env.local for local runs)." },
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
  const results: { id: string; source_type: string; success: boolean; error?: string }[] = [];
  for (const row of sources ?? []) {
    const result = await runSyncForDataSource(
      supabase,
      row.user_id,
      row.id,
      row.source_type,
      {
        hostname,
        ...(row.source_type === "plaid" ? { skipPostSyncPlaidBalanceRefresh: true } : {}),
      },
    );
    results.push({
      id: row.id,
      source_type: row.source_type,
      success: result.success,
      error: result.error,
      ...(result.diagnostics ? { diagnostics: result.diagnostics } : {}),
      ...(result.plaidDiagnostics ? { plaidDiagnostics: result.plaidDiagnostics } : {}),
    });
  }

  const plaidBalanceRefresh = await refreshAllPlaidItemBalances(supabase, hostname);

  let financialSnapshots: Awaited<ReturnType<typeof upsertDailyFinancialSnapshotsForAllUsers>> | null = null;
  try {
    financialSnapshots = await upsertDailyFinancialSnapshotsForAllUsers(supabase);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[cron/transaction-import] financial snapshots failed", msg);
    financialSnapshots = { date: "", users: 0, ok: 0, failed: 0, errors: [msg] };
  }

  let orgRulesDaily: Awaited<ReturnType<typeof runOrgRulesDailyAllOrgs>> | { error: string } | null = null;
  try {
    orgRulesDaily = await runOrgRulesDailyAllOrgs(supabase);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[cron/transaction-import] org rules daily failed", msg);
    orgRulesDaily = { error: msg };
  }

  return NextResponse.json({ ok: true, results, plaidBalanceRefresh, financialSnapshots, orgRulesDaily });
}
