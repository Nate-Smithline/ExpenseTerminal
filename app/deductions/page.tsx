import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";

const calculators = [
  { href: "/deductions/home-office", label: "Home Office", icon: "🏠", description: "Simplified or actual expense method" },
  { href: "/deductions/retirement", label: "Retirement", icon: "🏦", description: "Solo 401k, SEP-IRA, etc." },
  { href: "/deductions/health-insurance", label: "Health Insurance", icon: "🏥", description: "Self-employed health deduction" },
  { href: "/deductions/mileage", label: "Mileage", icon: "🚗", description: "Business mileage rate" },
];

export default async function DeductionsPage() {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);

  if (!userId) redirect("/login");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-mono-dark mb-2">Deductions</h1>
        <p className="text-mono-medium text-sm">
          Calculate and track additional tax deductions
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {calculators.map((calc) => (
          <Link key={calc.href} href={calc.href}>
            <div className="card p-6 hover:shadow-md transition">
              <span className="text-2xl mb-2 block">{calc.icon}</span>
              <h2 className="text-xl font-semibold text-mono-dark mb-1">
                {calc.label}
              </h2>
              <p className="text-sm text-mono-medium">{calc.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
