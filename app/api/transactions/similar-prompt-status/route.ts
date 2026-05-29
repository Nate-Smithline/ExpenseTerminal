import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { vendorPromptKey, ruleTransactionType } from "@/lib/vendor-prompt-key";

export async function GET(req: Request) {
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

  const { data: rules, error } = await (authClient as any)
    .from("auto_sort_rules")
    .select("vendor_pattern, conditions, action")
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: "Failed to load prompt status" }, { status: 500 });
  }

  const autoSortKeys: string[] = [];
  const dismissedKeys: string[] = [];

  for (const rule of rules ?? []) {
    const pattern = (rule.vendor_pattern ?? "").trim();
    if (!pattern) continue;
    const txType = ruleTransactionType(rule.conditions);
    const key = vendorPromptKey(pattern, txType);
    const actionType = (rule.action as { type?: string } | null)?.type;
    if (actionType === "skip_similar_prompt") {
      dismissedKeys.push(key);
    } else {
      autoSortKeys.push(key);
    }
  }

  return NextResponse.json({ autoSortKeys, dismissedKeys });
}
