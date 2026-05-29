import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { getProfileOnboarding } from "@/lib/profile";
import { getEffectiveTaxYear } from "@/lib/tax-year-cookie";
import type { Database } from "@/lib/types/database";
import { ProfileSettingsClient } from "./ProfileSettingsClient";

export const metadata: Metadata = {
  title: "Profile · Settings",
};

export default async function ProfileSettingsPage() {
  const authClient = await createSupabaseServerClient();
  const userId = await getCurrentUserId(authClient);
  if (!userId) redirect("/login");

  const supabase = authClient as any;

  const [{ data: profile }, { data: orgData }, { data: { user } }] = await Promise.all([
    supabase.from("profiles").select("id, first_name, last_name, name_prefix, email, phone").eq("id", userId).single(),
    supabase.from("org_settings").select("*").eq("user_id", userId).maybeSingle(),
    authClient.auth.getUser(),
  ]);

  const cookieStore = await cookies();
  const onboardingProfile = await getProfileOnboarding(supabase, userId);
  const taxYear = getEffectiveTaxYear(cookieStore, onboardingProfile);

  const { data: taxYearRow } = await supabase
    .from("tax_year_settings")
    .select("*")
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .maybeSingle();

  return (
    <ProfileSettingsClient
      initialProfile={profile}
      userEmail={user?.email ?? profile?.email ?? null}
      initialOrg={orgData as Database["public"]["Tables"]["org_settings"]["Row"] | null}
      initialTaxSettings={taxYearRow}
      taxYear={taxYear}
    />
  );
}
