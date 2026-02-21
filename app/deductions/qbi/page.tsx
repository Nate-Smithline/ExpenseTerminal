import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BackToDeductionsLink } from "@/components/BackToDeductionsLink";
import { getCurrentUserId } from "@/lib/get-current-user";
import { QBICalculator } from "./QBICalculator";

export default async function QBIPage() {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) redirect("/login");

  const currentYear = new Date().getFullYear();

  const { data: taxYearRow } = await (supabase as any)
    .from("tax_year_settings")
    .select("tax_rate")
    .eq("user_id", userId)
    .eq("tax_year", currentYear)
    .single();

  const taxRate = taxYearRow ? Number(taxYearRow.tax_rate) : 0.24;

  const { data: incomeTx } = await (supabase as any)
    .from("transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("tax_year", currentYear)
    .eq("transaction_type", "income")
    .in("status", ["completed", "auto_sorted"]);

  const totalIncome =
    incomeTx?.reduce((sum: number, t: { amount: string }) => sum + Math.abs(Number(t.amount)), 0) ?? 0;

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h1 className="text-3xl font-bold text-mono-dark mb-2">QBI Deduction</h1>
        <p className="text-mono-medium text-sm">
          Qualified business income deduction (Section 199A) — 20% of net business income
        </p>
      </div>

      <QBICalculator
        totalIncome={totalIncome}
        currentYear={currentYear}
        taxRate={taxRate}
      />

      <div>
        <BackToDeductionsLink>Back to Deductions</BackToDeductionsLink>
      </div>
    </div>
  );
}
