import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { getEffectiveTaxYear } from "@/lib/tax-year-cookie";
import { getProfileOnboarding } from "@/lib/profile";
import type { Database } from "@/lib/types/database";
import { InboxPageClient } from "./InboxPageClient";

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

  // Inbox shows all pending expenses (analyzed and unanalyzed) so transactions always load
  const { data: transactions } = await (db as any)
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .eq("status", "pending")
    .eq("transaction_type", "expense")
    .order("date", { ascending: false })
    .limit(20);

  const { count: pendingCount } = await (db as any)
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .eq("status", "pending")
    .eq("transaction_type", "expense");

  const { count: unanalyzedCount } = await (db as any)
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
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
      initialUnanalyzedCount={unanalyzedCount ?? 0}
      initialTransactions={transactions ?? []}
      userId={userId}
      taxRate={taxRate}
    />
  );
}

