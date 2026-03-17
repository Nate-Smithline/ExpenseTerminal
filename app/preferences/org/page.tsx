import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { OrgProfileClient } from "@/app/org-profile/OrgProfileClient";

export default async function PreferencesOrgPage() {
  const authClient = await createSupabaseServerClient();
  const userId = await getCurrentUserId(authClient);

  if (!userId) redirect("/login");

  const supabase = authClient;

  const { data: orgData } = await (supabase as any)
    .from("org_settings")
    .select("*")
    .eq("user_id", userId)
    .single();

  const { data: taxSettings } = await (supabase as any)
    .from("tax_year_settings")
    .select("*")
    .eq("user_id", userId)
    .order("tax_year", { ascending: false });

  const {
    data: { user },
  } = await authClient.auth.getUser();

  return (
    <OrgProfileClient
      initialOrg={orgData ?? null}
      initialTaxSettings={taxSettings ?? []}
      userEmail={user?.email ?? null}
    />
  );
}

