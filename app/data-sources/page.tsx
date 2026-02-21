import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { DataSourcesClient } from "./DataSourcesClient";

export type DataSourceStats = {
  transactionCount: number;
  totalIncome: number;
  totalExpenses: number;
  pctReviewed: number;
  totalSavings: number;
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

  const sourceIds = (sources ?? []).map((s: { id: string }) => s.id);
  const statsBySource: Record<string, DataSourceStats> = {};

  if (sourceIds.length > 0) {
    const { data: txRows } = await (supabase as any)
      .from("transactions")
      .select("data_source_id,amount,transaction_type,status,deduction_percent,is_meal")
      .eq("user_id", userId)
      .in("data_source_id", sourceIds);

    for (const id of sourceIds) {
      statsBySource[id] = {
        transactionCount: 0,
        totalIncome: 0,
        totalExpenses: 0,
        pctReviewed: 0,
        totalSavings: 0,
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
      const reviewed = t.status === "completed" || t.status === "auto_sorted";
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

  return (
    <DataSourcesClient
      initialSources={sources ?? []}
      initialStats={statsBySource}
    />
  );
}
