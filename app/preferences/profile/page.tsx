import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { ProfileClient } from "@/app/profile/ProfileClient";

export default async function PreferencesProfilePage() {
  const authClient = await createSupabaseServerClient();
  const userId = await getCurrentUserId(authClient);

  if (!userId) redirect("/login");

  const supabase = authClient as any;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();

  const {
    data: { user },
  } = await authClient.auth.getUser();

  return (
    <ProfileClient initialProfile={profile ?? null} userEmail={user?.email ?? null} />
  );
}
