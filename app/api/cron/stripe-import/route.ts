import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { runSyncForDataSource } from "@/lib/data-sources/sync-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * EventBridge / Vercel Cron: run Stripe import for all Stripe data sources.
 * Schedule: 2:00 AM EST.
 * For each stripe source: pull new transactions (Pro: full window, Free: 30 days), insert, run rules, update sync metadata.
 * Secured by CRON_SECRET: set in Vercel (and .env.local for local testing). Caller must send Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured. Set CRON_SECRET in Vercel Environment Variables (and .env.local for local runs)." },
      { status: 503 }
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const { data: stripeSources } = await (supabase as any)
    .from("data_sources")
    .select("id, user_id, source_type")
    .eq("source_type", "stripe");

  const results: { id: string; success: boolean; error?: string }[] = [];
  for (const row of stripeSources ?? []) {
    const result = await runSyncForDataSource(
      supabase,
      row.user_id,
      row.id,
      row.source_type
    );
    results.push({
      id: row.id,
      success: result.success,
      error: result.error,
      ...(result.diagnostics ? { diagnostics: result.diagnostics } : {}),
    });
  }

  return NextResponse.json({ ok: true, results });
}
