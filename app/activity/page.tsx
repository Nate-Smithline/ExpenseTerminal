import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { getEffectiveTaxYear } from "@/lib/tax-year-cookie";
import { getProfileOnboarding } from "@/lib/profile";
import { ActivityPageClient } from "./ActivityPageClient";

export default async function ActivityPage() {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) redirect("/login");

  const cookieStore = await cookies();
  const profile = await getProfileOnboarding((supabase as any), userId);
  const taxYear = getEffectiveTaxYear(cookieStore, profile);
  const db = supabase;

  const { data: transactions } = await (db as any)
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .order("date", { ascending: false })
    .limit(100);

  const { count: totalCount } = await (db as any)
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("tax_year", taxYear);

  return (
    <ActivityPageClient
      initialTransactions={transactions ?? []}
      initialTotalCount={totalCount ?? 0}
      initialYear={taxYear}
      userId={userId}
    />
  );
}
