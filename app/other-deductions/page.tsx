import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { DEDUCTION_TYPE_CARDS } from "@/lib/deduction-types";

export default async function OtherDeductionsPage() {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) redirect("/login");

  const currentYear = new Date().getFullYear();
  const { data: additionalDeductions } = await (supabase as any)
    .from("deductions")
    .select("type")
    .eq("user_id", userId)
    .eq("tax_year", currentYear);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-mono-dark mb-2">Other Deductions</h1>
        <p className="text-mono-medium text-sm">
          Calculate and track additional tax deductions
        </p>
      </div>

      <div className="card px-6 pt-3 pb-3">
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
        </ul>
      </div>
    </div>
  );
}
