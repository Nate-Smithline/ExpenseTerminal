import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { getProfileOnboarding } from "@/lib/profile";
import { getEffectiveTaxYear } from "@/lib/tax-year-cookie";
import { requireWorkspaceIdServer } from "@/lib/workspaces/server";

function formatDollars(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default async function DeductionsPage() {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login");

  const cookieStore = await cookies();
  const profile = await getProfileOnboarding((supabase as any), userId);
  const taxYear = getEffectiveTaxYear(cookieStore, profile);

  const wsRes = await requireWorkspaceIdServer(supabase as any, userId);
  if ("error" in wsRes) redirect("/login");
  const workspaceId = wsRes.workspaceId;

  const { data: calculated } = await (supabase as any)
    .from("deductions")
    .select("type,amount,metadata")
    .eq("workspace_id", workspaceId)
    .eq("tax_year", taxYear)
    .order("created_at", { ascending: false });

  const { data: suggestionTx } = await (supabase as any)
    .from("transactions")
    .select("id,date,vendor,display_name,amount,category,deduction_likelihood,deduction_suggestions,status,routed_to_inbox,inbox_resolved_at")
    .eq("workspace_id", workspaceId)
    .eq("tax_year", taxYear)
    .eq("transaction_type", "expense")
    .eq("status", "pending")
    .not("deduction_likelihood", "is", null)
    .order("date", { ascending: false })
    .limit(30);

  const confirmedTotal =
    (calculated ?? []).reduce((sum: number, d: any) => sum + Math.abs(Number(d.amount ?? 0)), 0) ?? 0;

  const needsReview = (suggestionTx ?? []).filter((t: any) => String(t.deduction_likelihood ?? "") !== "none");

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-display text-mono-dark">Deductions</h1>
        <p className="text-sm text-mono-medium">
          {formatDollars(confirmedTotal)} confirmed · {needsReview.length} to review
        </p>
      </header>

      <section className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7]">
        <div className="px-4 py-3">
          <div className="text-xs font-medium text-mono-medium uppercase tracking-wider">
            Calculated deductions
          </div>
          <p className="text-xs text-mono-light mt-1">
            Home office, mileage, health insurance, and more.
          </p>
        </div>
        <div className="px-4 py-3 space-y-2">
          {(calculated ?? []).length === 0 ? (
            <div className="rounded-2xl border border-[#eee] bg-[#fafafa] p-4">
              <p className="text-sm text-mono-dark font-medium">Add deductions in 2 minutes</p>
              <p className="text-sm text-mono-medium mt-1">
                Work from home, drive for work, or pay your own health insurance? These often add up.
              </p>
              <Link href="/other-deductions" className="text-sm font-medium text-sovereign-blue hover:underline mt-3 inline-block">
                Set up deductions
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {(calculated ?? []).map((d: any) => (
                <li key={String(d.type)} className="flex items-baseline justify-between gap-4 py-2 border-b border-[#F0F1F7] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-mono-dark capitalize">{String(d.type).replace(/_/g, " ")}</p>
                    {d.type === "home_office" && d.metadata?.home_office?.homeOfficeMethodUsed ? (
                      <p className="text-xs text-mono-light">
                        Using {String(d.metadata.home_office.homeOfficeMethodUsed)} method
                      </p>
                    ) : null}
                  </div>
                  <span className="text-sm font-medium text-mono-dark tabular-nums">
                    {formatDollars(Math.abs(Number(d.amount ?? 0)))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7]">
        <div className="px-4 py-3">
          <div className="text-xs font-medium text-mono-medium uppercase tracking-wider">
            Transaction suggestions
          </div>
          <p className="text-xs text-mono-light mt-1">
            Review AI suggestions — confirm or mark personal.
          </p>
        </div>
        <div className="px-4 py-3 space-y-3">
          {needsReview.length === 0 ? (
            <p className="text-sm text-mono-light">No suggestions yet. Connect an account or run a scan.</p>
          ) : (
            <ul className="space-y-3">
              {needsReview.map((t: any) => (
                <li key={String(t.id)} className="rounded-2xl border border-[#eee] bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-mono-dark truncate">
                        {t.display_name || t.vendor}
                      </p>
                      <p className="text-xs text-mono-light">
                        {t.date} · {t.category ?? "Uncategorized"}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-mono-dark tabular-nums">
                      {formatDollars(Math.abs(Number(t.amount ?? 0)))}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Link
                      href={`/activity?focus=${t.id}`}
                      className="btn-secondary rounded-2xl px-4 py-2 text-xs"
                    >
                      Review
                    </Link>
                    <Link href="/inbox" className="text-xs font-medium text-sovereign-blue hover:underline">
                      Inbox
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
