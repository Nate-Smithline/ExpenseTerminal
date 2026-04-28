import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";

export const metadata: Metadata = {
  title: "Tax calendar — ExpenseTerminal",
  description: "Quarterly and annual tax deadlines, in one calm view.",
};

const deadlines = [
  { label: "Q1 estimated payment due", date: "Apr 15" },
  { label: "Q2 estimated payment due", date: "Jun 15" },
  { label: "Q3 estimated payment due", date: "Sep 15" },
  { label: "Q4 estimated payment due", date: "Jan 15" },
  { label: "Annual filing deadline", date: "Apr 15" },
] as const;

export default async function TaxCalendarPage() {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-mono-medium mb-2">
          Tax calendar
        </p>
        <h1 className="font-display text-2xl md:text-3xl text-mono-dark">
          Deadlines, without the stress.
        </h1>
        <p className="mt-2 text-sm text-mono-medium max-w-2xl">
          This is a starter view. Next we’ll attach amounts owed + payment instructions.
        </p>
      </div>

      <section className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7]">
        {deadlines.map((d) => (
          <div key={d.label} className="px-4 md:px-5 py-4 flex items-baseline justify-between gap-6">
            <p className="text-sm text-mono-dark">{d.label}</p>
            <p className="text-sm text-mono-medium tabular-nums">{d.date}</p>
          </div>
        ))}
      </section>

      <div className="flex gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center border border-[#0D1F35]/20 bg-white text-sm font-medium text-mono-dark px-5 py-2.5 rounded-none hover:bg-white/80 transition-all"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

