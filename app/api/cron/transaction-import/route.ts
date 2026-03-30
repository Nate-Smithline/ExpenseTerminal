import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { runSyncForDataSource } from "@/lib/data-sources/sync-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * EventBridge / Vercel Cron: run transaction import for all connected data sources.
 * Schedule: 2:00 AM EST (07:00 UTC).
 * Supports both Stripe (legacy) and Plaid source types.
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
      { hostname },
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

  return NextResponse.json({ ok: true, results });
}
