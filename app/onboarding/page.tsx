"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { createSupabaseClient } from "@/lib/supabase/client";

type StepId = "welcome" | "workProfile" | "connect" | "reveal";

const incomeOptions = [
  { id: "<10k", label: "<$10K" },
  { id: "10-50k", label: "$10–50K" },
  { id: "50-150k", label: "$50–150K" },
  { id: "150k+", label: "$150K+" },
] as const;

export default function OnboardingPage() {
  const [step, setStep] = useState<StepId>("welcome");
  const [workTypes, setWorkTypes] = useState<string[]>([]);
  const [incomeRange, setIncomeRange] = useState<string | null>(null);
  const [hasCpa, setHasCpa] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [plaidToken, setPlaidToken] = useState<string | null>(null);
  const [pendingPlaidOpen, setPendingPlaidOpen] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [dataSourceId, setDataSourceId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{
    deductions: number;
    txCount: number;
    categoriesCount: number;
    savingsLow: number;
    savingsHigh: number;
  } | null>(null);

  const canContinueWorkProfile = workTypes.length > 0 && !!incomeRange && !!hasCpa;

  const revealText = useMemo(() => {
    if (!reveal) {
      return {
        deductions: "$3,847",
        txCount: "47",
        categories: "8",
        savings: "$923–$1,420",
      };
    }
    const money = (n: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(n);
    return {
      deductions: money(reveal.deductions),
      txCount: String(reveal.txCount),
      categories: String(reveal.categoriesCount),
      savings: `${money(reveal.savingsLow)}–${money(reveal.savingsHigh)}`,
    };
  }, [reveal]);

  useEffect(() => {
    const supabase = createSupabaseClient();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        setUserId(data.user?.id ?? null);
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  const { open, ready } = usePlaidLink({
    token: plaidToken,
    onSuccess: async (publicToken, metadata) => {
      setConnectError(null);
      setConnectLoading(true);
      try {
        const ex = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token: publicToken, metadata }),
        });
        const exJson = await ex.json();
        if (!ex.ok) throw new Error(exJson?.error || "Failed to exchange Plaid token");

        const dsId = (exJson?.dataSourceIds?.[0] as string | undefined) ?? null;
        if (!dsId) throw new Error("No data source id returned");
        setDataSourceId(dsId);

        setSyncMessage("Syncing your transactions…");
        const syncRes = await fetch("/api/data-sources/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data_source_id: dsId }),
        });
        const syncJson = await syncRes.json();
        if (!syncRes.ok) throw new Error(syncJson?.error || "Sync failed");
        setSyncMessage(syncJson?.message ?? "Sync complete");

        // Load a chunk of un-analyzed expenses from this source and run classification.
        const txRes = await fetch(
          `/api/transactions?data_source_id=${encodeURIComponent(dsId)}&transaction_type=expense&analyzed_only=false&limit=80`,
        );
        const txJson = await txRes.json();
        const txIds: string[] = Array.isArray(txJson?.data)
          ? txJson.data.map((t: any) => t?.id).filter((id: any) => typeof id === "string")
          : [];

        if (txIds.length > 0) {
          setSyncMessage(`Classifying ${txIds.length} transactions…`);
          const classifyRes = await fetch("/api/classify/transaction", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactionIds: txIds }),
          });
          if (!classifyRes.ok) {
            const errText = await classifyRes.text().catch(() => "");
            throw new Error(errText || "Classification failed");
          }
          // Drain the stream so the server work completes.
          await classifyRes.text().catch(() => {});
        }

        // Compute the reveal numbers from analyzed transactions.
        const analyzedRes = await fetch(
          `/api/transactions?data_source_id=${encodeURIComponent(dsId)}&transaction_type=expense&analyzed_only=true&limit=200`,
        );
        const analyzedJson = await analyzedRes.json();
        const rows: any[] = Array.isArray(analyzedJson?.data) ? analyzedJson.data : [];

        const deductions = rows.reduce((sum, t) => {
          const amt = Math.abs(Number(t?.amount ?? 0));
          const pct = Number(t?.deduction_percent ?? 100);
          if (!Number.isFinite(amt) || !Number.isFinite(pct)) return sum;
          return sum + amt * (pct / 100);
        }, 0);
        const categories = new Set(rows.map((t) => String(t?.schedule_c_line ?? t?.category ?? "")).filter(Boolean));

        // Rough savings range: 24%–37% marginal, until tax-rate model lands.
        const savingsLow = deductions * 0.24;
        const savingsHigh = deductions * 0.37;

        setReveal({
          deductions,
          txCount: rows.length,
          categoriesCount: categories.size,
          savingsLow,
          savingsHigh,
        });

        setSyncMessage(null);
        setStep("reveal");
      } catch (e) {
        setConnectError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setConnectLoading(false);
      }
    },
    onExit: () => {},
  });

  useEffect(() => {
    if (!pendingPlaidOpen) return;
    if (!plaidToken) return;
    if (!ready) return;
    open();
    setPendingPlaidOpen(false);
  }, [pendingPlaidOpen, plaidToken, ready, open]);

  async function requestPlaidToken() {
    setConnectError(null);
    setConnectLoading(true);
    try {
      const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create Plaid link token");
      setPlaidToken(json.link_token);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "Failed to create Plaid token");
    } finally {
      setConnectLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-white px-4 py-10">
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-sm text-mono-medium hover:text-mono-dark">
            ← Back
          </Link>
        </div>

        {step === "welcome" && (
          <section className="border border-[#F0F1F7] bg-white p-6">
            <h1 className="font-display text-3xl text-mono-dark mb-3">
              Let’s find what you can save.
            </h1>
            <p className="text-mono-medium leading-relaxed">
              Takes about 10 minutes. No SSN. No typing.
            </p>
            <button
              type="button"
              onClick={() => setStep("workProfile")}
              className="mt-6 inline-flex items-center justify-center bg-[#2563EB] px-6 py-3 text-sm font-medium text-white rounded-none transition-all hover:bg-[#1D4ED8] w-full"
            >
              Get started
            </button>
          </section>
        )}

        {step === "workProfile" && (
          <section className="border border-[#F0F1F7] bg-white p-6 space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-mono-medium mb-2">
                Step 1 of 3
              </p>
              <h2 className="font-display text-2xl text-mono-dark">
                Tell us about your work
              </h2>
              <p className="mt-2 text-sm text-mono-medium">
                This tunes classification and estimates.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-mono-dark">How do you earn money?</p>
              <div className="flex flex-wrap gap-2">
                {["W2 job", "1099 contracts", "LLC / business", "Other"].map((label) => {
                  const active = workTypes.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        setWorkTypes((prev) =>
                          active ? prev.filter((x) => x !== label) : [...prev, label],
                        )
                      }
                      className={`px-3 py-2 text-sm border rounded-none transition-colors ${
                        active
                          ? "bg-[#2563EB]/10 border-[#2563EB]/30 text-mono-dark"
                          : "bg-white border-[#E8EEF5] text-mono-medium hover:text-mono-dark"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-mono-dark">
                Roughly how much from side income last year?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {incomeOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setIncomeRange(opt.id)}
                    className={`px-3 py-2 text-sm border rounded-none text-left transition-colors ${
                      incomeRange === opt.id
                        ? "bg-[#2563EB]/10 border-[#2563EB]/30 text-mono-dark"
                        : "bg-white border-[#E8EEF5] text-mono-medium hover:text-mono-dark"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-mono-dark">Do you work with a CPA?</p>
              <div className="flex gap-2">
                {["Yes", "No", "Sometimes"].map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setHasCpa(label)}
                    className={`px-3 py-2 text-sm border rounded-none transition-colors ${
                      hasCpa === label
                        ? "bg-[#2563EB]/10 border-[#2563EB]/30 text-mono-dark"
                        : "bg-white border-[#E8EEF5] text-mono-medium hover:text-mono-dark"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep("welcome")}
                className="px-4 py-3 text-sm border border-[#E8EEF5] text-mono-medium hover:text-mono-dark rounded-none"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!canContinueWorkProfile}
                onClick={() => setStep("connect")}
                className={`flex-1 inline-flex items-center justify-center px-6 py-3 text-sm font-medium rounded-none transition-all ${
                  canContinueWorkProfile
                    ? "bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
                    : "bg-[#E8EEF5] text-mono-light cursor-not-allowed"
                }`}
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {step === "connect" && (
          <section className="border border-[#F0F1F7] bg-white p-6 space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-mono-medium">
              Step 2 of 3
            </p>
            <h2 className="font-display text-2xl text-mono-dark">Connect your accounts</h2>
            <p className="text-sm text-mono-medium leading-relaxed">
              Connect via Plaid. We’ll pull transactions, run classification, then show your first
              “savings reveal.”
            </p>

            {!authChecked ? (
              <p className="text-sm text-mono-medium">Checking your session…</p>
            ) : !userId ? (
              <div className="border border-[#E8EEF5] bg-[#F0F1F7] p-4">
                <p className="text-sm text-mono-medium leading-relaxed">
                  You’ll need an account to connect your bank. Create one first, then come back to
                  onboarding.
                </p>
                <div className="mt-3 flex gap-3">
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center bg-[#2563EB] px-5 py-2.5 text-sm font-medium text-white rounded-none transition-all hover:bg-[#1D4ED8]"
                  >
                    Create account
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center border border-[#0D1F35]/20 bg-white text-sm font-medium text-mono-dark px-5 py-2.5 rounded-none hover:bg-white/80 transition-all"
                  >
                    Log in
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {connectError && (
                  <p className="text-sm text-red-700 border border-red-200 bg-red-50 px-3 py-2">
                    {connectError}
                  </p>
                )}
                {syncMessage && (
                  <p className="text-sm text-mono-medium border border-[#E8EEF5] bg-[#F0F1F7] px-3 py-2">
                    {syncMessage}
                  </p>
                )}
                <button
                  type="button"
                  disabled={connectLoading}
                  onClick={async () => {
                    if (!plaidToken) {
                      setPendingPlaidOpen(true);
                      await requestPlaidToken();
                      return;
                    }
                    if (ready) open();
                  }}
                  className={`w-full inline-flex items-center justify-center px-6 py-3 text-sm font-medium rounded-none transition-all ${
                    connectLoading
                      ? "bg-[#E8EEF5] text-mono-light cursor-not-allowed"
                      : "bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
                  }`}
                >
                  {connectLoading ? "Working…" : dataSourceId ? "Connected" : "Connect bank"}
                </button>
                {!plaidToken && (
                  <p className="text-xs text-mono-light">
                    We’ll generate a secure Link token when you connect.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep("workProfile")}
                className="px-4 py-3 text-sm border border-[#E8EEF5] text-mono-medium hover:text-mono-dark rounded-none"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!dataSourceId || connectLoading || !!syncMessage}
                onClick={() => setStep("reveal")}
                className={`flex-1 inline-flex items-center justify-center px-6 py-3 text-sm font-medium rounded-none transition-all ${
                  dataSourceId && !connectLoading && !syncMessage
                    ? "bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
                    : "bg-[#E8EEF5] text-mono-light cursor-not-allowed"
                }`}
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {step === "reveal" && (
          <section className="border border-[#F0F1F7] bg-white p-6 space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-mono-medium">
              Step 3 of 3
            </p>
            <h2 className="font-display text-2xl text-mono-dark">The reveal</h2>
            {connectError && (
              <p className="text-sm text-red-700 border border-red-200 bg-red-50 px-3 py-2">
                {connectError}
              </p>
            )}
            <p className="text-sm text-mono-medium leading-relaxed">
              We found <span className="font-semibold text-mono-dark">{revealText.deductions}</span>{" "}
              in potential deductions across {revealText.txCount} transactions in{" "}
              {revealText.categories} categories.
            </p>
            <p className="text-sm text-mono-medium leading-relaxed">
              Estimated tax savings:{" "}
              <span className="font-semibold text-mono-dark">{revealText.savings}</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={async () => {
                  setConnectError(null);
                  setConnectLoading(true);
                  try {
                    const res = await fetch("/api/stripe/checkout", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ interval: "year" }),
                    });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(json?.error || "Checkout failed");
                    if (json?.url) window.location.href = json.url;
                  } catch (e) {
                    setConnectError(e instanceof Error ? e.message : "Checkout failed");
                  } finally {
                    setConnectLoading(false);
                  }
                }}
                disabled={connectLoading}
                className="inline-flex items-center justify-center bg-[#2563EB] px-6 py-3 text-sm font-medium text-white rounded-none transition-all hover:bg-[#1D4ED8] flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                See the breakdown — Annual
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConnectError(null);
                  setConnectLoading(true);
                  try {
                    const res = await fetch("/api/stripe/checkout", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ interval: "month" }),
                    });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(json?.error || "Checkout failed");
                    if (json?.url) window.location.href = json.url;
                  } catch (e) {
                    setConnectError(e instanceof Error ? e.message : "Checkout failed");
                  } finally {
                    setConnectLoading(false);
                  }
                }}
                disabled={connectLoading}
                className="inline-flex items-center justify-center border border-[#0D1F35]/20 bg-white text-sm font-medium text-mono-dark px-6 py-3 rounded-none hover:bg-white/80 transition-all flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Maybe later — Monthly
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
