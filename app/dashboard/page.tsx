import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { getEffectiveTaxYear } from "@/lib/tax-year-cookie";
import { getProfileOnboarding } from "@/lib/profile";
import { GettingStartedChecklist } from "./GettingStartedChecklist";
import { DashboardHeader } from "./DashboardHeader";
import { WhatCanIDeduct } from "./WhatCanIDeduct";
import { DashboardStats } from "./DashboardStats";
import { AdditionalDeductionsList } from "./AdditionalDeductionsList";

function deductibleAmount(t: { amount: string; deduction_percent?: number | null; is_meal?: boolean; is_travel?: boolean }): number {
  const amt = Math.abs(Number(t.amount));
  const pct = t.deduction_percent ?? 100;
  return amt * (pct / 100);
}

export default async function DashboardPage() {
  const authClient = await createSupabaseServerClient();
  const userId = await getCurrentUserId(authClient);

  if (!userId) redirect("/login");

  const cookieStore = await cookies();
  const profile = await getProfileOnboarding((authClient as any), userId);
  const taxYear = getEffectiveTaxYear(cookieStore, profile);
  const supabase = authClient;

  // Fetch user's tax rate for this year
  const { data: taxYearRow } = await (supabase as any)
    .from("tax_year_settings")
    .select("tax_rate")
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .single();

  const taxRate = taxYearRow ? Number(taxYearRow.tax_rate) : 0.24;

  const { data: completedTx } = await (supabase as any)
    .from("transactions")
    .select("id, amount, category, is_meal, is_travel, deduction_percent")
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .eq("transaction_type", "expense")
    .in("status", ["completed", "auto_sorted"]);

  const { data: incomeTx } = await (supabase as any)
    .from("transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .eq("transaction_type", "income")
    .in("status", ["completed", "auto_sorted"]);

  const { data: additionalDeductions } = await (supabase as any)
    .from("deductions")
    .select("type, amount, tax_savings")
    .eq("user_id", userId)
    .eq("tax_year", taxYear);

  const { count: pendingCount } = await (supabase as any)
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .eq("status", "pending")
    .eq("transaction_type", "expense");

  const { data: pendingTx } = await (supabase as any)
    .from("transactions")
    .select("amount, deduction_percent, is_meal")
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .eq("status", "pending")
    .eq("transaction_type", "expense");

  // Setup status for Getting Started checklist
  const { count: dataSourcesCount } = await (supabase as any)
    .from("data_sources")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const { count: transactionsCount } = await (supabase as any)
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("tax_year", taxYear);

  const { data: orgSettings } = await (supabase as any)
    .from("org_settings")
    .select("id")
    .eq("user_id", userId)
    .single();

  const { data: profileRow } = await (supabase as any)
    .from("profiles")
    .select("first_name, last_name, name_prefix")
    .eq("id", userId)
    .single();

  const setupStatus = {
    data_source: (dataSourcesCount ?? 0) > 0,
    upload_csv: (transactionsCount ?? 0) > 0,
    review_inbox: (completedTx?.length ?? 0) > 0 || (pendingCount ?? 0) === 0,
    setup_deductions: (additionalDeductions?.length ?? 0) > 0,
    org_profile: !!orgSettings,
    what_can_i_deduct: false,
  };

  const pendingDeductionPotential =
    pendingTx?.reduce((sum: number, t: { amount: string; deduction_percent?: number | null; is_meal?: boolean }) => {
      const amt = Math.abs(Number(t.amount));
      const pct = t.deduction_percent ?? 100;
      return sum + (t.is_meal ? amt * 0.5 * (pct / 100) : amt * (pct / 100));
    }, 0) ?? 0;

  const fromTransactions =
    completedTx?.reduce((sum: number, t: { amount: string; deduction_percent?: number | null; is_meal?: boolean; is_travel?: boolean }) => sum + deductibleAmount(t), 0) ?? 0;

  const byCategory: Record<string, number> = {};
  completedTx?.forEach((t: { category: string | null; amount: string; deduction_percent?: number | null; is_meal?: boolean; is_travel?: boolean }) => {
    const cat = t.category ?? "Other";
    byCategory[cat] = (byCategory[cat] ?? 0) + deductibleAmount(t);
  });

  const revenue = incomeTx?.reduce((sum: number, t: { amount: string }) => sum + Math.abs(Number(t.amount)), 0) ?? 0;

  const additionalTotal =
    additionalDeductions?.reduce(
      (sum: number, d: { amount: string }) => sum + Number(d.amount),
      0
    ) ?? 0;

  const totalDeductions = fromTransactions + additionalTotal;
  const transactionSavings = fromTransactions * taxRate;
  // Other deductions (QBI, home office, mileage, etc.) are not multiplied by tax rate; add their amounts directly.
  const totalSavings = transactionSavings + additionalTotal;

  return (
    <div className="space-y-10">
      <DashboardHeader
        taxYear={taxYear}
        pendingCount={pendingCount ?? 0}
        userName={profileRow ? [profileRow.name_prefix, profileRow.first_name, profileRow.last_name].filter(Boolean).join(" ").trim() || null : null}
      />

      {/* What can I deduct? — top actions */}
      <div className="-mt-5">
        <WhatCanIDeduct />
      </div>

      {/* Getting Started */}
      <div className="-mt-4">
        <GettingStartedChecklist setupStatus={setupStatus} />
      </div>

      {/* Summary Cards */}
      <DashboardStats
        revenue={revenue}
        fromTransactions={fromTransactions}
        additionalTotal={additionalTotal}
        totalSavings={totalSavings}
        taxRate={taxRate}
        taxYear={taxYear}
      />

      {/* Additional deductions — list first */}
      <AdditionalDeductionsList additionalDeductions={additionalDeductions ?? []} />

      {/* Deduction Breakdown */}
      <div className="card overflow-hidden p-6 border-l-4 border-l-bg-tertiary">
        <h2 className="text-lg font-semibold text-mono-dark mb-1 tracking-tight">
          Deduction Breakdown
        </h2>
        <p className="text-sm text-mono-light mb-5">
          By category and by calculator
        </p>

        <div className="space-y-6">
          <div>
            <p className="text-xs font-medium text-mono-light uppercase tracking-wider mb-3">
              From Transactions
            </p>
            <ul className="space-y-2.5 text-sm text-mono-medium">
              {Object.entries(byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amt]) => (
                  <li key={cat} className="flex justify-between items-baseline gap-4 py-1 border-b border-bg-tertiary/30 last:border-0">
                    <span className="text-mono-dark">{cat}</span>
                    <span className="tabular-nums font-medium text-mono-dark shrink-0">${amt.toFixed(2)}</span>
                  </li>
                ))}
              {Object.keys(byCategory).length === 0 && (
                <li className="text-mono-light py-2">
                  No completed transactions yet.
                  {(pendingCount ?? 0) > 0 && (
                    <>
                      {" "}
                      <Link href="/inbox" className="text-accent-sage hover:underline font-medium">
                        Review {pendingCount} pending in Inbox
                      </Link>{" "}
                      to add ${pendingDeductionPotential.toLocaleString("en-US", { minimumFractionDigits: 2 })} to deductions.
                    </>
                  )}
                </li>
              )}
            </ul>
          </div>

          <div className="border-t border-bg-tertiary/40 pt-5">
            <p className="text-xs font-medium text-mono-light uppercase tracking-wider mb-3">
              Additional Deductions
            </p>
            <ul className="space-y-2.5 text-sm text-mono-medium">
              {additionalDeductions?.map((d: { type: string; amount: string; tax_savings: string }) => (
                <li key={d.type + d.amount} className="flex justify-between items-baseline gap-4 py-1 border-b border-bg-tertiary/30 last:border-0">
                  <span className="capitalize text-mono-dark">{d.type.replace(/_/g, " ")}</span>
                  <span className="tabular-nums shrink-0">
                    <span className="font-medium text-mono-dark">${Number(d.amount).toFixed(2)}</span>
                    <span className="text-mono-light ml-1.5 text-xs">saves ${Number(d.tax_savings).toFixed(2)}</span>
                  </span>
                </li>
              ))}
              {(!additionalDeductions || additionalDeductions.length === 0) && (
                <li className="text-mono-light py-2">
                  None yet. Add deductions from the section above.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
