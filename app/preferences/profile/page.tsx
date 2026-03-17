import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { ProfileClient } from "@/app/profile/ProfileClient";
import type { Database } from "@/lib/types/database";

export default async function PreferencesProfilePage() {
  const authClient = await createSupabaseServerClient();
  const userId = await getCurrentUserId(authClient);

  if (!userId) redirect("/login");

  const supabase = authClient as any;

              const { data: profile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .single();

  type OrgSettings = Database["public"]["Tables"]["org_settings"]["Row"];
  const { data: orgData } = await supabase
    .from("org_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: { user } } = await authClient.auth.getUser();

  return (
    <ProfileClient
      initialProfile={profile ?? null}
      userEmail={user?.email ?? null}
      initialOrg={orgData as OrgSettings | null}
    />
  );
}

