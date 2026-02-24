import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
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
    taxYear: number;
  };

  const { vendorNormalized, quickLabel, businessPurpose, category, taxYear } =
    body;

  if (!vendorNormalized || !quickLabel) {
    return NextResponse.json(
      { error: "vendorNormalized and quickLabel required" },
      { status: 400 }
    );
  }

  // 1. Create auto-sort rule
  const { data: rule, error: ruleError } = await (supabase as any)
    .from("auto_sort_rules")
    .insert({
      user_id: userId,
      vendor_pattern: vendorNormalized,
      quick_label: quickLabel,
      business_purpose: businessPurpose || null,
      category: category || null,
    })
    .select("id")
    .single();

  if (ruleError || !rule) {
    return NextResponse.json(
      { error: safeErrorMessage(ruleError?.message, "Failed to create rule") },
      { status: 500 }
    );
  }

  // 2. Update all matching pending transactions
  const updatePayload: Record<string, unknown> = {
    quick_label: quickLabel,
    business_purpose: businessPurpose || null,
    auto_sort_rule_id: rule.id,
    updated_at: new Date().toISOString(),
  };

  if (quickLabel === "Personal") {
    updatePayload.status = "personal";
    updatePayload.deduction_percent = 0;
  } else {
    updatePayload.status = "auto_sorted";
  }

  const updateQuery = (supabase as any)
    .from("transactions")
    .update(updatePayload)
    .eq("user_id", userId)
    .eq("vendor_normalized", vendorNormalized)
    .eq("status", "pending");

  if (taxYear != null) {
    updateQuery.eq("tax_year", taxYear);
  }

  const { data: updated, error: updateError } = await updateQuery.select("id");

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
