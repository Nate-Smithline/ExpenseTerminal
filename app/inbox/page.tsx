import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";
import { InboxPageClient } from "./InboxPageClient";

type Transaction =
  Database["public"]["Tables"]["transactions"]["Row"];

export default async function InboxPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const currentYear = new Date().getFullYear();

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("tax_year", currentYear)
    .eq("status", "pending")
    .order("date", { ascending: false })
    .limit(20);

  const { count: pendingCount } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("tax_year", currentYear)
    .eq("status", "pending");

  return (
    <InboxPageClient
      initialYear={currentYear}
      initialPendingCount={pendingCount ?? 0}
      initialTransactions={transactions ?? []}
      userId={user.id}
    />
  );
}

