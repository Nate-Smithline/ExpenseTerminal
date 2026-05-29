import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { ruleTransactionType } from "@/lib/vendor-prompt-key";

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

  const body = (await req.json()) as {
    vendorNormalized?: string;
    transactionType?: "income" | "expense";
  };

  const vendorNormalized = body.vendorNormalized?.trim();
  const transactionType = body.transactionType === "income" ? "income" : "expense";

  if (!vendorNormalized) {
    return NextResponse.json({ error: "vendorNormalized required" }, { status: 400 });
  }

  const conditions = {
    match: { field: "vendor_or_description" as const, pattern: vendorNormalized },
    source: null,
    transaction_type: transactionType,
  };
  const action = { type: "skip_similar_prompt" as const };

  const supabase = authClient as any;
  const { data: existingRules } = await supabase
    .from("auto_sort_rules")
    .select("id, conditions, action")
    .eq("user_id", userId)
    .eq("vendor_pattern", vendorNormalized);

  const existing = (existingRules ?? []).find(
    (row: { conditions?: unknown; action?: { type?: string } }) =>
      ruleTransactionType(row.conditions) === transactionType,
  );

  if (existing) {
    const { error: updateError } = await supabase
      .from("auto_sort_rules")
      .update({
        quick_label: "Individual",
        business_purpose: null,
        category: null,
        conditions,
        action,
      })
      .eq("id", existing.id)
      .eq("user_id", userId);
    if (updateError) {
      return NextResponse.json(
        { error: safeErrorMessage(updateError.message, "Failed to save preference") },
        { status: 500 },
      );
    }
  } else {
    const { error: insertError } = await supabase.from("auto_sort_rules").insert({
      user_id: userId,
      vendor_pattern: vendorNormalized,
      quick_label: "Individual",
      business_purpose: null,
      category: null,
      conditions,
      action,
    });
    if (insertError) {
      return NextResponse.json(
        { error: safeErrorMessage(insertError.message, "Failed to save preference") },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
