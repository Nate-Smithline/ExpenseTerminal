import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { getEffectiveTaxYear } from "@/lib/tax-year-cookie";
import { getProfileOnboarding } from "@/lib/profile";
import { LogIncomeForm } from "./LogIncomeForm";
import { GettingStartedChecklist } from "./GettingStartedChecklist";
import { DEDUCTION_TYPE_CARDS, OTHER_DEDUCTIONS_CARD } from "@/lib/deduction-types";

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

  const { data: pendingCount } = await (supabase as any)
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .eq("status", "pending")
    .eq("transaction_type", "expense");

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

  const taxSavingsTotal =
    additionalDeductions?.reduce(
      (sum: number, d: { tax_savings: string }) => sum + Number(d.tax_savings),
      0
    ) ?? 0;

  const totalDeductions = fromTransactions + additionalTotal;
  const transactionSavings = fromTransactions * taxRate;
  const totalSavings = transactionSavings + taxSavingsTotal;

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-mono-dark">
            {taxYear} Tax Summary
          </h1>
          <p className="text-sm text-mono-medium mt-1">
            Overview of deductions and estimated savings
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount?.length > 0 && (
            <Link href="/inbox" className="btn-secondary text-sm">
              {pendingCount.length} pending
            </Link>
          )}
          <Link href="/reports" className="btn-primary text-sm">
            Generate Report
          </Link>
        </div>
      </div>

      {/* Getting Started */}
      <GettingStartedChecklist />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="card p-6">
          <p className="text-xs text-mono-light mb-1 uppercase tracking-wide">Revenue</p>
          <p className="text-2xl font-bold text-mono-dark tabular-nums">
            ${revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card p-6">
          <p className="text-xs text-mono-light mb-1 uppercase tracking-wide">Deductions</p>
          <p className="text-2xl font-bold text-mono-dark tabular-nums">
            ${fromTransactions.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-mono-light mt-1">From transactions</p>
        </div>
        <div className="card p-6">
          <p className="text-xs text-mono-light mb-1 uppercase tracking-wide">Additional</p>
          <p className="text-2xl font-bold text-mono-dark tabular-nums">
            ${additionalTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-mono-light mt-1">QBI, mileage, home office, etc.</p>
        </div>
        <div className="card p-6">
          <p className="text-xs text-mono-light mb-1 uppercase tracking-wide">Est. Savings</p>
          <p className="text-2xl font-bold text-accent-sage tabular-nums">
            ${totalSavings.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-mono-light mt-1">
            At {(taxRate * 100).toFixed(0)}% rate
            <Link href="/org-profile" className="text-accent-sage ml-1 hover:underline">Edit</Link>
          </p>
        </div>
      </div>

      {/* Deduction Breakdown */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-mono-dark mb-5">
          Deduction Breakdown
        </h2>

        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-mono-dark mb-3">
              From Transactions
            </p>
            <ul className="space-y-2 text-sm text-mono-medium">
              {Object.entries(byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amt]) => (
                  <li key={cat} className="flex justify-between">
                    <span>{cat}</span>
                    <span className="tabular-nums">${amt.toFixed(2)}</span>
                  </li>
                ))}
              {Object.keys(byCategory).length === 0 && (
                <li className="text-mono-light">No completed transactions yet</li>
              )}
            </ul>
          </div>

          <div className="border-t border-bg-tertiary/40 pt-5">
            <p className="text-sm font-medium text-mono-dark mb-3">
              Additional Deductions
            </p>
            <ul className="space-y-2 text-sm text-mono-medium">
              {additionalDeductions?.map((d: { type: string; amount: string; tax_savings: string }) => (
                <li key={d.type + d.amount} className="flex justify-between">
                  <span className="capitalize">{d.type.replace(/_/g, " ")}</span>
                  <span className="tabular-nums">
                    ${Number(d.amount).toFixed(2)}
                    <span className="text-mono-light ml-1">(saves ${Number(d.tax_savings).toFixed(2)})</span>
                  </span>
                </li>
              ))}
              {(!additionalDeductions || additionalDeductions.length === 0) && (
                <li className="text-mono-light">
                  None yet. Add deductions from the categories below.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Deduction categories — list view in one container */}
      <div className="card px-6 pt-6 pb-4">
        <h2 className="text-lg font-semibold text-mono-dark mb-1">Additional deductions</h2>
        <p className="text-sm text-mono-medium mb-3">
          Track QBI, mileage, home office, and more
        </p>
        <ul className="divide-y divide-bg-tertiary/40">
          {DEDUCTION_TYPE_CARDS.map((item) => {
            const isSet = additionalDeductions?.some((d: { type: string }) => d.type === item.typeKey);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-4 py-6 first:pt-0 last:pb-0 -mx-3 px-3 rounded-lg hover:bg-bg-tertiary/40 transition-all duration-300 ease-in-out group"
                >
                  <span className="material-symbols-rounded text-[22px] text-accent-sage shrink-0 group-hover:text-mono-dark transition-colors duration-300 ease-in-out">
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1 py-3">
                    <span className="font-medium text-mono-dark block">{item.label}</span>
                    <span className="text-sm text-mono-medium">{item.description}</span>
                  </div>
                  <span className="shrink-0 text-xs font-medium tabular-nums">
                    {isSet ? (
                      <span className="text-accent-sage">Set</span>
                    ) : (
                      <span className="text-mono-light">Not set</span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
          <li>
            <Link
              href={OTHER_DEDUCTIONS_CARD.href}
              className="flex items-center gap-4 py-6 first:pt-0 last:pb-0 -mx-3 px-3 rounded-lg hover:bg-bg-tertiary/40 transition-all duration-300 ease-in-out group"
            >
              <span className="material-symbols-rounded text-[22px] text-accent-sage shrink-0 group-hover:text-mono-dark transition-colors duration-300 ease-in-out">
                {OTHER_DEDUCTIONS_CARD.icon}
              </span>
              <div className="min-w-0 flex-1 py-3">
                <span className="font-medium text-mono-dark block">{OTHER_DEDUCTIONS_CARD.label}</span>
                <span className="text-sm text-mono-medium">{OTHER_DEDUCTIONS_CARD.description}</span>
              </div>
            </Link>
          </li>
        </ul>
      </div>

      {/* Log Income */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-mono-dark mb-4">
          Log Income
        </h2>
        <p className="text-sm text-mono-medium mb-4">
          Record income for this tax year (revenue, client payments, etc.).
        </p>
        <LogIncomeForm currentYear={taxYear} />
      </div>
    </div>
  );
}
