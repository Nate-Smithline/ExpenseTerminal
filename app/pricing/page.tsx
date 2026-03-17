import { Metadata } from "next";
import { PricingPlansGrid } from "@/components/PricingPlansGrid";
import { FaqJsonLd } from "@/components/SeoJsonLd";

export const metadata: Metadata = {
  title: "ExpenseTerminal pricing — AI expense tracking for self‑employed tax deductions",
  description:
    "Compare ExpenseTerminal Trial and Pro plans for AI-powered expense tracking and tax deductions for self-employed professionals and small businesses.",
  alternates: {
    canonical: "https://expenseterminal.com/pricing",
  },
};

const FEATURE_SECTIONS = [
  {
    label: "AI & automation",
    rows: [
      {
        feature: "AI-reviewed CSV transactions",
        trial: "Up to 200 per year",
        pro: "Unlimited",
      },
      {
        feature: "AI-powered categorization & smart labeling",
        trial: "Included",
        pro: "Included",
      },
      {
        feature: "Deduction tracking & audit-friendly notes",
        trial: "Included",
        pro: "Included",
      },
    ],
  },
  {
    label: "Data & connections",
    rows: [
      {
        feature: "CSV / Excel uploads",
        trial: "Included",
        pro: "Included",
      },
      {
        feature: "Bank connections",
        trial: "—",
        pro: "Included",
      },
    ],
  },
  {
    label: "Support & governance",
    rows: [
      {
        feature: "Email support",
        trial: "Standard",
        pro: "Priority",
      },
      {
        feature: "Best-practice tax workflows",
        trial: "Core",
        pro: "Core + upcoming advanced automations",
      },
    ],
  },
] as const;

export default function PricingPage() {
  return (
    <div className="px-4 md:px-8 py-10 md:py-14">
      <FaqJsonLd
        items={[
          {
            question: "How much does ExpenseTerminal cost?",
            answer:
              "ExpenseTerminal offers a Trial plan so you can start tracking deductions with limited volume, and a Pro plan for ongoing AI-powered expense tracking and deeper automations. Pricing is designed for self-employed professionals and small businesses that want to maximize tax deductions.",
          },
          {
            question: "What is the difference between the Trial and Pro plans?",
            answer:
              "The Trial plan lets you upload and review a limited number of CSV transactions so you can see how ExpenseTerminal fits your workflow. The Pro plan unlocks unlimited AI-reviewed transactions, bank connections, advanced deduction workflows, and higher-touch support.",
          },
        ]}
      />
      <div className="max-w-5xl mx-auto">
        <h1 className="font-display text-3xl md:text-4xl text-[#0D1F35] mb-3">
          ExpenseTerminal pricing for self‑employed tax deductions
        </h1>
        <p className="text-sm text-mono-medium mb-8 max-w-xl">
          Start on the Trial plan, then move into Pro when you&apos;re ready to run all your
          deductions and year-round expense tracking through ExpenseTerminal.
        </p>
        <PricingPlansGrid />

        <section className="mt-12 rounded-none border border-[#E8EEF5] bg-[#F0F1F7] px-5 md:px-6 py-6 md:py-7">
          <h2 className="font-display text-xl md:text-2xl text-[#0D1F35] mb-2">
            Trial vs Pro, side by side
          </h2>
          <p className="text-xs md:text-sm text-mono-medium mb-5 max-w-2xl">
            A simple comparison so you can see exactly what you unlock when you move beyond the Trial plan.
          </p>

          <div className="text-xs md:text-sm">
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 pb-3 border-b border-[#E8EEF5] text-mono-medium font-medium">
              <span>Feature</span>
              <span className="text-center">Trial</span>
              <span className="text-center">Pro</span>
            </div>

            <div className="divide-y divide-[#E8EEF5]">
              {FEATURE_SECTIONS.map((section) => (
                <div key={section.label} className="py-3 md:py-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-mono-medium mb-2">
                    {section.label}
                  </p>
                  <div className="space-y-2">
                    {section.rows.map((row) => (
                      <div
                        key={row.feature}
                        className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 items-start"
                      >
                        <p className="text-mono-dark">{row.feature}</p>
                        <p className="text-center text-mono-medium">
                          {row.trial === "Included" ? "✓" : row.trial}
                        </p>
                        <p className="text-center text-mono-medium">
                          {row.pro === "Included" ? "✓" : row.pro}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
