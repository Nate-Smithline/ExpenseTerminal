import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { getProfileOnboarding } from "@/lib/profile";
import { getEffectiveTaxYear } from "@/lib/tax-year-cookie";
import { TaxFilingClient } from "./TaxFilingClient";

export default async function TaxFilingPage() {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) redirect("/login");

  const cookieStore = await cookies();
  const profile = await getProfileOnboarding(supabase as any, userId);
  const taxYear = getEffectiveTaxYear(cookieStore, profile);

  const { data: profileData } = await (supabase as any)
    .from("profiles")
    .select("display_name,first_name,last_name")
    .eq("id", userId)
    .single();

  const { data: orgSettings } = await (supabase as any)
    .from("org_settings")
    .select("filing_type,personal_filing_status,business_name,business_industry")
    .eq("user_id", userId)
    .single();

  return (
    <TaxFilingClient
      defaultYear={taxYear}
      filingType={orgSettings?.filing_type ?? null}
      personalFilingStatus={orgSettings?.personal_filing_status ?? null}
      businessName={orgSettings?.business_name ?? null}
      businessIndustry={orgSettings?.business_industry ?? null}
      userName={
        profileData?.display_name ||
        [profileData?.first_name, profileData?.last_name].filter(Boolean).join(" ") ||
        null
      }
    />
  );
}
