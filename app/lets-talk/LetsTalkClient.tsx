"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LandingHeader } from "@/components/LandingHeader";
import { formatUSPhone } from "@/lib/format-us-phone";
import { FaqJsonLd } from "@/components/SeoJsonLd";

const PLATFORM_FEATURES: Array<{
  icon: string;
  title: string;
  description: string;
  iconColor: string;
}> = [
  {
    icon: "account_balance",
    title: "Bank Automation",
    description: "Connect accounts so transactions flow in automatically.",
    iconColor: "#5B82B4",
  },
  {
    icon: "auto_awesome",
    title: "AI‑Powered Deductions",
    description: "See what’s deductible and why.",
    iconColor: "#C9A84C",
  },
  {
    icon: "stadia_controller",
    title: "Gamify To Fill the Gaps",
    description: "Close missing details fast.",
    iconColor: "#16A34A",
  },
  {
    icon: "school",
    title: "Tax Filing Advice",
    description: "We’ll show you how to file taxes and what to prepare.",
    iconColor: "#D97706",
  },
  {
    icon: "savings",
    title: "Other Deductions",
    description: "Mileage, home office, QBI, and more.",
    iconColor: "#2563EB",
  },
];

const MAX_INCOME = 10_000_000;

function formatNumberWithCommas(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function formatUSD(n: number) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n).toLocaleString("en-US")}`;
  }
}

function estimateAnnualSavings(income: number) {
  const i = Math.max(0, Math.min(MAX_INCOME, income));
  const targetSavingsRate = 0.186;
  return i * targetSavingsRate;
}

function formatCompactIncome(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

function roundToNiceStep(value: number) {
  if (value <= 0) return 0;
  const steps = [50_000, 100_000, 250_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000];
  const step = steps.find((s) => value / s <= 10) ?? 10_000_000;
  return Math.ceil(value / step) * step;
}

function TaxSavingsCalculatorCard() {
  const DEFAULT_INCOME = 120_000;
  const [incomeInput, setIncomeInput] = useState(formatNumberWithCommas(DEFAULT_INCOME));
  const [hoverIncome, setHoverIncome] = useState<number | null>(null);

  const income = useMemo(() => {
    const cleaned = incomeInput.replace(/[^\d]/g, "");
    const n = cleaned ? Number(cleaned) : 0;
    return Number.isFinite(n) ? Math.max(0, Math.min(MAX_INCOME, n)) : 0;
  }, [incomeInput]);

  const activeIncome = hoverIncome ?? income;
  const savings = useMemo(() => estimateAnnualSavings(activeIncome), [activeIncome]);

  const chart = useMemo(() => {
    const w = 440;
    const h = 230;
    const padL = 76; // extra room between y ticks and label
    const padR = 20;
    const padT = 18;
    const padB = 56; // room for x ticks + label

    const minX = 0;
    const suggestedMax = Math.max(1_000_000, income * 2);
    const maxX = Math.min(MAX_INCOME, roundToNiceStep(suggestedMax));

    const xs = Array.from({ length: 28 }, (_, idx) => (idx / 27) * (maxX - minX) + minX);
    const ys = xs.map((x) => estimateAnnualSavings(x));
    const maxY = Math.max(1, ...ys);

    const toX = (x: number) => padL + ((x - minX) / (maxX - minX)) * (w - padL - padR);
    const toY = (y: number) => padT + (1 - y / maxY) * (h - padT - padB);

    const points = xs.map((x, i2) => `${toX(x).toFixed(2)},${toY(ys[i2]).toFixed(2)}`).join(" ");
    const cursorX = toX(income);
    const cursorY = toY(estimateAnnualSavings(income));

    const xTicks =
      maxX <= 1_000_000 ? [0, 500_000, 1_000_000] : [0, Math.round(maxX / 2 / 250_000) * 250_000, maxX];
    const yTicks = [0, maxY / 2, maxY];

    return {
      w,
      h,
      padL,
      padR,
      padT,
      padB,
      minX,
      maxX,
      maxY,
      toX,
      toY,
      points,
      cursorX,
      cursorY,
      xTicks,
      yTicks,
    };
  }, [income]);

  const hoverPoint = useMemo(() => {
    if (hoverIncome == null) return null;
    const clamped = Math.max(chart.minX, Math.min(chart.maxX, hoverIncome));
    const yVal = estimateAnnualSavings(clamped);
    return {
      income: clamped,
      savings: yVal,
      x: chart.toX(clamped),
      y: chart.toY(yVal),
    };
  }, [hoverIncome, chart]);

  function svgClientToSvgPoint(e: React.PointerEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * chart.w;
    const y = ((e.clientY - rect.top) / rect.height) * chart.h;
    return { x, y };
  }

  function incomeFromSvgX(x: number) {
    const plotMinX = chart.padL;
    const plotMaxX = chart.w - chart.padR;
    const clampedX = Math.max(plotMinX, Math.min(plotMaxX, x));
    const t = (clampedX - plotMinX) / (plotMaxX - plotMinX);
    return chart.minX + t * (chart.maxX - chart.minX);
  }

  return (
    <div className="card bg-[#F0F1F7] border-[#F0F1F7] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-mono-medium font-semibold mb-1">
            Estimated tax savings
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-mono-dark tabular-nums">{formatUSD(savings)}</p>
          <p className="text-[11px] text-mono-medium">per year (est.)</p>
        </div>
      </div>

      <label className="block text-sm font-medium text-mono-dark mb-1.5" htmlFor="lets-talk-income">
        Annual income
      </label>
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            id="lets-talk-income"
            inputMode="numeric"
            value={incomeInput}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[^\d]/g, "");
              const n = cleaned ? Number(cleaned) : 0;
              if (!Number.isFinite(n)) return;
              setIncomeInput(cleaned ? formatNumberWithCommas(Math.min(MAX_INCOME, n)) : "");
            }}
            onBlur={() => {
              const cleaned = incomeInput.replace(/[^\d]/g, "");
              const n = cleaned ? Number(cleaned) : 0;
              setIncomeInput(formatNumberWithCommas(Math.min(MAX_INCOME, Math.max(0, n))));
            }}
            className="auth-input h-12 pl-4 tabular-nums"
            placeholder={formatNumberWithCommas(DEFAULT_INCOME)}
            aria-describedby="lets-talk-income-hint"
          />
        </div>
      </div>
      <p id="lets-talk-income-hint" className="mt-2 text-[11px] text-mono-medium leading-snug">
        &nbsp;
      </p>

      <div className="mt-4">
        <svg
          viewBox={`0 0 ${chart.w} ${chart.h}`}
          width="100%"
          height="220"
          role="img"
          aria-label="Estimated tax savings graph"
          className="block touch-none select-none"
          preserveAspectRatio="xMidYMid meet"
          onPointerMove={(e) => {
            const { x } = svgClientToSvgPoint(e);
            setHoverIncome(incomeFromSvgX(x));
          }}
          onPointerEnter={(e) => {
            const { x } = svgClientToSvgPoint(e);
            setHoverIncome(incomeFromSvgX(x));
          }}
          onPointerLeave={() => setHoverIncome(null)}
          onClick={() => {
            if (hoverPoint) {
              setIncomeInput(formatNumberWithCommas(Math.round(hoverPoint.income)));
            }
          }}
        >
          <defs>
            <linearGradient id="savingsFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#5B82B4" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#5B82B4" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* axes */}
          <line
            x1={chart.padL}
            y1={chart.padT}
            x2={chart.padL}
            y2={chart.h - chart.padB}
            stroke="#0D1F35"
            strokeOpacity="0.22"
            strokeWidth="1"
          />
          <line
            x1={chart.padL}
            y1={chart.h - chart.padB}
            x2={chart.w - chart.padR}
            y2={chart.h - chart.padB}
            stroke="#0D1F35"
            strokeOpacity="0.22"
            strokeWidth="1"
          />

          {/* ticks + labels */}
          {chart.yTicks.map((v) => {
            const y = chart.toY(v);
            return (
              <g key={`y-${v}`}>
                <line
                  x1={chart.padL}
                  y1={y}
                  x2={chart.w - chart.padR}
                  y2={y}
                  stroke="#0D1F35"
                  strokeOpacity="0.06"
                  strokeWidth="1"
                />
                <text
                  x={chart.padL - 10}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill="#0D1F35"
                  opacity="0.45"
                  fontSize="10"
                  className="tabular-nums"
                >
                  {formatUSD(v)}
                </text>
              </g>
            );
          })}
          {chart.xTicks.map((v) => {
            const x = chart.toX(v);
            return (
              <g key={`x-${v}`}>
                <line
                  x1={x}
                  y1={chart.h - chart.padB}
                  x2={x}
                  y2={chart.padT}
                  stroke="#0D1F35"
                  strokeOpacity="0.06"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={chart.h - chart.padB + 20}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#0D1F35"
                  opacity="0.45"
                  fontSize="11"
                  className="tabular-nums"
                >
                  {formatCompactIncome(v)}
                </text>
              </g>
            );
          })}

          {/* line + fill */}
          <polygon
            points={`${chart.points} ${chart.w - chart.padR},${chart.h - chart.padB} ${chart.padL},${
              chart.h - chart.padB
            }`}
            fill="url(#savingsFill)"
            stroke="none"
          />
          <polyline
            points={chart.points}
            fill="none"
            stroke="#5B82B4"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* cursor */}
          {(hoverPoint ?? { x: chart.cursorX, y: chart.cursorY }).x && (
            <>
              <line
                x1={(hoverPoint ?? { x: chart.cursorX }).x}
                x2={(hoverPoint ?? { x: chart.cursorX }).x}
                y1={chart.padT}
                y2={chart.h - chart.padB}
                stroke="#0D1F35"
                strokeOpacity="0.16"
                strokeWidth="1"
              />
              <circle
                cx={(hoverPoint ?? { x: chart.cursorX }).x}
                cy={(hoverPoint ?? { y: chart.cursorY }).y}
                r="7.5"
                fill="#0D1F35"
              />
              <circle
                cx={(hoverPoint ?? { x: chart.cursorX }).x}
                cy={(hoverPoint ?? { y: chart.cursorY }).y}
                r="4.25"
                fill="#FFFFFF"
              />
            </>
          )}

          {hoverPoint && (
            <g>
              <rect
                x={Math.min(hoverPoint.x + 10, chart.w - chart.padR - 140)}
                y={Math.max(chart.padT + 6, hoverPoint.y - 38)}
                width="132"
                height="34"
                rx="10"
                fill="#FFFFFF"
                opacity="0.95"
                stroke="#0D1F35"
                strokeOpacity="0.08"
              />
              <text
                x={Math.min(hoverPoint.x + 18, chart.w - chart.padR - 132)}
                y={Math.max(chart.padT + 24, hoverPoint.y - 18)}
                fill="#0D1F35"
                fontSize="11"
                opacity="0.6"
                className="tabular-nums"
              >
                {formatUSD(hoverPoint.income)}
              </text>
              <text
                x={Math.min(hoverPoint.x + 18, chart.w - chart.padR - 132)}
                y={Math.max(chart.padT + 40, hoverPoint.y - 2)}
                fill="#0D1F35"
                fontSize="12"
                fontWeight="600"
                className="tabular-nums"
              >
                {formatUSD(hoverPoint.savings)}
              </text>
            </g>
          )}

          {/* axis labels */}
          <text
            x={(chart.padL + (chart.w - chart.padR)) / 2}
            y={chart.h - 16}
            textAnchor="middle"
            fill="#0D1F35"
            opacity="0.4"
            fontSize="12"
          >
            Income
          </text>
          <text
            x="14"
            y={(chart.padT + (chart.h - chart.padB)) / 2}
            textAnchor="middle"
            fill="#0D1F35"
            opacity="0.4"
            fontSize="12"
            transform={`rotate(-90 14 ${(chart.padT + (chart.h - chart.padB)) / 2})`}
          >
            Savings
          </text>
        </svg>
      </div>
    </div>
  );
}

export function LetsTalkClient() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
          <div className="card w-full max-w-md p-8 sm:p-10 text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8EEF5]">
              <span className="material-symbols-rounded text-3xl text-[#5B82B4]">check_circle</span>
            </div>
            <h1
              className="font-sans text-2xl sm:text-3xl text-[#0D1F35] tracking-tight mb-3"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              We received your note
            </h1>
            <p className="text-mono-medium text-sm sm:text-base leading-relaxed mb-8">
              Thanks for reaching out. We&apos;ll reply to the email you provided within 1–2 business
              days.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center bg-[#2563EB] text-white text-sm font-medium px-6 py-3 rounded-2xl hover:bg-[#1D4ED8] transition-colors"
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
            question: "What should I share when I reach out?",
            answer:
              "Share your current workflow, roughly how you track expenses today, and what kind of automation or clarity you’re looking for. We’ll tailor the conversation to your situation.",
          },
          {
            question: "Is this tax advice?",
            answer:
              "No. We can explain how ExpenseTerminal organizes deductions and estimates, but we do not provide personalized tax advice.",
          },
        ]}
      />

      <main className="flex-1 px-4 md:px-8 py-10 sm:py-14">
        <div className="max-w-5xl mx-auto text-center mb-10 sm:mb-14">
          <h1
            className="font-sans text-3xl sm:text-4xl md:text-5xl text-[#0D1F35] tracking-tight mb-3"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Talk to a member of the team
          </h1>
          <p className="text-mono-medium text-base sm:text-lg max-w-2xl mx-auto">
            Whether you&apos;re a tax pro looking for automation or not sure who the IRS is, let us be
            your advocate.
          </p>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
          <div className="space-y-6">
            <div className="card bg-[#F0F1F7] border-[#F0F1F7] p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-mono-medium font-semibold mb-1">
                    Features
                  </p>
                </div>
              </div>
              <ul className="space-y-4">
                {PLATFORM_FEATURES.map((item) => (
                  <li key={item.title} className="flex gap-3">
                    <span
                      className="material-symbols-rounded shrink-0 mt-0.5"
                      style={{ fontSize: "22px", color: item.iconColor }}
                      aria-hidden
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

            <TaxSavingsCalculatorCard />
          </div>

          <div className="card p-6 sm:p-8">
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
                  Email <span className="text-mono-light">*</span>
                </label>
                <input
                  id="demo-email"
                  type="email"
                  required
                  placeholder="Email"
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
                  Business/Side Hustle name <span className="text-mono-light">*</span>
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
                  htmlFor="demo-message"
                  className="block text-sm font-medium text-mono-dark mb-1.5"
                >
                  Anything specific you&apos;d like to cover?{" "}
                  <span className="text-mono-light text-xs">(optional)</span>
                </label>
                <textarea
                  id="demo-message"
                  rows={4}
                  placeholder="Whether you’re a tax pro looking for automation or not sure who the IRS is, let us be your advocate."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="auth-input h-auto py-3"
                />
              </div>

              {error && (
                <p className="text-sm p-3 rounded-[var(--radius-lg)] bg-[#FEE2E2] text-[#DC2626]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-1 bg-[#2563EB] text-white text-sm font-semibold py-3.5 rounded-2xl hover:bg-[#1D4ED8] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Sending…" : "Let’s talk"}
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

