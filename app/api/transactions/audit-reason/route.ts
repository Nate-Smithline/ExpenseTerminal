import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { suggestAuditReason } from "@/lib/ai/audit-reason";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

/**
 * POST /api/transactions/audit-reason
 * Body: { id, marker, business_pct? }
 * Returns a short AI-generated business_purpose and persists it when possible.
 */
export async function POST(req: Request) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body: { id?: string; marker?: string; business_pct?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const id = body.id;
  const markerRaw = body.marker;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const marker =
    markerRaw === "Business" || markerRaw === "Partial" || markerRaw === "Personal"
      ? markerRaw
      : null;
  if (!marker) return NextResponse.json({ error: "Invalid marker" }, { status: 400 });

  const db = supabase as Supa;
  const { data: tx, error } = await db
    .from("transactions")
    .select("id,vendor,amount,category,description,business_purpose")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error || !tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (marker === "Personal") {
    await db
      .from("transactions")
      .update({ business_purpose: null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);
    return NextResponse.json({ reason: null });
  }

  const businessPct =
    typeof body.business_pct === "number" && Number.isFinite(body.business_pct)
      ? Math.round(Math.max(0, Math.min(100, body.business_pct)))
      : marker === "Business"
        ? 100
        : 50;

  const reason = await suggestAuditReason({
    vendor: tx.vendor as string,
    amount: Number(tx.amount),
    category: tx.category as string | null,
    description: tx.description as string | null,
    marker,
    businessPct,
  });

  const finalReason =
    reason ||
    (tx.business_purpose as string | null) ||
    (marker === "Business" ? "Ordinary and necessary business expense" : null);

  if (finalReason) {
    await db
      .from("transactions")
      .update({
        business_purpose: finalReason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId);
  }

  return NextResponse.json({ reason: finalReason });
}
