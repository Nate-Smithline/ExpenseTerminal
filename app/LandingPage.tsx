 "use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { LandingHeader } from "@/components/LandingHeader";
import { PricingPlansGrid } from "@/components/PricingPlansGrid";

const STEPS = [
  {
    number: "I",
    title: "Sign Up",
    description: "Create your account to start tracking deductions in minutes.",
  },
  {
    number: "II",
    title: "Connect Your Data",
    description: "Link your bank or upload CSVs — we keep everything organized and secure.",
  },
  {
    number: "III",
    title: "AI Categorization",
    description: "AI maps each transaction to the right category automatically.",
  },
  {
    number: "IV",
    title: "Burn Through Transactions",
    description: "Skim audit readiness and deduction savings so reviews take minutes, not hours.",
  },
  {
    number: "V",
    title: "File with Confidence",
    description: "Export tax-ready reports and file knowing you captured more deductions.",
  },
];

const FEATURES = [
  {
    icon: "account_balance",
    title: "Bank Syncing",
    description: "Connect your accounts to pull transactions in automatically and keep everything in one place.",
  },
  {
    icon: "auto_awesome",
    title: "AI-Powered Categorization",
    description: "AI analyzes each transaction and suggests the right Schedule C line item.",
  },
  {
    icon: "inbox",
    title: "Inbox-First Workflow",
    description: "Review transactions one at a time with keyboard shortcuts for rapid categorization.",
  },
  {
    icon: "receipt_long",
    title: "Tax Savings Ready",
    description: "Stay organized for tax time with reports that mirror what your accountant expects.",
  },
  {
    icon: "savings",
    title: "Deduction Calculators",
    description: "Built-in tools for QBI, mileage, home office, health insurance, retirement, and more.",
  },
  {
    icon: "lock",
    title: "Private & Secure",
    description: "Your financial data is encrypted in transit and at rest, and we never sell or share your information.",
  },
];

function MadeInAmericaSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  return (
    <>
      <section className="px-4 md:px-16 py-16" style={{ background: "#0D1F35" }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/70 mb-3">
              Made in America
            </p>
            <h2 className="font-display text-2xl md:text-3xl text-white leading-snug mb-4">
              Supporting American<br className="hidden md:block" />
              Organizations
            </h2>
            <p className="text-white/80 text-sm leading-relaxed mb-6">
              ExpenseTerminal is proudly based in New Jersey, supporting American entrepreneurs with
              modern, AI-driven tax tools.
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center justify-center border border-white px-6 py-3 text-sm font-medium text-[#0D1F35] bg-white hover:bg-white/90 transition-colors"
                style={{ borderRadius: 0 }}
              >
                Learn more
              </button>
            </div>
            <p className="mt-4 text-xs text-white/70">
              Learn more about America&rsquo;s 250th at{" "}
              <a
                href="https://america250.org"
                target="_blank"
                rel="noreferrer"
                className="font-medium underline underline-offset-4 decoration-white/70 hover:decoration-white"
              >
                America 250
              </a>
              .
            </p>
          </div>
          <div className="relative w-full h-56 md:h-80 lg:h-[22rem] overflow-hidden">
            <img
              src="/made-in-america-liberty.png"
              alt="Statue of Liberty emerging from soft fog"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {isModalOpen && (
        <div
          className="fixed inset-0 min-h-[100dvh] z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white max-w-md w-full p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4 gap-4">
              <div>
                <h3 className="font-display text-xl md:text-2xl text-mono-dark mb-1">
                  Made in America
                </h3>
                <p className="text-[11px] text-mono-medium flex items-center gap-1">
                  <span
                    className="kbd-hint kbd-on-primary"
                    style={{
                      background: "#F5F0E8",
                      color: "#000000",
                      borderRadius: 0,
                      border: "none",
                    }}
                  >
                    Esc
                  </span>
                  <span>to close</span>
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-mono-light hover:text-mono-dark transition-colors"
              >
                <span className="material-symbols-rounded text-[22px]">close</span>
              </button>
            </div>
            <div className="space-y-4 text-mono-medium leading-relaxed text-sm md:text-base">
              <p>
                ExpenseTerminal is proudly based out of <strong>New Jersey</strong>, founded by small business owners who understand the challenges of running a business.
              </p>
              <p>
                We're focused on supporting <strong>American businesses</strong> and helping them maximize their deductions while staying compliant with IRS regulations.
              </p>
              <p>
                Our platform is built with the needs of American entrepreneurs in mind, providing tools that make tax preparation simpler and more accessible for small businesses across the country.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <LandingHeader />

      {/* Hero — main AEO/SEO summary */}
      <section
        className="relative overflow-hidden min-h-[calc(100vh-64px)] flex items-center"
        style={{
          background:
            "radial-gradient(circle at 0% 0%, #E8EEF5 0, #E8EEF5 26%, transparent 52%), radial-gradient(circle at 100% 0%, #8A9BB0 0, #8A9BB0 24%, transparent 52%), radial-gradient(circle at 50% 100%, #F0F1F7 0, #F0F1F7 40%, #0D1F35 100%)",
        }}
      >
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative px-4 md:px-16 py-24 md:py-40 max-w-5xl mx-auto text-center">
          <h1 className="font-display text-4xl md:text-6xl text-white leading-tight tracking-tight mb-6">
            AI-powered expense tracking for self‑employed tax deductions
          </h1>
          <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
            ExpenseTerminal helps self-employed professionals and small businesses categorize transactions, track
            write-offs, and prepare audit-ready reports so you keep more of what you earn at tax time.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/request-demo"
              className="inline-flex items-center justify-center bg-[#2563EB] px-8 py-3.5 text-sm font-medium text-white rounded-none transition-all hover:bg-[#1D4ED8] hover:shadow-lg hover:scale-[1.02]"
            >
              Request Demo
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center border border-white/40 bg-white/5 backdrop-blur-md px-8 py-3.5 text-sm font-medium text-white rounded-none transition-all hover:bg-white/15"
            >
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="px-8 md:px-16 py-24 md:py-32" style={{ background: "#E8EEF5" }}>
        <div className="max-w-5xl mx-auto">
          <div className="mb-14 text-center md:text-left">
            <h2 className="font-display text-3xl md:text-4xl text-[#0D1F35] mb-3">
              The right features to make<br />your deductions simple
            </h2>
            <p className="text-mono-medium text-base md:text-lg max-w-xl mx-auto md:mx-0">
              The essential tools for capturing deductions, organizing records, and staying ready when it&rsquo;s time to file.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="border-t border-[#E8EEF5] pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="material-symbols-rounded text-[24px] text-[#5B82B4]">
                    {feature.icon}
                  </span>
                  <h3 className="text-base font-semibold text-mono-dark">{feature.title}</h3>
                </div>
                <p className="text-sm text-mono-medium leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser with internal link */}
      <section className="px-8 md:px-16 py-20 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 text-center md:text-left">
            <p className="text-xs uppercase tracking-[0.18em] text-mono-medium mb-2">
              Pricing
            </p>
            <h2 className="font-display text-3xl md:text-4xl text-mono-dark mb-3">
              One plan to unlock 20%+ tax savings
            </h2>
            <p className="text-mono-medium max-w-xl mx-auto md:mx-0">
              Start with a trial, then upgrade when you&rsquo;re ready for deeper automation and bank connections.
            </p>
          </div>

          <PricingPlansGrid />

          <div className="mt-8">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center bg-black text-white px-6 py-2.5 text-sm font-medium rounded-none hover:opacity-70 transition-opacity"
            >
              View full pricing
            </Link>
          </div>
        </div>
      </section>

      {/* About / Overview for answer engines */}
      <section className="px-8 md:px-16 py-24 md:py-32" style={{ background: "#F0F1F7" }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl text-mono-dark mb-6">
            Enabling Organizations with<br />Intelligence &amp; Advice
          </h2>
          <p className="text-mono-medium text-base md:text-lg leading-relaxed mb-10">
            Most self-employed professionals, freelancers, and small business owners overpay on taxes and lose track
            of expenses — because the process is confusing, tedious, and time-consuming.
            <br />
            <br />
            ExpenseTerminal uses AI-powered categorization, smart labeling, and deduction tracking to help you maximize
            write-offs, stay on top of your finances, and finally feel in control of your money.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center bg-[#2563EB] px-6 py-3 text-sm font-medium text-white rounded-none transition-all hover:bg-[#1D4ED8] hover:shadow-md"
            >
              Start Tracking for Free
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center border border-[#0D1F35]/20 bg-white text-sm font-medium text-mono-dark px-6 py-3 rounded-none hover:bg-white/80 transition-all"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* How it works / Get started */}
      <section className="px-8 md:px-16 py-16 md:py-20" style={{ background: "#8A9BB0" }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
            <div>
              <h2 className="font-display text-3xl md:text-4xl text-white/90 leading-snug mb-4">
                Start in Minutes
              </h2>
              <p className="text-[#E8EEF5] text-sm md:text-base leading-relaxed mb-8">
                Our platform is built for self-employed professionals, freelancers, and small business owners who
                want to stop leaving money on the table.
              </p>
              <div className="flex gap-3">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center bg-[#2563EB] px-6 py-3 text-sm font-medium text-white rounded-none transition-all hover:bg-[#1D4ED8] hover:shadow-lg hover:scale-[1.02]"
                >
                  Get Started
                </Link>
              </div>
            </div>

            <div className="space-y-8">
              {STEPS.map((step) => (
                <div key={step.number} className="flex gap-5">
                  <span className="font-display text-base text-white shrink-0 mt-0.5">
                    {step.number}
                  </span>
                  <div>
                    <h3 className="text-base md:text-lg font-semibold text-white mb-1.5">
                      {step.title}
                    </h3>
                    <p className="text-sm md:text-base text-white/80 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Made in America */}
      <MadeInAmericaSection />

      {/* Footer — cool stock background with black text */}
      <footer className="px-8 md:px-16 py-12 bg-[#F0F1F7]">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <Link href="/" className="flex items-center hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-black/10 rounded">
            <Image src="/xt-logo-white.png" alt="XT" width={56} height={24} className="h-6 w-auto object-contain" />
          </Link>
          <div className="flex items-center gap-6 text-sm text-black/80">
            <Link href="/login" className="hover:text-black transition-colors">Login</Link>
            <Link href="/signup" className="hover:text-black transition-colors">Sign Up</Link>
            <Link href="/pricing" className="hover:text-black transition-colors">Pricing</Link>
            <Link href="/request-demo" className="hover:text-black transition-colors">Request Demo</Link>
          </div>
          <p className="text-xs text-black/60">
            &copy; {new Date().getFullYear()} ExpenseTerminal
          </p>
        </div>
      </footer>
    </div>
  );
}
