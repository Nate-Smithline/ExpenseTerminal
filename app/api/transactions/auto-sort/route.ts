import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { normalizeVendor } from "@/lib/vendor-matching";
import { safeErrorMessage } from "@/lib/api/safe-error";

export async function POST(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;
  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const supabase = authClient;

  const body = (await req.json()) as {
    vendorNormalized: string;
    quickLabel: string;
    businessPurpose: string;
    category?: string;
    schedule_c_line?: string | null;
    taxYear?: number | null;
  };

  const { vendorNormalized, quickLabel, businessPurpose, category, taxYear } =
    body;

  if (!vendorNormalized || !quickLabel) {
    return NextResponse.json(
      { error: "vendorNormalized and quickLabel required" },
      { status: 400 }
    );
  }

  // 1. Reuse existing rule or create one (so "Apply to all" again for same vendor works)
  const conditions = {
    match: { field: "vendor_or_description" as const, pattern: vendorNormalized },
    source: null,
  };
  const action = {
    type: "auto_categorize" as const,
    category: category || null,
  };
  const { data: existing } = await (supabase as any)
    .from("auto_sort_rules")
    .select("id")
    .eq("user_id", userId)
    .eq("vendor_pattern", vendorNormalized)
    .limit(1)
    .maybeSingle();

  let rule: { id: string } | null = existing;
  if (!rule) {
    const { data: inserted, error: ruleError } = await (supabase as any)
      .from("auto_sort_rules")
      .insert({
        user_id: userId,
        vendor_pattern: vendorNormalized,
        quick_label: quickLabel,
        business_purpose: businessPurpose || null,
        category: category || null,
        conditions,
        action,
      })
      .select("id")
      .single();
    if (ruleError || !inserted) {
      return NextResponse.json(
        { error: safeErrorMessage(ruleError?.message, "Failed to create rule") },
        { status: 500 }
      );
    }
    rule = inserted;
  }

  if (!rule) {
    return NextResponse.json(
      { error: "Failed to get or create auto-sort rule" },
      { status: 500 }
    );
  }

  // 2. Update all matching pending transactions (any tax year so "similar" from sync works)
  const updatePayload: Record<string, unknown> = {
    quick_label: quickLabel,
    business_purpose: businessPurpose || null,
    auto_sort_rule_id: rule.id,
    updated_at: new Date().toISOString(),
  };
  if (category != null && category !== "") {
    updatePayload.category = category;
  }
  if (body.schedule_c_line !== undefined) {
    updatePayload.schedule_c_line = body.schedule_c_line ?? null;
  }

  if (quickLabel === "Personal") {
    updatePayload.status = "personal";
    updatePayload.deduction_percent = 0;
  } else {
    updatePayload.status = "auto_sorted";
  }
  updatePayload.vendor_normalized = vendorNormalized;

  let baseQuery = (supabase as any)
    .from("transactions")
    .select("id, vendor, vendor_normalized")
    .eq("user_id", userId)
    .eq("status", "pending")
    .or(`vendor_normalized.eq.${vendorNormalized},vendor_normalized.is.null`);
  if (taxYear != null && Number.isFinite(taxYear)) {
    baseQuery = baseQuery.eq("tax_year", taxYear);
  }
  const { data: candidates, error: fetchErr } = await baseQuery;
  if (fetchErr) {
    return NextResponse.json(
      { error: safeErrorMessage(fetchErr.message, "Failed to find transactions") },
      { status: 500 }
    );
  }
  const idsToUpdate = (candidates ?? []).filter(
    (row: { vendor?: string | null; vendor_normalized?: string | null }) =>
      row.vendor_normalized === vendorNormalized ||
      (row.vendor != null && normalizeVendor(String(row.vendor)) === vendorNormalized)
  ).map((row: { id: string }) => row.id);

  if (idsToUpdate.length === 0) {
    return NextResponse.json({ ruleId: rule.id, updatedCount: 0 });
  }

  const { data: updated, error: updateError } = await (supabase as any)
    .from("transactions")
    .update(updatePayload)
    .in("id", idsToUpdate)
    .eq("user_id", userId)
    .select("id");

  if (updateError) {
    return NextResponse.json(
      { error: safeErrorMessage(updateError.message, "Failed to update transactions") },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ruleId: rule.id,
    updatedCount: updated?.length ?? 0,
  });
}
