import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { getEffectiveTaxYear } from "@/lib/tax-year-cookie";
import { getProfileOnboarding } from "@/lib/profile";
import { uuidSchema } from "@/lib/validation/schemas";
import { ActivityPageClient } from "./ActivityPageClient";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) redirect("/login");

  const cookieStore = await cookies();
  const profile = await getProfileOnboarding((supabase as any), userId);
  const taxYear = getEffectiveTaxYear(cookieStore, profile);
  const db = supabase;

  const dataSourceIdParam = searchParams?.data_source_id;
  const dataSourceIdRaw = Array.isArray(dataSourceIdParam) ? dataSourceIdParam[0] : dataSourceIdParam;
  const dataSourceId = dataSourceIdRaw && uuidSchema.safeParse(dataSourceIdRaw).success ? dataSourceIdRaw : null;

  let txQuery = (db as any)
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });
  if (dataSourceId) {
    // Deep link from Accounts page: show all time for this data source.
    txQuery = txQuery.eq("data_source_id", dataSourceId);
  } else {
    txQuery = txQuery.eq("tax_year", taxYear);
  }
  const { data: transactions } = await txQuery.limit(100);

  let countQuery = (db as any)
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if (dataSourceId) countQuery = countQuery.eq("data_source_id", dataSourceId);
  else countQuery = countQuery.eq("tax_year", taxYear);
  const { count: totalCount } = await countQuery;

  return (
    <ActivityPageClient
      initialTransactions={transactions ?? []}
      initialTotalCount={totalCount ?? 0}
      initialYear={taxYear}
      userId={userId}
    />
  );
}
