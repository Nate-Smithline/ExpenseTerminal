import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { matchesRule, buildUpdateForAction, normalizeRuleRow } from "@/lib/rules/engine";

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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { ruleId, preview } = body ?? {};
  if (!ruleId || typeof ruleId !== "string") {
    return NextResponse.json({ error: "ruleId is required" }, { status: 400 });
  }

  const supabase = authClient as any;

  const { data: ruleRow, error: ruleError } = await supabase
    .from("auto_sort_rules")
    .select("*")
    .eq("id", ruleId)
    .eq("user_id", userId)
    .maybeSingle();

  if (ruleError) {
    return NextResponse.json(
      { error: safeErrorMessage(ruleError.message, "Failed to load rule") },
      { status: 500 },
    );
  }
  if (!ruleRow) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  const rule = normalizeRuleRow(ruleRow);
  if (!rule.enabled) {
    return NextResponse.json({ matchCount: 0, updatedCount: 0, deletedCount: 0 });
  }

  const { data: txRows, error: txError } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId);

  if (txError) {
    return NextResponse.json(
      { error: safeErrorMessage(txError.message, "Failed to load transactions") },
      { status: 500 },
    );
  }

  const matching = (txRows ?? []).filter((tx: any) => matchesRule(tx, rule.conditions));

  if (preview) {
    return NextResponse.json({ matchCount: matching.length });
  }

  let updatedCount = 0;
  let deletedCount = 0;

  const updates: { id: string; payload: Record<string, unknown> }[] = [];
  const deleteIds: string[] = [];

  for (const tx of matching) {
    const { update, shouldDelete } = buildUpdateForAction(tx, rule.action);
    if (shouldDelete) {
      deleteIds.push(tx.id);
    } else if (update && Object.keys(update).length > 0) {
      updates.push({ id: tx.id, payload: update });
    }
  }

  if (updates.length > 0) {
    const payloads = updates.map((u) => ({ id: u.id, ...u.payload }));
    const { error: updateError } = await supabase.from("transactions").upsert(payloads, { onConflict: "id" });
    if (updateError) {
      return NextResponse.json(
        { error: safeErrorMessage(updateError.message, "Failed to update transactions") },
        { status: 500 },
      );
    }
    updatedCount = updates.length;
  }

  if (deleteIds.length > 0) {
    const { error: deleteError } = await supabase.from("transactions").delete().in("id", deleteIds).eq("user_id", userId);
    if (deleteError) {
      return NextResponse.json(
        { error: safeErrorMessage(deleteError.message, "Failed to delete transactions") },
        { status: 500 },
      );
    }
    deletedCount = deleteIds.length;
  }

  return NextResponse.json({
    matchCount: matching.length,
    updatedCount,
    deletedCount,
  });
}

