import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { normalizeRuleRow } from "@/lib/rules/engine";
import type { Database } from "@/lib/types/database";
import { RulesPageClient } from "@/app/rules/RulesPageClient";

export default async function PreferencesAutomationsPage() {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) redirect("/login");

  const db = supabase as any;

  type TaxYearSetting = Database["public"]["Tables"]["tax_year_settings"]["Row"];

  const [{ data: rules }, { data: notificationPreferences }, { data: taxSettings }] = await Promise.all<
    [
      { data: any[] | null },
      { data: any | null },
      { data: TaxYearSetting[] | null }
    ]
  >([
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

  const normalizedRules = (rules ?? []).map(normalizeRuleRow);

  return (
    <RulesPageClient
      initialRules={normalizedRules}
      initialNotificationPreferences={notificationPreferences ?? null}
      initialTaxSettings={taxSettings ?? []}
    />
  );
}

