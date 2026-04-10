import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, expensiveOpLimit } from "@/lib/middleware/rate-limit";
import { transactionIdsBodySchema } from "@/lib/validation/schemas";
import { categorizeTransactionsForUser } from "@/lib/ai/categorize-transactions";

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
  const { success: rlOk } = await rateLimitForRequest(req, userId, expensiveOpLimit);
  if (!rlOk) {
    return new Response(JSON.stringify({ error: "Too many requests. Try again later." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }
  const supabase = authClient;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = transactionIdsBodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "transactionIds array (1-1000 UUIDs) required";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const ids = parsed.data.transactionIds;

  const { data: orgRow } = await (supabase as any)
    .from("org_settings")
    .select("business_industry")
    .eq("user_id", userId)
    .single();
  const businessIndustry: string | null = orgRow?.business_industry ?? null;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: Record<string, unknown>) {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          /* closed */
        }
      }

      await categorizeTransactionsForUser({
        supabase: supabase as any,
        userId,
        transactionIds: ids,
        businessIndustry,
        onEvent: send,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
