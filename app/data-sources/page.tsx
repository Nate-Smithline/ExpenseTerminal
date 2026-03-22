import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { getUserPlan } from "@/lib/billing/get-user-plan";
import { getStripeModeForHostname, getStripePublishableKey } from "@/lib/stripe";
import { getEffectiveTaxYear } from "@/lib/tax-year-cookie";
import { getProfileOnboarding } from "@/lib/profile";
import { DataSourcesClient } from "./DataSourcesClient";

export type DataSourceStats = {
  transactionCount: number;
  totalIncome: number;
  totalExpenses: number;
  pctReviewed: number;
  totalSavings: number;
  /** Earliest `transactions.date` (YYYY-MM-DD) for the viewed tax year, or null if none */
  earliestTransactionDateInTaxYear: string | null;
};

export default async function DataSourcesPage() {
  const authClient = await createSupabaseServerClient();
  const userId = await getCurrentUserId(authClient);

  if (!userId) redirect("/login");

  const supabase = authClient;

  const { data: sources } = await (supabase as any)
    .from("data_sources")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const cookieStore = await cookies();
  const profile = await getProfileOnboarding(supabase as any, userId);
  const taxYear = getEffectiveTaxYear(cookieStore, profile);

  const sourceIds = (sources ?? []).map((s: { id: string }) => s.id);
  const statsBySource: Record<string, DataSourceStats> = {};

  if (sourceIds.length > 0) {
    const { data: txRows } = await (supabase as any)
      .from("transactions")
      .select("data_source_id,amount,transaction_type,status,deduction_percent,is_meal")
      .eq("user_id", userId)
      .in("data_source_id", sourceIds);

    /** Earliest transaction date per source for viewed tax year (indexed query, limit 1 — avoids row caps on bulk MIN). */
    const earliestBySource: Record<string, string> = {};
    await Promise.all(
      sourceIds.map(async (id: string) => {
        const { data } = await (supabase as any)
          .from("transactions")
          .select("date")
          .eq("user_id", userId)
          .eq("data_source_id", id)
          .eq("tax_year", taxYear)
          .order("date", { ascending: true })
          .limit(1)
          .maybeSingle();
        const d = data?.date as string | undefined;
        if (d) earliestBySource[id] = d;
      }),
    );

    for (const id of sourceIds) {
      statsBySource[id] = {
        transactionCount: 0,
        totalIncome: 0,
        totalExpenses: 0,
        pctReviewed: 0,
        totalSavings: 0,
        earliestTransactionDateInTaxYear: earliestBySource[id] ?? null,
      };
    }

    const TAX_RATE = 0.24;
    const reviewedCount: Record<string, number> = {};
    for (const id of sourceIds) reviewedCount[id] = 0;

    for (const t of txRows ?? []) {
      const sid = t.data_source_id as string;
      if (!sid || !statsBySource[sid]) continue;
      const st = statsBySource[sid];
      st.transactionCount += 1;
      const reviewed = t.status === "completed" || t.status === "auto_sorted" || t.status === "personal";
      if (reviewed) reviewedCount[sid] += 1;
      const amt = Math.abs(Number(t.amount));
      if (t.transaction_type === "income") {
        st.totalIncome += amt;
      } else {
        st.totalExpenses += amt;
        if (reviewed) {
          const pct = (t.deduction_percent ?? 100) / 100;
          const deductible = t.is_meal ? amt * 0.5 * pct : amt * pct;
          st.totalSavings += deductible * TAX_RATE;
        }
      }
    }

    for (const id of sourceIds) {
      const st = statsBySource[id];
      st.pctReviewed =
        st.transactionCount > 0
          ? Math.round((reviewedCount[id] / st.transactionCount) * 100)
          : 0;
    }
  }

  const plan = await getUserPlan(supabase, userId);
  const isFree = plan === "free";
  const stripeSourceCount = (sources ?? []).filter((s: { source_type?: string }) => s.source_type === "stripe").length;

  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const stripeMode = getStripeModeForHostname(host);
  const stripePublishableKey = getStripePublishableKey(stripeMode);

  return (
    <DataSourcesClient
      initialSources={sources ?? []}
      initialStats={statsBySource}
      taxYear={taxYear}
      isFree={isFree}
      stripeSourceCount={stripeSourceCount}
      stripePublishableKey={stripePublishableKey}
    />
  );
}
