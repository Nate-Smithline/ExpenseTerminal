import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { normalizeRuleRow } from "@/lib/rules/engine";
import type { Database } from "@/lib/types/database";
import type { RuleSuggestion } from "@/app/api/rules/suggestions/route";
import { RulesPageClient } from "@/app/rules/RulesPageClient";

export default async function RulesPage() {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) redirect("/login");

  const db = supabase as any;

  type TaxYearSetting = Database["public"]["Tables"]["tax_year_settings"]["Row"];

  const [{ data: rules }, { data: notificationPreferences }, { data: taxSettings }] = await Promise.all([
    db
      .from("auto_sort_rules")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    db.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle(),
    db
      .from("tax_year_settings")
      .select("*")
      .eq("user_id", userId)
      .order("tax_year", { ascending: false }),
  ]);

  const [{ data: patterns }, { data: rulePatterns }] = await Promise.all([
    db
      .from("vendor_patterns")
      .select("vendor_normalized, category, schedule_c_line, deduction_percent, times_used")
      .eq("user_id", userId)
      .not("schedule_c_line", "is", null)
      .not("category", "is", null)
      .gte("times_used", 5)
      .order("times_used", { ascending: false })
      .limit(50),
    db
      .from("auto_sort_rules")
      .select("vendor_pattern, conditions")
      .eq("user_id", userId),
  ]);

  const existingPatternSet = new Set<string>(
    ((rulePatterns ?? []) as any[]).map((r) => {
      const p = r.conditions?.match?.pattern ?? r.vendor_pattern ?? "";
      return p.toLowerCase().trim();
    }),
  );

  const initialSuggestions: RuleSuggestion[] = ((patterns ?? []) as any[])
    .filter((p) => {
      const norm = (p.vendor_normalized ?? "").toLowerCase().trim();
      return norm.length > 0 && !existingPatternSet.has(norm);
    })
    .slice(0, 10)
    .map((p) => ({
      vendorNormalized: p.vendor_normalized,
      category: p.category,
      scheduleCLine: p.schedule_c_line,
      timesUsed: p.times_used,
      deductionPercent: p.deduction_percent,
    }));

  const normalizedRules = ((rules ?? []) as any[]).map(normalizeRuleRow);

  return (
    <RulesPageClient
      pageMode="rules"
      initialRules={normalizedRules}
      initialNotificationPreferences={notificationPreferences ?? null}
      initialTaxSettings={(taxSettings ?? []) as TaxYearSetting[]}
      initialSuggestions={initialSuggestions}
    />
  );
}
