import type { Metadata } from "next";
import Link from "next/link";
import { LandingHeader } from "@/components/LandingHeader";

export const metadata: Metadata = {
  title: "About — ExpenseTerminal",
  description:
    "ExpenseTerminal is built by two builders with side hustles—your year-round tax assistant that finds deductions and keeps you ready for your CPA.",
  alternates: { canonical: "https://expenseterminal.com/about" },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />

      <main className="px-4 md:px-16 py-16 md:py-24">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs uppercase tracking-[0.2em] text-mono-medium mb-3">
            About
          </p>
          <h1 className="font-display text-3xl md:text-5xl text-mono-dark leading-tight mb-6">
            Built by two builders with side hustles.
          </h1>
          <p className="text-mono-medium text-base md:text-lg leading-relaxed">
            We got tired of the same yearly cycle: digging through transactions, guessing what
            qualifies, and hoping we didn’t miss deductions. ExpenseTerminal is the tool we wanted
            all year — connect your accounts, let the app sort transactions with confidence, and
            hand a clean record to your accountant when it’s time to file.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center bg-[#2563EB] px-6 py-3 text-sm font-medium text-white rounded-none transition-all hover:bg-[#1D4ED8]"
            >
              Log in
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center justify-center border border-[#0D1F35]/20 bg-white text-sm font-medium text-mono-dark px-6 py-3 rounded-none hover:bg-white/80 transition-all"
            >
              How it works
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

