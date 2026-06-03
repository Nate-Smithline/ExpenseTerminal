import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { triageDecideBodySchema } from "@/lib/validation/schemas";
import {
  getOrCreateTriageProgress,
  recordTriageDecision,
  revertTriageDecision,
} from "@/lib/triage/progress";
import { suggestAuditReason } from "@/lib/ai/audit-reason";
import { resolveTriageDeductionPercent } from "@/lib/triage/deduction-percent";
import { normalizeScheduleLineKey } from "@/lib/triage/schedule-c-display";
import { normalizeVendor } from "@/lib/vendor-matching";
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

  const parsed = triageDecideBodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "Invalid request body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const {
    id,
    marker,
    business_purpose: bodyPurpose,
    schedule_c_line,
    category,
    quick_label,
    deduction_percent,
    undo,
  } = parsed.data;
  const businessPct = resolvePct(marker, parsed.data.business_pct);

  const { data: tx, error: fetchErr } = await (supabase as any)
    .from("transactions")
    .select(
      "id, amount, transaction_type, marker, business_pct, vendor, category, description, schedule_c_line, is_meal, is_travel",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (fetchErr || !tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const transactionType =
    tx.transaction_type === "income" ? "income" : "expense";

  if (undo) {
    await (supabase as any)
      .from("transactions")
      .update({
        marker: null,
        business_pct: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId);

    const prevMarker = tx.marker as Marker;
    const prevPct = tx.business_pct ?? 50;
    const progress =
      prevMarker != null
        ? await revertTriageDecision(supabase, userId, {
            amount: Number(tx.amount),
            marker: prevMarker,
            businessPct: prevPct,
            transactionType,
          })
        : await getOrCreateTriageProgress(supabase, userId);

    return NextResponse.json({ progress, newBadges: [] });
  }

  const scheduleLine =
    schedule_c_line !== undefined
      ? normalizeScheduleLineKey(schedule_c_line)
      : normalizeScheduleLineKey(tx.schedule_c_line as string | null);

  const isMeal =
    tx.is_meal != null
      ? Boolean(tx.is_meal)
      : String(category ?? tx.category ?? "")
          .toLowerCase()
          .includes("meal") || scheduleLine === "24b";
  const isTravel = tx.is_travel != null ? Boolean(tx.is_travel) : false;

  const updatePayload: Record<string, unknown> = {
    marker,
    business_pct: businessPct,
    updated_at: new Date().toISOString(),
  };

  if (marker === "Personal") {
    updatePayload.business_purpose = null;
  } else if (transactionType === "expense") {
    const deductionPct = resolveTriageDeductionPercent({
      marker,
      businessPct,
      scheduleCLine: scheduleLine,
      deductionPercent: deduction_percent,
      isMeal,
      isTravel,
    });

    let purpose =
      bodyPurpose !== undefined && bodyPurpose !== null
        ? bodyPurpose.trim()
        : "";

    if (!purpose) {
      const generated = await suggestAuditReason({
        vendor: tx.vendor as string,
        amount: Number(tx.amount),
        category: (category ?? tx.category) as string | null,
        description: tx.description as string | null,
        marker,
        businessPct,
      });
      purpose =
        generated ||
        (marker === "Business" ? "Ordinary and necessary business expense" : "");
    }

    if (schedule_c_line !== undefined) {
      updatePayload.schedule_c_line = scheduleLine;
    }
    if (category !== undefined) {
      updatePayload.category = category;
    }
    if (quick_label !== undefined) {
      updatePayload.quick_label = quick_label;
    }
    updatePayload.business_purpose = purpose || null;
    updatePayload.deduction_percent = deductionPct;
    updatePayload.is_meal = isMeal;
    updatePayload.is_travel = isTravel;
  } else if (bodyPurpose !== undefined) {
    updatePayload.business_purpose = bodyPurpose;
  }

  const { error: updateErr } = await (supabase as any)
    .from("transactions")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", userId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  if (
    marker !== "Personal" &&
    transactionType === "expense" &&
    scheduleLine &&
    (category !== undefined || tx.category)
  ) {
    const vn = normalizeVendor(tx.vendor as string);
    const finalCategory = (category ?? tx.category) as string;
    try {
      await (supabase as any).from("vendor_patterns").upsert(
        {
          user_id: userId,
          vendor_normalized: vn,
          category: finalCategory,
          schedule_c_line: scheduleLine,
          quick_labels: quick_label ? [quick_label] : [],
          confidence: 0.98,
          deduction_percent: updatePayload.deduction_percent as number | undefined,
          times_used: 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,vendor_normalized" },
      );
    } catch {
      // vendor_patterns optional
    }
  }

  const { progress, newBadges } = await recordTriageDecision(supabase, userId, {
    amount: Number(tx.amount),
    marker,
    businessPct,
    transactionType,
  });

  return NextResponse.json({ progress, newBadges });
}
