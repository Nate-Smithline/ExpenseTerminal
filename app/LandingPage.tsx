"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

const STEPS = [
  {
    number: "I",
    title: "Sign Up",
    description: "Create a free account to start tracking your business deductions in minutes. Perfect for ABA professionals and small business owners.",
  },
  {
    number: "II",
    title: "Connect Your Data",
    description: "Upload CSV or Excel files from your bank, credit card, or accounting tool.",
  },
  {
    number: "III",
    title: "AI Categorization",
    description: "Our AI reviews each transaction and maps it to Schedule C categories automatically.",
  },
  {
    number: "IV",
    title: "File with Confidence",
    description: "Generate tax-ready reports, track quarterly estimates, and maximize every deduction.",
  },
];

const FEATURES = [
  {
    icon: "auto_awesome",
    title: "AI-Powered Categorization",
    description: "Claude analyzes each transaction and suggests the right Schedule C line item.",
  },
  {
    icon: "receipt_long",
    title: "Schedule C Ready",
    description: "See your expenses mapped to IRS form lines, with quarterly payment estimates.",
  },
  {
    icon: "savings",
    title: "Deduction Calculators",
    description: "Built-in tools for QBI, mileage, home office, health insurance, retirement, and more.",
  },
  {
    icon: "speed",
    title: "Inbox-First Workflow",
    description: "Review transactions one at a time with keyboard shortcuts for rapid categorization.",
  },
  {
    icon: "trending_up",
    title: "Tax Savings Dashboard",
    description: "Track your deductions and estimated savings in real-time throughout the year.",
  },
  {
    icon: "lock",
    title: "Private & Secure",
    description: "Your data stays in your Supabase database. We never share or sell your information.",
  },
];

function MadeInAmericaSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <section className="px-4 md:px-16 py-16 bg-[#f7f3ea] border-y border-bg-tertiary/40">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-mono-medium mb-3">
              Made in America
            </p>
            <h2 className="font-display text-2xl md:text-3xl text-mono-dark leading-snug mb-4">
              Considered tools<br className="hidden md:block" />
              for American small businesses.
            </h2>
            <p className="text-mono-medium text-sm leading-relaxed mb-6">
              ExpenseTerminal is proudly based in New Jersey, supporting American entrepreneurs with
              modern, AI-driven tax tools.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center border border-mono-light/60 px-6 py-3 text-sm font-medium text-mono-dark hover:bg-mono-dark hover:text-white transition-colors"
            >
              Learn more
            </button>
            <p className="mt-3 text-xs text-mono-medium">
              Learn more about America&rsquo;s 250th at{" "}
              <a
                href="https://america250.org"
                target="_blank"
                rel="noreferrer"
                className="font-medium underline underline-offset-4 decoration-mono-medium/60 hover:decoration-mono-dark"
              >
                America 250
              </a>
              .
            </p>
          </div>
          <div className="relative w-full h-56 md:h-80 lg:h-[22rem] rounded-lg overflow-hidden">
            <img
              src="/made-in-america.png"
              alt="United States Capitol building at sunset"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg max-w-lg w-full p-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <h3 className="font-display text-2xl text-mono-dark">Made in America</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-mono-light hover:text-mono-dark transition-colors"
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>
            <div className="space-y-4 text-mono-medium leading-relaxed">
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
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="btn-primary text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-secondary">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-4 md:px-16 py-5">
        <span className="font-display text-xl text-mono-dark tracking-tight">
          ExpenseTerminal
        </span>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="text-sm text-mono-medium hover:text-mono-dark transition-colors px-4 py-2"
          >
            Login
          </Link>
          <Link href="/signup" className="btn-primary text-sm">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/hero-bg-landscape.png"
            alt=""
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>
        <div className="relative px-4 md:px-16 py-24 md:py-40 max-w-5xl mx-auto text-center">
          <h1 className="font-display text-4xl md:text-6xl text-white leading-tight tracking-tight mb-6">
            Keep more of<br />what&rsquo;s yours at tax time.
          </h1>
          <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
            AI-powered tax deduction technology that finds, organizes, and prepares your write-offs for filing.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-medium text-accent-sage transition-all hover:shadow-lg hover:scale-[1.02]"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/5 backdrop-blur-md px-8 py-3.5 text-sm font-medium text-white transition-all hover:bg-white/10"
            >
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-8 md:px-16 py-24 md:py-32" style={{ background: "#435763" }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
            <div>
              <h2 className="font-display text-3xl md:text-4xl text-white/90 leading-snug mb-4">
                Start tracking<br />in minutes.
              </h2>
              <p className="text-white/50 text-sm leading-relaxed mb-8">
                Our platform is built for self-employed professionals, freelancers, and
                small business owners who want to stop leaving money on the table at tax time.
              </p>
              <div className="flex gap-3">
                <Link 
                  href="/signup" 
                  className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-medium text-accent-sage transition-all hover:shadow-lg hover:scale-[1.02]"
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

      {/* Features grid */}
      <section className="px-8 md:px-16 py-24 md:py-32 bg-bg-secondary">
        <div className="max-w-5xl mx-auto">
          <div className="mb-14 text-center md:text-left">
            <h2 className="font-display text-3xl md:text-4xl text-mono-dark mb-3">
              Everything you need<br />for tax season
            </h2>
            <p className="text-mono-medium max-w-xl mx-auto md:mx-0">
              The essential tools for capturing deductions, organizing records, and staying ready when it&rsquo;s time to file.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="border-t border-bg-tertiary/60 pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="material-symbols-rounded text-[24px] text-accent-sage">
                    {feature.icon}
                  </span>
                  <h3 className="text-base font-semibold text-mono-dark">{feature.title}</h3>
                </div>
                <p className="text-sm text-mono-medium leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>

          {/* Pricing snapshot panel */}
          <div className="rounded-2xl bg-accent-sage text-white p-6 md:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 shadow-md">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/70 mb-2">
                Pricing snapshot
              </p>
              <h3 className="font-display text-xl md:text-2xl text-white mb-2">
                Start free. Grow into Starter.
              </h3>
              <p className="text-sm text-white/80 max-w-md">
                Upload CSVs, get AI-reviewed transactions, and stay Schedule C–ready. The free plan
                includes AI on your first 250 CSV transactions; Starter unlocks a full year of
                unlimited AI-reviewed CSV uploads.
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full md:w-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/6 border border-white/10 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white/90">Starter</span>
                    <span className="text-xs text-white/70">Current</span>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    $120<span className="text-xs font-normal text-white/70">/year</span>
                  </p>
                  <p className="text-xs text-white/75 mt-1.5">
                    Unlimited AI-reviewed CSV transactions.
                  </p>
                </div>
                <div className="rounded-xl bg-white/4 border border-white/10 px-4 py-3 text-sm relative">
                  <span className="absolute -top-2 right-3 rounded-full bg-white text-[10px] font-semibold text-accent-sage px-2 py-0.5 shadow-sm">
                    Coming soon
                  </span>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white/90">Plus</span>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    $300<span className="text-xs font-normal text-white/70">/year</span>
                  </p>
                  <p className="text-xs text-white/75 mt-1.5">
                    Planned bank connections and deeper automation for heavy users.
                  </p>
                </div>
              </div>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-full bg-white text-accent-sage px-6 py-2.5 text-sm font-medium hover:bg-white/95 transition-colors w-full md:w-auto"
              >
                View full pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* About / Mission */}
      <section className="px-8 md:px-16 py-24 md:py-32 bg-accent-sage">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl text-white mb-6">
            Small businesses deserve<br />better tax tools.
          </h2>
          <p className="text-white/80 leading-relaxed mb-4">
            Most self-employed professionals overpay on taxes because tracking deductions is tedious and
            easy to put off.
          </p>
          <p className="text-white/80 leading-relaxed mb-10">
            ExpenseTerminal uses AI-powered categorization and smart deduction calculators to help you
            capture more write-offs and file with confidence.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-medium text-accent-sage transition-all hover:shadow-md"
          >
            Start Tracking for Free
          </Link>
        </div>
      </section>

      {/* Made in America */}
      <MadeInAmericaSection />

      {/* Footer */}
      <footer className="px-8 md:px-16 py-12 bg-mono-dark">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <span className="font-display text-lg text-white/80">ExpenseTerminal</span>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <Link href="/login" className="hover:text-white/70 transition-colors">Login</Link>
            <Link href="/signup" className="hover:text-white/70 transition-colors">Sign Up</Link>
            <Link href="/pricing" className="hover:text-white/70 transition-colors">Pricing</Link>
            <Link href="/terms" className="hover:text-white/70 transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-white/70 transition-colors">Privacy</Link>
            <a href="mailto:expenseterminal@outlook.com" className="hover:text-white/70 transition-colors">Contact</a>
          </div>
          <p className="text-xs text-white/30">
            &copy; {new Date().getFullYear()} ExpenseTerminal
          </p>
        </div>
      </footer>
    </div>
  );
}
