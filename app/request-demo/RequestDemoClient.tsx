"use client";

import { useState } from "react";
import Link from "next/link";
import { LandingHeader } from "@/components/LandingHeader";
import { formatUSPhone } from "@/lib/format-us-phone";
import { FaqJsonLd } from "@/components/SeoJsonLd";

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
    icon: "account_balance",
    title: "Bank Syncing",
    description:
      "Connect your accounts to pull transactions in automatically and keep everything in one place.",
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
    description: "Mileage, home office, health insurance, retirement & more.",
  },
];

export function RequestDemoClient() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const contactName =
      [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") ||
      firstName.trim() ||
      lastName.trim();
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
      <div className="min-h-screen bg-white flex flex-col">
        <LandingHeader />
        <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
          <div className="w-full max-w-md border border-[#E8EEF5] bg-[#F5F0E8] p-8 sm:p-10 text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center bg-[#E8EEF5]">
              <span className="material-symbols-rounded text-3xl text-[#5B82B4]">
                check_circle
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl text-[#0D1F35] tracking-tight mb-3">
              We received your request
            </h1>
            <p className="text-mono-medium text-sm sm:text-base leading-relaxed mb-8">
              Thanks for your interest in ExpenseTerminal. We&apos;ll reach out to the email you
              provided within 1–2 business days to schedule a walkthrough of our AI-powered expense
              tracking and tax deduction workflows.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center bg-[#2563EB] text-white text-sm font-medium px-6 py-3 rounded-none hover:bg-[#1D4ED8] transition-colors"
            >
              Back to home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <LandingHeader />
      <FaqJsonLd
        items={[
          {
            question: "What will I see in an ExpenseTerminal demo?",
            answer:
              "In an ExpenseTerminal demo we walk through how to connect your data, review AI-categorized transactions, and generate audit-ready reports so you can see how the platform fits your current tax and bookkeeping workflow.",
          },
          {
            question: "Who should request a demo of ExpenseTerminal?",
            answer:
              "Demos are most helpful for self-employed professionals and small business owners who manage many transactions, want to capture more deductions, or collaborate with a bookkeeper or accountant on tax prep.",
          },
        ]}
      />

      <main className="flex-1 px-4 md:px-8 py-10 sm:py-14">
        <div className="max-w-5xl mx-auto text-center mb-10 sm:mb-14">
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl text-[#0D1F35] tracking-tight mb-3">
            Request an ExpenseTerminal tax deduction demo
          </h1>
          <p className="text-mono-medium text-base sm:text-lg max-w-2xl mx-auto">
            See how ExpenseTerminal&apos;s AI-powered expense tracking helps you capture more
            self-employed deductions, stay organized for tax season, and give your accountant clean,
            audit-ready reports.
          </p>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
          <div className="space-y-6">
            <div className="bg-[#F5F0E8] p-6 sm:p-8">
              <h2 className="font-display text-xl text-[#0D1F35] tracking-tight mb-6">
                What you get
              </h2>
              <ul className="space-y-4">
                {PLATFORM_FEATURES.map((item) => (
                  <li key={item.title} className="flex gap-3">
                    <span
                      className="material-symbols-rounded text-black shrink-0 mt-0.5"
                      style={{ fontSize: "22px" }}
                    >
                      {item.icon}
                    </span>
                    <div>
                      <p className="font-medium text-mono-dark text-sm">{item.title}</p>
                      <p className="text-mono-medium text-xs leading-relaxed mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-[#E8EEF5] p-5 sm:p-6">
              <p className="text-xs uppercase tracking-[0.18em] text-mono-medium font-semibold mb-2">
                Tax savings
              </p>
              <p className="font-display text-2xl sm:text-3xl tracking-tight mb-2 text-mono-dark">
                20–30%
              </p>
              <p className="text-sm leading-relaxed text-mono-medium">
                Self-employed filers often miss 20–30% of eligible deductions. ExpenseTerminal helps
                you find, organize, and document them so you keep more of what you earn.
              </p>
            </div>
          </div>

          <div className="border border-[#E8EEF5] bg-white p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="demo-first-name"
                    className="block text-sm font-medium text-mono-dark mb-1.5"
                  >
                    First name <span className="text-mono-light">*</span>
                  </label>
                  <input
                    id="demo-first-name"
                    type="text"
                    required
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="auth-input h-12"
                  />
                </div>
                <div>
                  <label
                    htmlFor="demo-last-name"
                    className="block text-sm font-medium text-mono-dark mb-1.5"
                  >
                    Last name <span className="text-mono-light">*</span>
                  </label>
                  <input
                    id="demo-last-name"
                    type="text"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="auth-input h-12"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="demo-email"
                  className="block text-sm font-medium text-mono-dark mb-1.5"
                >
                  Work email <span className="text-mono-light">*</span>
                </label>
                <input
                  id="demo-email"
                  type="email"
                  required
                  placeholder="Work email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input h-12"
                />
              </div>

              <div>
                <label
                  htmlFor="demo-phone"
                  className="block text-sm font-medium text-mono-dark mb-1.5"
                >
                  Phone <span className="text-mono-light">*</span>
                </label>
                <input
                  id="demo-phone"
                  type="tel"
                  inputMode="tel"
                  required
                  placeholder="Phone"
                  value={phone}
                  onChange={(e) => setPhone(formatUSPhone(e.target.value))}
                  className="auth-input h-12"
                />
              </div>

              <div>
                <label
                  htmlFor="demo-company"
                  className="block text-sm font-medium text-mono-dark mb-1.5"
                >
                  Organization name <span className="text-mono-light">*</span>
                </label>
                <input
                  id="demo-company"
                  type="text"
                  required
                  placeholder="Company name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="auth-input h-12"
                />
              </div>

              <div>
                <label
                  htmlFor="demo-business-type"
                  className="block text-sm font-medium text-mono-dark mb-1.5"
                >
                  Organization type <span className="text-mono-light text-xs">(optional)</span>
                </label>
                <select
                  id="demo-business-type"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="auth-input appearance-none cursor-pointer h-12"
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
                <label
                  htmlFor="demo-message"
                  className="block text-sm font-medium text-mono-dark mb-1.5"
                >
                  Anything specific you&apos;d like to cover?{" "}
                  <span className="text-mono-light text-xs">(optional)</span>
                </label>
                <textarea
                  id="demo-message"
                  rows={4}
                  placeholder="Share context about your business, current tools, or what you want to see in the demo."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="auth-input h-auto py-3"
                />
              </div>

              {error && (
                <p className="text-sm p-3 bg-[#FEE2E2] text-[#DC2626]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-1 bg-[#2563EB] text-white text-sm font-semibold py-3.5 rounded-none hover:bg-[#1D4ED8] disabled:opacity-60 disabled:cursor-not-allowed"
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

