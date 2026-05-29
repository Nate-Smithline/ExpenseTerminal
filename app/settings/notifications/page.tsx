import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { NotificationsSettingsClient } from "./NotificationsSettingsClient";

export const metadata: Metadata = {
  title: "Notifications · Settings",
};

export default async function NotificationsSettingsPage() {
  const authClient = await createSupabaseServerClient();
  const userId = await getCurrentUserId(authClient);
  if (!userId) redirect("/login");

  const { data: prefs } = await (authClient as any)
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return <NotificationsSettingsClient initialPrefs={prefs ?? null} />;
}
