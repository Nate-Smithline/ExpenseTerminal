import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";
import { OrgRulesPageClient } from "./OrgRulesPageClient";

export default async function RulesPage() {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) redirect("/login");

  const db = supabase as any;

  let orgId = await getActiveOrgId(db, userId);
  if (!orgId) {
    try {
      orgId = await ensureActiveOrgForUser(userId);
    } catch {
      orgId = null;
    }
  }

  const [{ data: rules }, { data: properties }] = await Promise.all([
    orgId
      ? db
          .from("org_transaction_rules")
          .select("*")
          .eq("org_id", orgId)
          .order("position", { ascending: true })
          .order("created_at", { ascending: true })
      : { data: [] },
    orgId
      ? db
          .from("transaction_property_definitions")
          .select("*")
          .eq("org_id", orgId)
          .order("position", { ascending: true })
      : { data: [] },
  ]);

  return <OrgRulesPageClient initialRules={rules ?? []} initialProperties={properties ?? []} />;
}
