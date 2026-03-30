import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { runSyncForDataSource } from "@/lib/data-sources/sync-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function getRequestHostname(req: Request): string {
  const xfHost = req.headers.get("x-forwarded-host");
  const host = req.headers.get("host");
  const raw = (xfHost ?? host ?? "").split(",")[0]?.trim();
  if (raw) return raw.split(":")[0] ?? raw;
  return new URL(req.url).hostname;
}

/**
 * Plaid webhook receiver.
 * Handles TRANSACTIONS webhooks (SYNC_UPDATES_AVAILABLE, HISTORICAL_UPDATE)
 * and ITEM webhooks (ERROR) to keep data sources up to date.
 *
 * For production, add Plaid webhook verification:
 * https://plaid.com/docs/api/webhooks/webhook-verification/
 */
export async function POST(req: Request) {
  let body: {
    webhook_type?: string;
    webhook_code?: string;
    item_id?: string;
    error?: { error_code?: string; error_message?: string };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { webhook_type, webhook_code, item_id } = body;
  if (!item_id) {
    return NextResponse.json({ error: "Missing item_id" }, { status: 400 });
  }

  console.warn("[plaid-webhook]", { webhook_type, webhook_code, item_id });

  const supabase = createSupabaseServiceClient();

  // Look up data sources for this item
  const { data: sources } = await (supabase as any)
    .from("data_sources")
    .select("id, user_id, source_type")
    .eq("plaid_item_id", item_id)
    .eq("source_type", "plaid");

  if (!sources || sources.length === 0) {
    console.warn("[plaid-webhook] No data sources found for item", item_id);
    return NextResponse.json({ received: true, matched: 0 });
  }

  const hostname = getRequestHostname(req);

  if (webhook_type === "TRANSACTIONS") {
    if (webhook_code === "SYNC_UPDATES_AVAILABLE" || webhook_code === "HISTORICAL_UPDATE") {
      const results: { id: string; success: boolean; error?: string }[] = [];
      for (const row of sources) {
        const result = await runSyncForDataSource(
          supabase,
          row.user_id,
          row.id,
          row.source_type,
          { hostname },
        );
        results.push({ id: row.id, success: result.success, error: result.error });
      }
      return NextResponse.json({ received: true, webhook_code, results });
    }
  }

  if (webhook_type === "ITEM") {
    if (webhook_code === "ERROR") {
      const errorMessage = body.error?.error_message ?? "Plaid reported an error with this connection.";
      for (const row of sources) {
        await (supabase as any)
          .from("data_sources")
          .update({
            last_failed_sync_at: new Date().toISOString(),
            last_error_summary: errorMessage.slice(0, 500),
          })
          .eq("id", row.id)
          .eq("user_id", row.user_id);
      }
      return NextResponse.json({ received: true, webhook_code, error: errorMessage });
    }
  }

  return NextResponse.json({ received: true, webhook_type, webhook_code });
}
