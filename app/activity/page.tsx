import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { getEffectiveTaxYear } from "@/lib/tax-year-cookie";
import { getProfileOnboarding } from "@/lib/profile";
import { uuidSchema } from "@/lib/validation/schemas";
import { getActiveOrgId } from "@/lib/active-org";
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

  // Scope to active org's data sources
  const activeOrgId = await getActiveOrgId(db as any, userId);
  let orgDataSourceIds: string[] | null = null;
  if (activeOrgId) {
    const { data: dsRows } = await (db as any)
      .from("data_sources")
      .select("id")
      .eq("org_id", activeOrgId);
    orgDataSourceIds = (dsRows ?? []).map((r: { id: string }) => r.id).filter(Boolean);
  }

  let txQuery = (db as any)
    .from("transactions")
    .select("*")
    .order("date", { ascending: false });
  if (orgDataSourceIds != null && orgDataSourceIds.length > 0) {
    txQuery = txQuery.in("data_source_id", orgDataSourceIds);
  } else {
    txQuery = txQuery.eq("user_id", userId);
  }
  if (dataSourceId) {
    txQuery = txQuery.eq("data_source_id", dataSourceId);
  }
  const { data: transactions } = await txQuery.limit(100);

  let countQuery = (db as any)
    .from("transactions")
    .select("*", { count: "exact", head: true });
  if (orgDataSourceIds != null && orgDataSourceIds.length > 0) {
    countQuery = countQuery.in("data_source_id", orgDataSourceIds);
  } else {
    countQuery = countQuery.eq("user_id", userId);
  }
  if (dataSourceId) countQuery = countQuery.eq("data_source_id", dataSourceId);
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
