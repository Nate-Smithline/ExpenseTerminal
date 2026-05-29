import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";

export interface RuleSuggestion {
  vendorNormalized: string;
  category: string;
  scheduleCLine: string;
  timesUsed: number;
  deductionPercent: number | null;
}

/**
 * GET /api/rules/suggestions
 *
 * Returns vendor clusters that appear frequently and consistently (≥5 transactions,
 * same AI-assigned category) but don't yet have a matching auto-sort rule.
 *
 * Used by the Automations page to surface one-click "Suggested Rules" the user
 * can accept without ever building a rule from scratch.
 */
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

  const supabase = authClient as any;

  // 1. Vendor patterns with a confirmed category and enough transaction volume
  const { data: patterns } = await supabase
    .from("vendor_patterns")
    .select("vendor_normalized, category, schedule_c_line, deduction_percent, times_used")
    .eq("user_id", userId)
    .not("schedule_c_line", "is", null)
    .not("category", "is", null)
    .gte("times_used", 5)
    .order("times_used", { ascending: false })
    .limit(50);

  if (!patterns || patterns.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  // 2. Existing rules — collect all match patterns to check for overlap
  const { data: rules } = await supabase
    .from("auto_sort_rules")
    .select("vendor_pattern, conditions")
    .eq("user_id", userId);

  const existingPatterns = new Set<string>(
    (rules ?? []).map((r: { vendor_pattern: string | null; conditions?: { match?: { pattern?: string } } }) => {
      const p = r.conditions?.match?.pattern ?? r.vendor_pattern ?? "";
      return p.toLowerCase().trim();
    }),
  );

  // 3. Filter to vendors with no existing rule, then return top 10
  const suggestions: RuleSuggestion[] = (patterns as Array<{
    vendor_normalized: string;
    category: string;
    schedule_c_line: string;
    deduction_percent: number | null;
    times_used: number;
  }>)
    .filter((p) => {
      const norm = (p.vendor_normalized ?? "").toLowerCase().trim();
      return norm.length > 0 && !existingPatterns.has(norm);
    })
    .slice(0, 10)
    .map((p) => ({
      vendorNormalized: p.vendor_normalized,
      category: p.category,
      scheduleCLine: p.schedule_c_line,
      timesUsed: p.times_used,
      deductionPercent: p.deduction_percent,
    }));

  return NextResponse.json({ suggestions });
}
