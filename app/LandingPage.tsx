"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

const STEPS = [
  {
    number: "01",
    title: "Sign Up",
    description: "Create a free account to start tracking your business deductions in minutes. Perfect for ABA professionals and small business owners.",
  },
  {
    number: "02",
    title: "Connect Your Data",
    description: "Upload CSV or Excel files from your bank, credit card, or accounting tool.",
  },
  {
    number: "03",
    title: "AI Categorization",
    description: "Our AI reviews each transaction and maps it to Schedule C categories automatically.",
  },
  {
    number: "04",
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
      <section className="px-8 md:px-16 py-16 bg-bg-secondary border-y border-bg-tertiary/40">
        <div className="max-w-5xl mx-auto text-center">
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 text-mono-medium hover:text-mono-dark transition-colors group"
          >
            <img 
              src="/usa-flag.png" 
              alt="USA Flag" 
              className="w-6 h-4 object-contain"
            />
            <span className="text-lg font-display">Made in America</span>
          </button>
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
      <nav className="flex items-center justify-between px-8 md:px-16 py-5">
        <span className="font-display text-xl text-mono-dark tracking-tight">
          ExpenseTerminal
        </span>
        <div className="flex items-center gap-3">
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
        <div className="relative px-8 md:px-16 py-28 md:py-40 max-w-5xl mx-auto text-center">
          <h1 className="font-display text-4xl md:text-6xl text-white leading-tight tracking-tight mb-6">
            Maximize your<br />business deductions
          </h1>
          <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
            AI-powered expense tracking for small businesses. Upload your transactions,
            let AI categorize them, and file your taxes with confidence.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-medium text-accent-sage transition-all hover:shadow-lg hover:scale-[1.02]"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full border border-white/30 px-8 py-3.5 text-sm font-medium text-white transition-all hover:bg-white/10"
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
                  <span className="font-display text-sm text-white/40 italic shrink-0 mt-0.5">
                    {step.number}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-1">{step.title}</h3>
                    <p className="text-sm text-white/60 leading-relaxed">{step.description}</p>
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
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl text-mono-dark mb-4">
              Everything you need<br />for tax season
            </h2>
            <p className="text-mono-medium max-w-xl mx-auto">
              From AI categorization to Schedule C reports, ExpenseTerminal handles the
              complexity so you can focus on your business.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="card p-6">
                <span className="material-symbols-rounded text-[28px] text-accent-sage mb-3 block">
                  {feature.icon}
                </span>
                <h3 className="text-base font-semibold text-mono-dark mb-2">{feature.title}</h3>
                <p className="text-sm text-mono-medium leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Made in America */}
      <MadeInAmericaSection />

      {/* About / Mission */}
      <section className="px-8 md:px-16 py-24 md:py-32 bg-bg-tertiary/30">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl text-mono-dark mb-6">
            Small businesses deserve<br />better tax tools.
          </h2>
          <p className="text-mono-medium leading-relaxed mb-4">
            Most self-employed professionals overpay on taxes because tracking deductions
            is tedious and confusing. We built ExpenseTerminal to change that.
          </p>
          <p className="text-mono-medium leading-relaxed mb-10">
            With AI-powered categorization and built-in deduction calculators, you can
            capture every legitimate deduction and file with confidence — no accounting
            degree required.
          </p>
          <Link href="/signup" className="btn-primary">
            Start Tracking for Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 md:px-16 py-12 bg-mono-dark">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <span className="font-display text-lg text-white/80">ExpenseTerminal</span>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <Link href="/login" className="hover:text-white/70 transition-colors">Login</Link>
            <Link href="/signup" className="hover:text-white/70 transition-colors">Sign Up</Link>
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
