import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { normalizeRuleRow } from "@/lib/rules/engine";
import { RulesPageClient } from "./RulesPageClient";

export default async function RulesPage() {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) redirect("/login");

  const db = supabase as any;
  const [{ data: rules }, { data: notificationPreferences }] = await Promise.all([
    db.from("auto_sort_rules").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    db.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  const normalizedRules = (rules ?? []).map(normalizeRuleRow);

  return (
    <RulesPageClient
      initialRules={normalizedRules}
      initialNotificationPreferences={notificationPreferences ?? null}
    />
  );
}
