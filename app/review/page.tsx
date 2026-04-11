import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { getEffectiveTaxYear } from "@/lib/tax-year-cookie";
import { getProfileOnboarding } from "@/lib/profile";
import { getActiveOrgId } from "@/lib/active-org";
import type { Database } from "@/lib/types/database";
import { ReviewPageClient } from "./ReviewPageClient";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

export default async function ReviewPage() {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) redirect("/login");

  const cookieStore = await cookies();
  const profile = await getProfileOnboarding((supabase as any), userId);
  const taxYear = getEffectiveTaxYear(cookieStore, profile);
  const db = supabase;

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

  function scopeToOrg(q: any): any {
    if (orgDataSourceIds != null && orgDataSourceIds.length > 0) {
      return q.in("data_source_id", orgDataSourceIds);
    }
    return q.eq("user_id", userId);
  }

  const { data: transactions } = await scopeToOrg((db as any)
    .from("transactions")
    .select("*"))
    .eq("tax_year", taxYear)
    .eq("status", "pending")
    .or("transaction_type.eq.income,and(transaction_type.eq.expense,ai_confidence.not.is.null)")
    .order("date", { ascending: false })
    .limit(20);

  const { count: pendingCount } = await scopeToOrg((db as any)
    .from("transactions")
    .select("*", { count: "exact", head: true }))
    .eq("tax_year", taxYear)
    .eq("status", "pending")
    .or("transaction_type.eq.income,and(transaction_type.eq.expense,ai_confidence.not.is.null)");

  const { count: totalPendingCount } = await scopeToOrg((db as any)
    .from("transactions")
    .select("*", { count: "exact", head: true }))
    .eq("status", "pending")
    .or("transaction_type.eq.income,and(transaction_type.eq.expense,ai_confidence.not.is.null)");

  const { count: unanalyzedCount } = await scopeToOrg((db as any)
    .from("transactions")
    .select("*", { count: "exact", head: true }))
    .eq("tax_year", taxYear)
    .eq("status", "pending")
    .eq("transaction_type", "expense")
    .is("ai_confidence", null);

  const { data: taxYearRow } = await (db as any)
    .from("tax_year_settings")
    .select("tax_rate")
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .single();

  const taxRate = taxYearRow ? Number(taxYearRow.tax_rate) : 0.24;

  return (
    <ReviewPageClient
      initialYear={taxYear}
      initialPendingCount={pendingCount ?? 0}
      initialTotalPendingCount={totalPendingCount ?? 0}
      initialUnanalyzedCount={unanalyzedCount ?? 0}
      initialTransactions={transactions ?? []}
      userId={userId}
      taxRate={taxRate}
    />
  );
}
