import type { Metadata } from "next";
import Link from "next/link";
import { LandingHeader } from "@/components/LandingHeader";

export const metadata: Metadata = {
  title: "How it works — ExpenseTerminal",
  description:
    "Connect your accounts, let ExpenseTerminal classify transactions, see your deductions and set-aside, then export a clean package for your CPA.",
  alternates: { canonical: "https://expenseterminal.com/how-it-works" },
};

const steps = [
  {
    title: "Connect",
    body: "Link your bank and cards. The more we see, the more we find.",
  },
  {
    title: "Classify",
    body: "We sort transactions into business, personal, or needs-review with a confidence score.",
  },
  {
    title: "Save & stay ready",
    body: "See deductions and what to set aside each month. Export a clean record for your CPA.",
  },
] as const;

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />

      <main className="px-4 md:px-16 py-16 md:py-24">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs uppercase tracking-[0.2em] text-mono-medium mb-3">
            How it works
          </p>
          <h1 className="font-display text-3xl md:text-5xl text-mono-dark leading-tight mb-6">
            A year‑round tax brain, not a once‑a‑year scramble.
          </h1>
          <p className="text-mono-medium text-base md:text-lg leading-relaxed mb-10 max-w-2xl">
            ExpenseTerminal connects to your accounts, classifies transactions, and keeps a clean
            exportable record so filing is fast and calm.
          </p>

          <ol className="space-y-6">
            {steps.map((s, idx) => (
              <li
                key={s.title}
                className="border border-[#F0F1F7] bg-white px-5 md:px-6 py-6"
              >
                <div className="flex items-baseline justify-between gap-6">
                  <h2 className="font-display text-xl md:text-2xl text-mono-dark">
                    {idx + 1}. {s.title}
                  </h2>
                  <span className="text-xs text-mono-light">~2 minutes</span>
                </div>
                <p className="mt-2 text-sm md:text-base text-mono-medium leading-relaxed max-w-2xl">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center bg-[#2563EB] px-6 py-3 text-sm font-medium text-white rounded-none transition-all hover:bg-[#1D4ED8]"
            >
              Find my deductions →
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center border border-[#0D1F35]/20 bg-white text-sm font-medium text-mono-dark px-6 py-3 rounded-none hover:bg-white/80 transition-all"
            >
              Pricing
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

