import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { getActiveOrgId } from "@/lib/active-org";
import { DataSourcesClient } from "./DataSourcesClient";

export type DataSourceStats = {
  transactionCount: number;
  totalIncome: number;
  totalExpenses: number;
  /** Earliest `transactions.date` (YYYY-MM-DD) for the viewed tax year, or null if none */
  earliestTransactionDateInTaxYear: string | null;
};

export default async function DataSourcesPage() {
  const authClient = await createSupabaseServerClient();
  const userId = await getCurrentUserId(authClient);

  if (!userId) redirect("/login");

  const supabase = authClient;

  const orgId = await getActiveOrgId(supabase as any, userId);
  if (orgId) {
    const { data: org, error: orgVisErr } = await (supabase as any)
      .from("orgs")
      .select("accounts_page_visibility")
      .eq("id", orgId)
      .maybeSingle();
    if (!orgVisErr && org?.accounts_page_visibility === "restricted") {
      const { data: mem } = await (supabase as any)
        .from("org_memberships")
        .select("role")
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .maybeSingle();
      if ((mem?.role as string | undefined) !== "owner") {
        redirect("/dashboard");
      }
    }
  }

  const { data: sources } = await (supabase as any)
    .from("data_sources")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const calendarYear = new Date().getFullYear();

  const sourceIds = (sources ?? []).map((s: { id: string }) => s.id);
  const statsBySource: Record<string, DataSourceStats> = {};

  if (sourceIds.length > 0) {
    const { data: txRows } = await (supabase as any)
      .from("transactions")
      .select("data_source_id,amount,transaction_type")
      .eq("user_id", userId)
      .in("data_source_id", sourceIds);

    /** Earliest transaction date per source for the current calendar year (`tax_year` on rows). */
    const earliestBySource: Record<string, string> = {};
    await Promise.all(
      sourceIds.map(async (id: string) => {
        const { data } = await (supabase as any)
          .from("transactions")
          .select("date")
          .eq("user_id", userId)
          .eq("data_source_id", id)
          .eq("tax_year", calendarYear)
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
        earliestTransactionDateInTaxYear: earliestBySource[id] ?? null,
      };
    }

    for (const t of txRows ?? []) {
      const sid = t.data_source_id as string;
      if (!sid || !statsBySource[sid]) continue;
      const st = statsBySource[sid];
      st.transactionCount += 1;
      const amt = Math.abs(Number(t.amount));
      if (t.transaction_type === "income") {
        st.totalIncome += amt;
      } else {
        st.totalExpenses += amt;
      }
    }
  }

  return (
    <DataSourcesClient
      initialSources={sources ?? []}
      initialStats={statsBySource}
    />
  );
}
