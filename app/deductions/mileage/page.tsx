import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BackToDeductionsLink } from "@/components/BackToDeductionsLink";
import { getCurrentUserId } from "@/lib/get-current-user";
import { MileageCalculator } from "./MileageCalculator";

/** IRS standard mileage rate for business (cents per mile). Update annually. */
const MILEAGE_RATE_BY_YEAR: Record<number, number> = {
  2024: 0.67,
  2025: 0.70,
  2026: 0.70,
};

export default async function MileagePage() {
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
  const ratePerMile = MILEAGE_RATE_BY_YEAR[currentYear] ?? MILEAGE_RATE_BY_YEAR[2026];

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h1 className="text-3xl font-bold text-mono-dark mb-2">Mileage Deduction</h1>
        <p className="text-mono-medium text-sm">
          Business mileage at the IRS standard rate (${ratePerMile.toFixed(2)}/mile for {currentYear})
        </p>
      </div>

      <MileageCalculator
        currentYear={currentYear}
        taxRate={taxRate}
        ratePerMile={ratePerMile}
      />

      <div>
        <BackToDeductionsLink>Back to Deductions</BackToDeductionsLink>
      </div>
    </div>
  );
}
