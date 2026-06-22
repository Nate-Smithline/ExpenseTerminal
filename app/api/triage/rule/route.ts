import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { triageRuleBodySchema } from "@/lib/validation/schemas";
import { applyMarkerRuleForVendor } from "@/lib/triage/marker-rules";
import { recordTriageRuleCreated } from "@/lib/triage/progress";
import type { Marker } from "@/components/MarkerPill";

function resolvePct(marker: Marker, businessPct?: number): number {
  if (marker === "Personal") return 0;
  if (marker === "Business") return 100;
  return Math.min(100, Math.max(1, businessPct ?? 50));
}

export async function POST(req: Request) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;

  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = triageRuleBodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "Invalid request body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const {
    vendorNormalized,
    marker,
    transactionType = "expense",
    business_purpose,
  } = parsed.data;
  const businessPct = resolvePct(marker, parsed.data.business_pct);

  const result = await applyMarkerRuleForVendor(supabase, userId, {
    vendorNormalized: vendorNormalized.toLowerCase().trim(),
    marker,
    businessPct,
    transactionType,
    businessPurpose: business_purpose ?? null,
  });

  const { progress, newBadges } = await recordTriageRuleCreated(
    supabase,
    userId,
    result.impact,
  );

  return NextResponse.json({
    ruleId: result.ruleId,
    updatedCount: result.updatedCount,
    impact: result.impact,
    progress,
    newBadges,
  });
}

export async function DELETE(req: Request) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;

  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const ruleId = new URL(req.url).searchParams.get("id")?.trim();
  if (!ruleId) {
    return NextResponse.json({ error: "Rule id is required" }, { status: 400 });
  }

  const { error } = await (supabase as any)
    .from("auto_sort_rules")
    .delete()
    .eq("id", ruleId)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
