 "use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { LandingHeader } from "@/components/LandingHeader";
import { PricingPlansGrid } from "@/components/PricingPlansGrid";

const STEPS = [
  {
    number: "I",
    title: "Sign up",
    description: "Create your account and choose your tax year in under a minute.",
  },
  {
    number: "II",
    title: "Connect your bank",
    description: "Link accounts securely — we pull transactions so you are not typing every charge by hand.",
  },
  {
    number: "III",
    title: "Review in the Inbox",
    description: "Confirm or adjust AI suggestions in plain English — no spreadsheet slog.",
  },
  {
    number: "IV",
    title: "See savings & exports",
    description: "Track write-offs, estimated payments, and export summaries you can share with a preparer.",
  },
];

const PILLARS = [
  {
    icon: "account_balance",
    title: "Bank sync & review",
    description:
      "Connect accounts and work through an Inbox-first flow so business vs. personal calls stay fast and clear.",
  },
  {
    icon: "home_work",
    title: "Calculated deductions",
    description:
      "Home office, mileage, health insurance, and more — structured inputs with transparent math, not guesswork.",
  },
  {
    icon: "description",
    title: "Tax-year clarity",
    description:
      "See totals by category, estimated quarterly payments, and exports that speak your accountant’s language.",
  },
  {
    icon: "lock",
    title: "Private by design",
    description:
      "Encryption in transit and at rest. We do not sell your financial data.",
  },
];

const PERSONAS = [
  { label: "Freelancers", href: "/signup" },
  { label: "Gig & app work", href: "/signup" },
  { label: "Creators", href: "/signup" },
  { label: "E‑commerce", href: "/signup" },
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
                We&apos;re focused on supporting <strong>American businesses</strong> and helping them maximize their deductions while staying compliant with IRS regulations.
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
          <p className="text-xs uppercase tracking-[0.2em] text-white/75 mb-4">
            Built for independent workers
          </p>
          <h1 className="font-display text-4xl md:text-6xl text-white leading-tight tracking-tight mb-6">
            Find the write-offs you are missing — without the busywork
          </h1>
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-6 leading-relaxed">
            Connect your bank, review smart suggestions in plain English, and see deductions and estimated payments in
            one calm workspace.
          </p>
          <p className="text-sm text-white/60 mb-10">Secure Plaid connections · Encrypted data · You stay in control</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center bg-[#2563EB] px-8 py-3.5 text-sm font-medium text-white rounded-2xl transition-all hover:bg-[#1D4ED8] hover:shadow-lg hover:scale-[1.02]"
            >
              Start free
            </Link>
            <Link
              href="/lets-talk"
              className="inline-flex items-center justify-center border border-white/50 bg-white/10 backdrop-blur-md px-8 py-3.5 text-sm font-medium text-white rounded-2xl transition-all hover:bg-white/20"
            >
              Let’s Talk
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center text-sm font-medium text-white/90 underline-offset-4 hover:underline"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      {/* Pillars — Maven-style sections, Apple-like spacing */}
      <section className="px-8 md:px-16 py-24 md:py-32" style={{ background: "#E8EEF5" }}>
        <div className="max-w-5xl mx-auto">
          <div className="mb-14 text-center md:text-left">
            <h2 className="font-display text-3xl md:text-4xl text-[#0D1F35] mb-3">
              Everything for side-hustle taxes, in one place
            </h2>
            <p className="text-mono-medium text-base md:text-lg max-w-2xl mx-auto md:mx-0 leading-relaxed">
              Sync transactions, layer in calculated deductions, and walk into tax season with numbers you can explain.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {PILLARS.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl bg-white/90 p-6 shadow-sm border border-white/80"
              >
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

          <div className="mt-14 flex flex-wrap justify-center md:justify-start gap-3">
            {PERSONAS.map((p) => (
              <Link
                key={p.label}
                href={p.href}
                className="inline-flex items-center rounded-full border border-[#0D1F35]/15 bg-white px-4 py-2 text-sm font-medium text-mono-dark hover:border-sovereign-blue/40 hover:shadow-sm transition-all"
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Value proposition — plain language, reassurance */}
      <section className="px-8 md:px-16 py-24 md:py-32" style={{ background: "#FFFFFF" }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl text-mono-dark mb-6">
            Taxes for self-employed work,<br />without the spreadsheet spiral
          </h2>
          <p className="text-mono-medium text-base md:text-lg leading-relaxed mb-10">
            When you are juggling clients, platforms, and cards, it is easy to miss write-offs. ExpenseTerminal pulls
            transactions in, suggests categories in plain English, and keeps estimated payments in view so you are not
            guessing at tax time.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center bg-[#2563EB] px-6 py-3 text-sm font-medium text-white rounded-2xl transition-all hover:bg-[#1D4ED8] hover:shadow-md"
            >
              Start free
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center border border-[#0D1F35]/20 bg-white text-sm font-medium text-mono-dark px-6 py-3 rounded-2xl hover:bg-[#fafafa] transition-all"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Plans — integrates PricingPlansGrid (was previously imported but unused) */}
      <section className="px-8 md:px-16 py-20 md:py-24 bg-[#F5F0E8]/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center md:text-left mb-10">
            <h2 className="font-display text-2xl md:text-3xl text-mono-dark mb-2">Simple pricing</h2>
            <p className="text-sm text-mono-medium max-w-xl">
              Start on the trial, upgrade when you need more. No surprise jargon on the invoice.
            </p>
          </div>
          <PricingPlansGrid />
          <p className="text-center md:text-left mt-8 text-xs text-mono-light">
            Questions?{" "}
            <Link href="/request-demo" className="text-sovereign-blue font-medium hover:underline">
              Talk to us
            </Link>{" "}
            or see{" "}
            <Link href="/pricing" className="text-sovereign-blue font-medium hover:underline">
              full pricing
            </Link>
            .
          </p>
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
                  className="inline-flex items-center justify-center bg-[#2563EB] px-6 py-3 text-sm font-medium text-white rounded-2xl transition-all hover:bg-[#1D4ED8] hover:shadow-lg hover:scale-[1.02]"
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

      {/* Testimonials — Maven-style trust section */}
      <section className="px-8 md:px-16 py-20 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-2xl md:text-3xl text-mono-dark mb-8">
            Real people, calmer tax seasons
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                quote:
                  "Connecting my accounts and seeing estimated payments made it feel… manageable. I finally knew what to set aside.",
                name: "Freelance designer",
              },
              {
                quote:
                  "The plain-English categories saved me from second-guessing every transaction. Review took minutes, not hours.",
                name: "Gig driver",
              },
              {
                quote:
                  "Home office math was transparent. Seeing both methods built trust—no more guessing what my preparer will ask for.",
                name: "Creator",
              },
            ].map((t) => (
              <div key={t.name} className="rounded-2xl border border-[#eee] bg-[#fafafa] p-5">
                <p className="text-sm text-mono-dark leading-relaxed">“{t.quote}”</p>
                <p className="text-xs text-mono-light mt-4">{t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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
