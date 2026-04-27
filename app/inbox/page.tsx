import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { getEffectiveTaxYear } from "@/lib/tax-year-cookie";
import { getProfileOnboarding } from "@/lib/profile";
import type { Database } from "@/lib/types/database";
import { InboxPageClient } from "./InboxPageClient";
import { requireWorkspaceIdServer } from "@/lib/workspaces/server";

type Transaction =
  Database["public"]["Tables"]["transactions"]["Row"];

export default async function InboxPage() {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) redirect("/login");

  const cookieStore = await cookies();
  const profile = await getProfileOnboarding((supabase as any), userId);
  const taxYear = getEffectiveTaxYear(cookieStore, profile);
  const db = supabase;
  const wsRes = await requireWorkspaceIdServer(db as any, userId);
  if ("error" in wsRes) redirect("/login");
  const workspaceId = wsRes.workspaceId;

  // Inbox shows pending items that are either:
  // - expense transactions already analyzed by AI, or
  // - income transactions (AI optional)
  const { data: transactions } = await (db as any)
    .from("transactions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("tax_year", taxYear)
    .eq("status", "pending")
    .or("transaction_type.eq.income,and(transaction_type.eq.expense,ai_confidence.not.is.null)")
    .order("date", { ascending: false })
    .limit(20);

  const { count: pendingCount } = await (db as any)
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("tax_year", taxYear)
    .eq("status", "pending")
    .or("transaction_type.eq.income,and(transaction_type.eq.expense,ai_confidence.not.is.null)");

  const { count: totalPendingCount } = await (db as any)
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .or("transaction_type.eq.income,and(transaction_type.eq.expense,ai_confidence.not.is.null)");

  const { count: unanalyzedCount } = await (db as any)
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("tax_year", taxYear)
    .eq("status", "pending")
    .eq("transaction_type", "expense")
    .is("ai_confidence", null);

  // Fetch user's tax rate for this year
  const { data: taxYearRow } = await (db as any)
    .from("tax_year_settings")
    .select("tax_rate")
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .single();

  const taxRate = taxYearRow ? Number(taxYearRow.tax_rate) : 0.24;

  return (
    <InboxPageClient
      initialYear={taxYear}
      initialPendingCount={pendingCount ?? 0}
      initialTotalPendingCount={totalPendingCount ?? 0}
      initialUnanalyzedCount={unanalyzedCount ?? 0}
      initialTransactions={transactions ?? []}
      userId={userId}
      workspaceId={workspaceId}
      taxRate={taxRate}
    />
  );
}

