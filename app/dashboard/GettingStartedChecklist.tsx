"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FilingStatus } from "@/lib/onboarding/income-brackets";
import { INCOME_BRACKETS } from "@/lib/onboarding/income-brackets";

interface OnboardingProgress {
  notification_frequency?: boolean;
  business_type?: boolean;
  filing_status?: boolean;
  business_industry?: boolean;
  expected_income?: boolean;
  what_can_i_deduct?: boolean;
  link_account?: boolean;
  skipped_all?: boolean;
}

type StepId = keyof Omit<OnboardingProgress, "skipped_all">;

const STEP_ORDER: StepId[] = [
  "notification_frequency",
  "business_type",
  "filing_status",
  "business_industry",
  "expected_income",
  "what_can_i_deduct",
  "link_account",
];

const INDUSTRY_PRESETS = [
  "Consulting",
  "Acting",
  "Fitness",
  "Creator",
  "Rideshare",
  "Real Estate",
  "Delivery",
  "Freelance Dev",
  "Photography",
  "Music",
];

const NOTIFICATION_OPTIONS: Array<{ label: string; type: "count_based" | "interval_based"; value: string }> = [
  { label: "50 transactions", type: "count_based", value: "50" },
  { label: "100 transactions", type: "count_based", value: "100" },
  { label: "250 transactions", type: "count_based", value: "250" },
  { label: "500 transactions", type: "count_based", value: "500" },
  { label: "1000 transactions", type: "count_based", value: "1000" },
  { label: "Weekly", type: "interval_based", value: "weekly" },
  { label: "Monthly", type: "interval_based", value: "monthly" },
  { label: "Quarterly", type: "interval_based", value: "quarterly" },
];

const BUSINESS_TYPES: Array<{ label: string; value: string }> = [
  { label: "LLC", value: "llc" },
  { label: "Sole Proprietorship", value: "sole_prop" },
  { label: "S-Corp", value: "s_corp" },
  { label: "Partnership", value: "partnership" },
  { label: "Other", value: "other" },
];

function StepDone({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span
        className="material-symbols-rounded text-[#16A34A] shrink-0"
        style={{ fontSize: 16 }}
      >
        check_circle
      </span>
      <span className="text-xs text-mono-medium">{label}:</span>
      <span className="text-xs font-medium text-mono-dark">{value}</span>
    </div>
  );
}

