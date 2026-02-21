import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { getEffectiveTaxYear } from "@/lib/tax-year-cookie";
import { getProfileOnboarding } from "@/lib/profile";
import { ReportExportActions } from "./ReportExportActions";

export default async function ReportsPage() {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) redirect("/login");

  const cookieStore = await cookies();
  const profile = await getProfileOnboarding((supabase as any), userId);
  const taxYear = getEffectiveTaxYear(cookieStore, profile);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-mono-dark mb-2">Reports</h1>
        <p className="text-mono-medium text-sm">
          Generate and export your deduction summary for the tax year
        </p>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-mono-dark mb-2">
          Export Options
        </h2>
        <p className="text-sm text-mono-medium mb-6">
          Download your completed transactions and additional deductions as CSV
          (for Excel or accounting software) or PDF (for CPA review).
        </p>
        <ReportExportActions defaultYear={taxYear} />
      </div>
    </div>
  );
}
