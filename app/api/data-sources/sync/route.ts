import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { getStripeMode } from "@/lib/stripe";
import { runSyncForDataSource } from "@/lib/data-sources/sync-runner";

export async function POST(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const userId = auth.userId;
  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { data_source_id?: string; start_date?: string; end_date?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const dataSourceId = body.data_source_id;
  if (!dataSourceId || typeof dataSourceId !== "string") {
    return new Response(JSON.stringify({ error: "data_source_id is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const startDate = typeof body.start_date === "string" && body.start_date.trim() ? body.start_date.trim() : undefined;
  const endDate = typeof body.end_date === "string" && body.end_date.trim() ? body.end_date.trim() : undefined;

  const supabase = authClient;
  const { data: row, error: fetchError } = await (supabase as any)
    .from("data_sources")
    .select("id,user_id,source_type")
    .eq("id", dataSourceId)
    .eq("user_id", userId)
    .single();

  if (fetchError || !row) {
    return new Response(JSON.stringify({ error: "Data source not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const xfHost = req.headers.get("x-forwarded-host");
  const host = req.headers.get("host");
  const hostname = (xfHost ?? host ?? "").split(",")[0]?.trim()?.split(":")[0] || url.hostname;
  const syncOptions = row.source_type === "stripe"
    ? { stripeMode: getStripeMode(hostname), startDate, endDate, hostname }
    : { hostname };
  const result = await runSyncForDataSource(supabase, userId, dataSourceId, row.source_type, syncOptions);

  if (result.success) {
    return new Response(
      JSON.stringify({
        ok: true,
        message: result.message,
        ...(result.diagnostics ? { diagnostics: result.diagnostics } : {}),
        ...(result.plaidDiagnostics ? { plaidDiagnostics: result.plaidDiagnostics } : {}),
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({
      error: result.error ?? "Sync failed",
      code: result.code,
    }),
    {
      status: result.status ?? 500,
      headers: { "Content-Type": "application/json" },
    }
  );
}