export function GettingStartedChecklist({
  setupStatus,
  taxYear,
}: {
  setupStatus?: Record<StepId, boolean>;
  taxYear: number;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<OnboardingProgress>({});
  const [loading, setLoading] = useState(true);
  const [notificationPrefKey, setNotificationPrefKey] = useState<string | null>(null);
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [filingStatus, setFilingStatus] = useState<FilingStatus | null>(null);
  const [businessIndustry, setBusinessIndustry] = useState<string>("");
  const [industryInput, setIndustryInput] = useState<string>("");
  const [expectedIncomeRange, setExpectedIncomeRange] = useState<string | null>(null);
  const [savingStep, setSavingStep] = useState<StepId | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/profile").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/org-settings").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/notification-preferences").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/api/tax-year-settings?tax_year=${encodeURIComponent(String(taxYear))}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([profileBody, orgBody, notifBody, taxBody]) => {
        const p = profileBody?.data?.onboarding_progress ?? {};
        setProgress(typeof p === "object" && p !== null ? p : {});

        const orgData = orgBody?.data ?? null;
        if (orgData?.filing_type) setBusinessType(orgData.filing_type);
        if (orgData?.personal_filing_status === "single" || orgData?.personal_filing_status === "married_filing_jointly") {
          setFilingStatus(orgData.personal_filing_status);
        }
        if (orgData?.business_industry) {
          setBusinessIndustry(orgData.business_industry);
          setIndustryInput(orgData.business_industry);
        }

        const pref = notifBody?.data;
        if (pref?.type && pref?.value) setNotificationPrefKey(`${pref.type}:${pref.value}`);

        const taxRow = Array.isArray(taxBody?.data) ? taxBody.data[0] : null;
        if (taxRow?.expected_income_range) setExpectedIncomeRange(taxRow.expected_income_range);
      })
      .finally(() => setLoading(false));
  }, [taxYear]);

  const updateProgress = useCallback(async (next: OnboardingProgress) => {
    setProgress(next);
    await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboarding_progress: next }),
    });
  }, []);

  function isStepDone(id: StepId): boolean {
    if (progress[id]) return true;
    if (setupStatus?.[id]) return true;
    if (id === "notification_frequency" && !!notificationPrefKey) return true;
    if (id === "business_type" && !!businessType) return true;
    if (id === "filing_status" && !!filingStatus) return true;
    if (id === "business_industry" && !!businessIndustry) return true;
    if (id === "expected_income" && !!expectedIncomeRange) return true;
    return false;
  }

  function isUnlocked(id: StepId): boolean {
    const idx = STEP_ORDER.indexOf(id);
    if (idx <= 0) return true;
    return STEP_ORDER.slice(0, idx).every((stepId) => isStepDone(stepId));
  }

  const completedCount = STEP_ORDER.filter((id) => isStepDone(id)).length;
  const allDone = completedCount === STEP_ORDER.length;

  async function markStepDone(id: StepId) {
    const next = { ...progress, [id]: true };
    await updateProgress(next);
  }

  async function saveOrgSettings(changes: Record<string, unknown>) {
    const res = await fetch("/api/org-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    return res.ok;
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      setProgress((prev) => {
        const next = { ...prev, what_can_i_deduct: true };
        void updateProgress(next);
        return next;
      });
    };
    window.addEventListener("what-can-i-deduct-completed", handler as EventListener);
    return () => window.removeEventListener("what-can-i-deduct-completed", handler as EventListener);
  }, [updateProgress]);

  if (loading || allDone) return null;

  const incomeOptions = filingStatus ? INCOME_BRACKETS[filingStatus] : [];

  function notifLabel(): string {
    if (!notificationPrefKey) return "";
    return NOTIFICATION_OPTIONS.find((o) => `${o.type}:${o.value}` === notificationPrefKey)?.label ?? notificationPrefKey;
  }
  function bizTypeLabel(): string {
    return BUSINESS_TYPES.find((o) => o.value === businessType)?.label ?? businessType ?? "";
  }
  function filingLabel(): string {
    if (filingStatus === "single") return "Single";
    if (filingStatus === "married_filing_jointly") return "Jointly";
    return "";
  }
  function incomeLabel(): string {
    if (!filingStatus || !expectedIncomeRange) return "";
    return INCOME_BRACKETS[filingStatus]?.find((o) => o.id === expectedIncomeRange)?.label ?? expectedIncomeRange;
  }

  return (
    <section className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7]">
      <div className="px-4 py-3">
        <div role="heading" aria-level={2} className="text-base md:text-lg font-normal font-sans text-mono-dark">
          Start here
        </div>
        <p className="text-xs text-mono-medium mt-1 font-sans">
          {completedCount} of {STEP_ORDER.length} action steps complete.
        </p>
        <p className="text-xs text-mono-medium mt-2">
          <Link href="/setup" className="font-medium text-sovereign-blue hover:underline">
            Prefer a short walkthrough?
          </Link>{" "}
          — hustle type, deductions, then connect your bank.
        </p>
      </div>

      <div className="px-4 py-3 space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-none bg-[#F0F1F7] overflow-hidden">
            <div
              className="h-full rounded-none bg-[#8A9BB0] transition-all duration-300"
              style={{ width: `${(completedCount / STEP_ORDER.length) * 100}%` }}
            />
          </div>
          <span className="text-[11px] tabular-nums font-medium text-mono-medium shrink-0">
            {Math.round((completedCount / STEP_ORDER.length) * 100)}%
          </span>
        </div>

        <div className="space-y-4">
          {/* STEP 1 — Notification frequency */}
          <div className={`py-1 ${!isUnlocked("notification_frequency") ? "opacity-50 pointer-events-none" : ""}`}>
            <p className="text-[11px] font-semibold tracking-wide text-mono-light">STEP 1</p>
            {isStepDone("notification_frequency") ? (
              <StepDone label="Notifications" value={notifLabel()} />
            ) : (
              <>
                <p className="text-sm font-medium text-mono-dark mt-1">How often would you like to get notified?</p>
                <p className="text-xs text-mono-medium mt-1">Choose one option to start your setup.</p>
                <div className="mt-2 overflow-x-auto">
                  <div className="inline-flex items-center gap-2 whitespace-nowrap pb-1">
                    {NOTIFICATION_OPTIONS.map((option) => {
                      const key = `${option.type}:${option.value}`;
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={savingStep === "notification_frequency"}
                          onClick={async () => {
                            setSavingStep("notification_frequency");
                            try {
                              const res = await fetch("/api/notification-preferences", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ type: option.type, value: option.value }),
                              });
                              if (!res.ok) return;
                              setNotificationPrefKey(key);
                              await markStepDone("notification_frequency");
                            } finally {
                              setSavingStep(null);
                            }
                          }}
                          className="px-3 py-2 text-xs font-medium rounded-none transition-colors bg-[#F0F1F7] text-mono-dark hover:bg-[#E4E7F0]"
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* STEP 2 — Business type */}
          <div className={`py-1 border-t border-[#F0F1F7] ${!isUnlocked("business_type") ? "opacity-50 pointer-events-none" : ""}`}>
            <p className="text-[11px] font-semibold tracking-wide text-mono-light">STEP 2</p>
            {isStepDone("business_type") ? (
              <StepDone label="Business type" value={bizTypeLabel()} />
            ) : (
              <>
                <p className="text-sm font-medium text-mono-dark mt-1">What type of business do you have?</p>
                <p className="text-xs text-mono-medium mt-1">This helps us tailor your tax setup.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {BUSINESS_TYPES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={savingStep === "business_type"}
                      onClick={async () => {
                        setSavingStep("business_type");
                        try {
                          const ok = await saveOrgSettings({ filing_type: option.value });
                          if (!ok) return;
                          setBusinessType(option.value);
                          await markStepDone("business_type");
                        } finally {
                          setSavingStep(null);
                        }
                      }}
                      className="px-3 py-2 text-xs font-medium rounded-none transition-colors bg-[#F0F1F7] text-mono-dark hover:bg-[#E4E7F0]"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* STEP 3 — Filing status */}
          <div className={`py-1 border-t border-[#F0F1F7] ${!isUnlocked("filing_status") ? "opacity-50 pointer-events-none" : ""}`}>
            <p className="text-[11px] font-semibold tracking-wide text-mono-light">STEP 3</p>
            {isStepDone("filing_status") ? (
              <StepDone label="Filing status" value={filingLabel()} />
            ) : (
              <>
                <p className="text-sm font-medium text-mono-dark mt-1">How do you file?</p>
                <p className="text-xs text-mono-medium mt-1">Choose single or jointly with your spouse.</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={savingStep === "filing_status"}
                    onClick={async () => {
                      setSavingStep("filing_status");
                      try {
                        const ok = await saveOrgSettings({ personal_filing_status: "single" });
                        if (!ok) return;
                        setFilingStatus("single");
                        await markStepDone("filing_status");
                      } finally {
                        setSavingStep(null);
                      }
                    }}
                    className="px-3 py-2 text-xs font-medium rounded-none transition-colors bg-[#F0F1F7] text-mono-dark hover:bg-[#E4E7F0]"
                  >
                    Single
                  </button>
                  <button
                    type="button"
                    disabled={savingStep === "filing_status"}
                    onClick={async () => {
                      setSavingStep("filing_status");
                      try {
                        const ok = await saveOrgSettings({ personal_filing_status: "married_filing_jointly" });
                        if (!ok) return;
                        setFilingStatus("married_filing_jointly");
                        await markStepDone("filing_status");
                      } finally {
                        setSavingStep(null);
                      }
                    }}
                    className="px-3 py-2 text-xs font-medium rounded-none transition-colors bg-[#F0F1F7] text-mono-dark hover:bg-[#E4E7F0]"
                  >
                    Jointly
                  </button>
                </div>
              </>
            )}
          </div>

          {/* STEP 4 — Business industry */}
          <div className={`py-1 border-t border-[#F0F1F7] ${!isUnlocked("business_industry") ? "opacity-50 pointer-events-none" : ""}`}>
            <p className="text-[11px] font-semibold tracking-wide text-mono-light">STEP 4</p>
            {isStepDone("business_industry") ? (
              <StepDone label="Industry" value={businessIndustry} />
            ) : (
              <>
                <p className="text-sm font-medium text-mono-dark mt-1">What industry is your business in?</p>
                <p className="text-xs text-mono-medium mt-1">This helps AI determine if transactions are likely deductions.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {INDUSTRY_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={savingStep === "business_industry"}
                      onClick={async () => {
                        setSavingStep("business_industry");
                        try {
                          const ok = await saveOrgSettings({ business_industry: preset });
                          if (!ok) return;
                          setBusinessIndustry(preset);
                          setIndustryInput(preset);
                          await markStepDone("business_industry");
                        } finally {
                          setSavingStep(null);
                        }
                      }}
                      className="px-3 py-2 text-xs font-medium rounded-none transition-colors bg-[#F0F1F7] text-mono-dark hover:bg-[#E4E7F0]"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <div className="mt-2">
                  <input
                    type="text"
                    value={industryInput}
                    onChange={(e) => setIndustryInput(e.target.value)}
                    placeholder="Or type your industry and press Enter..."
                    disabled={savingStep === "business_industry"}
                    className="border border-[#F0F1F7] px-3 py-2 text-xs text-mono-dark bg-white rounded-none focus:border-black outline-none w-full"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && industryInput.trim()) {
                        e.preventDefault();
                        const val = industryInput.trim();
                        setSavingStep("business_industry");
                        void (async () => {
                          try {
                            const ok = await saveOrgSettings({ business_industry: val });
                            if (!ok) return;
                            setBusinessIndustry(val);
                            await markStepDone("business_industry");
                          } finally {
                            setSavingStep(null);
                          }
                        })();
                      }
                    }}
                  />
                </div>
              </>
            )}
          </div>

          {/* STEP 5 — Expected income */}
          <div className={`py-1 border-t border-[#F0F1F7] ${!isUnlocked("expected_income") ? "opacity-50 pointer-events-none" : ""}`}>
            <p className="text-[11px] font-semibold tracking-wide text-mono-light">STEP 5</p>
            {isStepDone("expected_income") ? (
              <StepDone label="Expected income" value={incomeLabel()} />
            ) : (
              <>
                <p className="text-sm font-medium text-mono-dark mt-1">Expected income (business + personal)</p>
                <p className="text-xs text-mono-medium mt-1">Choose your expected range to set your tax savings rate.</p>
                {!filingStatus ? (
                  <p className="mt-2 text-xs text-mono-light">Select your filing status first to unlock income ranges.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {incomeOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        disabled={savingStep === "expected_income"}
                        onClick={async () => {
                          setSavingStep("expected_income");
                          try {
                            const res = await fetch("/api/tax-year-settings", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                tax_year: taxYear,
                                tax_rate: option.taxRate,
                                expected_income_range: option.id,
                              }),
                            });
                            if (!res.ok) return;
                            setExpectedIncomeRange(option.id);
                            await markStepDone("expected_income");
                          } finally {
                            setSavingStep(null);
                          }
                        }}
                        className="inline-flex text-left px-3 py-2 mr-2 text-xs font-medium rounded-none transition-colors bg-[#F0F1F7] text-mono-dark hover:bg-[#E4E7F0]"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* STEP 6 — What can I deduct */}
          <div className={`py-1 border-t border-[#F0F1F7] ${!isUnlocked("what_can_i_deduct") ? "opacity-50 pointer-events-none" : ""}`}>
            <p className="text-[11px] font-semibold tracking-wide text-mono-light">STEP 6</p>
            {isStepDone("what_can_i_deduct") ? (
              <StepDone label="Deductions" value="Completed" />
            ) : (
              <>
                <p className="text-sm font-medium text-mono-dark mt-1">What can I deduct?</p>
                <p className="text-xs text-mono-medium mt-1">Walk through common deductions and IRS guidance.</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window === "undefined") return;
                      window.dispatchEvent(new CustomEvent("open-what-can-i-deduct"));
                    }}
                    className="px-3 py-2 text-sm font-medium font-sans bg-[#2563EB] text-white rounded-none hover:bg-[#1D4ED8] transition-colors"
                  >
                    Learn here
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void markStepDone("what_can_i_deduct");
                    }}
                    className="px-3 py-2 text-sm font-medium font-sans bg-[#F0F1F7] text-mono-dark rounded-none hover:bg-[#E4E7F0] transition-colors"
                  >
                    Skip
                  </button>
                </div>
              </>
            )}
          </div>

          {/* STEP 7 — Link account */}
          <div className={`py-1 border-t border-[#F0F1F7] ${!isUnlocked("link_account") ? "opacity-50 pointer-events-none" : ""}`}>
            <p className="text-[11px] font-semibold tracking-wide text-mono-light">STEP 7</p>
            {isStepDone("link_account") ? (
              <StepDone label="Account" value="Linked" />
            ) : (
              <>
                <p className="text-sm font-medium text-mono-dark mt-1">Link your first account</p>
                <p className="text-xs text-mono-medium mt-1">Pair an account to start pulling in your transactions.</p>
                <button
                  type="button"
                  onClick={() => {
                    void markStepDone("link_account");
                    router.push("/data-sources?add=1");
                  }}
                  className="mt-2 inline-flex px-3 py-2 text-sm font-medium font-sans bg-black text-white rounded-none hover:bg-black/85 transition-colors"
                >
                  Pair Account
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
