"use client";

import { useState } from "react";
import Link from "next/link";
import { LandingHeader } from "@/components/LandingHeader";

const BUSINESS_TYPES = [
  "Sole Proprietor",
  "Single-member LLC",
  "S-Corp",
  "Partnership",
  "C-Corp",
  "Other",
];

const PLATFORM_FEATURES = [
  {
    icon: "auto_awesome",
    title: "AI-Powered Categorization",
    description: "Every transaction reviewed and mapped to Schedule C categories.",
  },
  {
    icon: "receipt_long",
    title: "Schedule C Ready",
    description: "Expenses mapped to IRS form lines with quarterly estimates.",
  },
  {
    icon: "savings",
    title: "Deduction Calculators",
    description: "QBI, mileage, home office, health insurance, retirement & more.",
  },
  {
    icon: "trending_up",
    title: "Tax Savings Dashboard",
    description: "Track deductions and estimated savings in real time.",
  },
  {
    icon: "lock",
    title: "Private & Secure",
    description: "Your data stays in your database. We never share or sell it.",
  },
];

export default function RequestDemoPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const contactName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || firstName.trim() || lastName.trim();
    if (!contactName) {
      setError("Please enter your name.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/request-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          contactName,
          email: email.trim(),
          businessType: businessType.trim() || undefined,
          message: message.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Could not send your request. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-bg-secondary flex flex-col">
        <LandingHeader />
        <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-lg border border-bg-tertiary/20 p-8 sm:p-10 text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-accent-sage/10">
              <span className="material-symbols-rounded text-3xl text-accent-sage">check_circle</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-mono-dark tracking-tight mb-3">
              We received your request
            </h1>
            <p className="text-mono-medium text-sm sm:text-base leading-relaxed mb-8">
              Thanks for your interest in ExpenseTerminal. We&apos;ll reach out to the email you provided within 1–2 business days to schedule a walkthrough.
            </p>
            <Link href="/" className="btn-primary inline-block">
              Back to home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-secondary flex flex-col">
      <LandingHeader />

      <main className="flex-1 px-4 md:px-8 py-10 sm:py-14">
        {/* Centered heading block */}
        <div className="max-w-5xl mx-auto text-center mb-10 sm:mb-14">
          <p className="text-xs uppercase tracking-[0.2em] text-accent-sage font-semibold mb-3">
            Request demo
          </p>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl text-mono-dark tracking-tight mb-4">
            Schedule a free demo
          </h1>
          <p className="text-mono-medium text-base sm:text-lg max-w-2xl mx-auto">
            See how ExpenseTerminal can help you capture more deductions and save on taxes. Schedule a free demo and get your questions answered.
          </p>
        </div>

        {/* Two-column: left = features + tax savings, right = form */}
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
          {/* Left panel — features & tax savings */}
          <div className="rounded-2xl bg-white border border-bg-tertiary/20 shadow-sm p-6 sm:p-8">
            <h2 className="font-display text-xl text-mono-dark tracking-tight mb-6">
              What you get
            </h2>
            <ul className="space-y-4 mb-8">
              {PLATFORM_FEATURES.map((item) => (
                <li key={item.title} className="flex gap-3">
                  <span className="material-symbols-rounded text-accent-sage shrink-0 mt-0.5" style={{ fontSize: "22px" }}>
                    {item.icon}
                  </span>
                  <div>
                    <p className="font-medium text-mono-dark text-sm">{item.title}</p>
                    <p className="text-mono-medium text-xs leading-relaxed mt-0.5">{item.description}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="rounded-xl bg-accent-sage/10 border border-accent-sage/20 p-5">
              <p className="text-xs uppercase tracking-wider text-accent-sage font-semibold mb-2">
                Tax savings
              </p>
              <p className="text-mono-dark font-display text-2xl sm:text-3xl tracking-tight mb-2">
                20–30%
              </p>
              <p className="text-mono-medium text-sm leading-relaxed">
                Self-employed filers often miss 20–30% of eligible deductions. ExpenseTerminal helps you find, organize, and document them so you keep more of what you earn.
              </p>
            </div>
          </div>

          {/* Right panel — form */}
          <div className="rounded-2xl bg-white border border-bg-tertiary/20 shadow-sm p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="demo-first-name" className="block text-sm font-medium text-mono-dark mb-1.5">
                    First name <span className="text-mono-light">*</span>
                  </label>
                  <input
                    id="demo-first-name"
                    type="text"
                    required
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="auth-input"
                  />
                </div>
                <div>
                  <label htmlFor="demo-last-name" className="block text-sm font-medium text-mono-dark mb-1.5">
                    Last name <span className="text-mono-light">*</span>
                  </label>
                  <input
                    id="demo-last-name"
                    type="text"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="auth-input"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="demo-email" className="block text-sm font-medium text-mono-dark mb-1.5">
                  Work email <span className="text-mono-light">*</span>
                </label>
                <input
                  id="demo-email"
                  type="email"
                  required
                  placeholder="Work email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                />
              </div>

              <div>
                <label htmlFor="demo-company" className="block text-sm font-medium text-mono-dark mb-1.5">
                  Company / business name <span className="text-mono-light">*</span>
                </label>
                <input
                  id="demo-company"
                  type="text"
                  required
                  placeholder="Company name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="auth-input"
                />
              </div>

              <div>
                <label htmlFor="demo-business-type" className="block text-sm font-medium text-mono-dark mb-1.5">
                  Business type <span className="text-mono-light text-xs">(optional)</span>
                </label>
                <select
                  id="demo-business-type"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="auth-input appearance-none cursor-pointer py-3.5"
                >
                  <option value="">Select type</option>
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="demo-message" className="block text-sm font-medium text-mono-dark mb-1.5">
                  What are you looking for? <span className="text-mono-light text-xs">(optional)</span>
                </label>
                <textarea
                  id="demo-message"
                  placeholder="e.g. Help tracking deductions across multiple entities..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="auth-input resize-y min-h-[80px]"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50/80 p-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3.5 text-sm font-semibold"
              >
                {loading ? "Sending…" : "Get free demo"}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-mono-medium">
              Prefer to try it yourself?{" "}
              <Link href="/signup" className="font-medium text-accent-navy hover:underline">
                Sign up for free
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
