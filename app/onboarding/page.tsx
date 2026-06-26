"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import type { TrialStatusResult } from "@/lib/billing/trial";
import {
  FILING_STATUS_OPTIONS,
  INCOME_BRACKETS,
  parseFilingStatus,
  type FilingStatus,
} from "@/lib/tax/filing-status";

type StepId = "email" | "profile" | "reminders" | "industry" | "connect";

type OnboardingData = {
  userId: string;
  email: string | null;
  emailVerified: boolean;
  firstName: string | null;
  profile: {
    expectedIncome: number | null;
    expectedIncomeRange: string | null;
    entityType: string | null;
    filingStatus: string | null;
    triageReminderFrequency: string | null;
    industry: string | null;
    industryCustom: string | null;
  };
  steps: Record<StepId, boolean>;
  completed: boolean;
  trial: TrialStatusResult;
};

type PendingLink = {
  public_token: string;
  metadata: {
    institution?: { institution_id?: string; name?: string };
    accounts?: Array<{ id?: string; name?: string; type?: string; subtype?: string; mask?: string }>;
  };
};

type LookbackOption =
  | { label: string; kind: "days"; days: number }
  | { label: string; kind: "month_start" }
  | { label: string; kind: "year_start" }
  | { label: string; kind: "all" };

const STEPS: Array<{ id: StepId; eyebrow: string; title: string; sub: string }> = [
  {
    id: "email",
    eyebrow: "Step 1",
    title: "Verify your email.",
    sub: "One quick confirmation so we can protect your account and send tax reminders to the right inbox.",
  },
  {
    id: "profile",
    eyebrow: "Step 2",
    title: "Set your tax profile.",
    sub: "A starting estimate is enough. You can adjust it any time.",
  },
  {
    id: "reminders",
    eyebrow: "Step 3",
    title: "Choose your triage rhythm.",
    sub: "We will nudge you only as often as you want to sort new transactions.",
  },
  {
    id: "industry",
    eyebrow: "Step 4",
    title: "Pick your industry.",
    sub: "This tunes deduction suggestions for the way you earn.",
  },
  {
    id: "connect",
    eyebrow: "Step 5",
    title: "Sync your first account.",
    sub: "Connect securely, choose your import controls, then head straight into Tax Triage.",
  },
];

const ENTITY_OPTIONS = [
  { id: "sole_prop", label: "Sole proprietor", hint: "Most creators and side hustlers" },
  { id: "llc", label: "LLC", hint: "Single or multi-member LLC" },
  { id: "s_corp", label: "S Corp", hint: "Payroll plus owner distributions" },
  { id: "partnership", label: "Partnership", hint: "Shared ownership" },
  { id: "other", label: "Other", hint: "Not sure yet" },
];

const FILING_OPTIONS = FILING_STATUS_OPTIONS.map((option) => ({ id: option.value, label: option.label }));

const REMINDER_OPTIONS = [
  { id: "daily", label: "Daily", hint: "High-volume shops" },
  { id: "weekly", label: "Weekly", hint: "Recommended" },
  { id: "biweekly", label: "Every two weeks", hint: "A calmer cadence" },
  { id: "monthly", label: "Monthly", hint: "Batch it all at once" },
];

const INDUSTRY_OPTIONS = [
  { id: "content_creator", label: "Content creator", hint: "Sponsors, gear, editing tools" },
  { id: "freelance_design", label: "Freelance design", hint: "Software, contractors, assets" },
  { id: "online_seller", label: "Online seller", hint: "Inventory, shipping, marketplaces" },
  { id: "coach_consultant", label: "Coach or consultant", hint: "Calls, travel, subscriptions" },
  { id: "rideshare_delivery", label: "Rideshare or delivery", hint: "Mileage, phone, supplies" },
  { id: "photography_video", label: "Photo or video", hint: "Equipment, locations, editing" },
  { id: "custom", label: "Create your own", hint: "Name your exact niche" },
];

const LOOKBACK_OPTIONS: LookbackOption[] = [
  { label: "This month", kind: "month_start" },
  { label: "This year", kind: "year_start" },
  { label: "Last 30 days", kind: "days", days: 30 },
  { label: "Last 60 days", kind: "days", days: 60 },
  { label: "Last twelve months", kind: "days", days: 365 },
  { label: "All available", kind: "all" },
];

const IMPORT_STEPS = [
  "Securely connecting to your bank...",
  "Verifying account credentials...",
  "Pulling account details...",
  "Setting up transaction history...",
  "Importing transactions...",
  "Organizing your data...",
  "Opening Tax Triage...",
];

function lookbackStartDate(opt: LookbackOption): string | null {
  if (opt.kind === "all") return null;
  if (opt.kind === "month_start") {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }
  if (opt.kind === "year_start") return `${new Date().getFullYear()}-01-01`;
  const d = new Date();
  d.setDate(d.getDate() - opt.days);
  return d.toISOString().slice(0, 10);
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="onb-kbd">{children}</kbd>;
}

function normalizeFilingStatus(value: string | null | undefined): FilingStatus {
  if (value === "married_joint") return "married_filing_jointly";
  if (value === "married_separate") return "married_filing_separately";
  return parseFilingStatus(value) ?? "single";
}

function rangeBounds(rangeId: string): { min: number; max: number | null } | null {
  const [, rawRange] = rangeId.split(":");
  if (!rawRange) return null;
  if (rawRange.endsWith("-plus")) {
    const min = Number(rawRange.replace("-plus", ""));
    return Number.isFinite(min) ? { min, max: null } : null;
  }
  const [min, max] = rawRange.split("-").map((value) => Number(value));
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

function bracketForIncome(status: FilingStatus, income: number | null): string {
  const brackets = INCOME_BRACKETS[status];
  if (!income || !Number.isFinite(income)) return brackets[2]?.id ?? brackets[0]?.id ?? "";
  return brackets.find((bracket) => {
    const bounds = rangeBounds(bracket.id);
    if (!bounds) return false;
    return income >= bounds.min && (bounds.max == null || income <= bounds.max);
  })?.id ?? brackets[0]?.id ?? "";
}

export default function OnboardingPage() {
  const router = useRouter();
  const importTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [data, setData] = useState<OnboardingData | null>(null);
  const [active, setActive] = useState<StepId>("email");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const [entityType, setEntityType] = useState("sole_prop");
  const [filingStatus, setFilingStatus] = useState<FilingStatus>("single");
  const [incomeRange, setIncomeRange] = useState("");
  const [reminder, setReminder] = useState("weekly");
  const [industry, setIndustry] = useState("content_creator");
  const [customIndustry, setCustomIndustry] = useState("");

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [pendingLink, setPendingLink] = useState<PendingLink | null>(null);
  const [selectedLookback, setSelectedLookback] = useState(4);
  const [importModalStep, setImportModalStep] = useState<"lookback" | "accounts">("lookback");
  const [accountTxnPrefs, setAccountTxnPrefs] = useState<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importStep, setImportStep] = useState(0);
  const [importPct, setImportPct] = useState(6);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/onboarding", { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/login?next=/onboarding");
      return;
    }
    const next = (await res.json()) as OnboardingData;
    const nextFilingStatus = normalizeFilingStatus(next.profile.filingStatus);
    setData(next);
    setEntityType(next.profile.entityType ?? "sole_prop");
    setFilingStatus(nextFilingStatus);
    setIncomeRange(
      next.profile.expectedIncomeRange ??
      bracketForIncome(nextFilingStatus, next.profile.expectedIncome ?? 75000)
    );
    setReminder(next.profile.triageReminderFrequency ?? "weekly");
    setIndustry(next.profile.industry ?? "content_creator");
    setCustomIndustry(next.profile.industryCustom ?? "");
    const firstOpen = STEPS.find((step) => !next.steps[step.id])?.id ?? "connect";
    setActive(firstOpen);
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return () => {
      if (importTimer.current) clearInterval(importTimer.current);
    };
  }, []);

  const activeIndex = STEPS.findIndex((step) => step.id === active);
  const completedCount = data ? STEPS.filter((step) => data.steps[step.id]).length : 0;
  const canUseFlow = Boolean(data?.emailVerified);
  const incomeOptions = INCOME_BRACKETS[filingStatus] ?? [];

  function handleFilingStatusChange(value: string) {
    const next = normalizeFilingStatus(value);
    setFilingStatus(next);
    setIncomeRange(INCOME_BRACKETS[next]?.[2]?.id ?? INCOME_BRACKETS[next]?.[0]?.id ?? "");
  }

  const saveStep = useCallback(async (payload: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not save onboarding.");
      await refresh();
      window.dispatchEvent(new CustomEvent("onboarding:step-complete"));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save onboarding.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [refresh]);

  const continueFromProfile = useCallback(async () => {
    if (!incomeRange) {
      setError("Choose the IRS income range that best matches your expected profit.");
      return;
    }
    const ok = await saveStep({
      step: "profile",
      expectedIncomeRange: incomeRange,
      entityType,
      filingStatus,
    });
    if (ok) setActive("reminders");
  }, [entityType, filingStatus, incomeRange, saveStep]);

  const continueFromReminder = useCallback(async () => {
    const ok = await saveStep({
      step: "reminders",
      triageReminderFrequency: reminder,
    });
    if (ok) setActive("industry");
  }, [reminder, saveStep]);

  const continueFromIndustry = useCallback(async () => {
    if (industry === "custom" && !customIndustry.trim()) {
      setError("Name your industry before continuing.");
      return;
    }
    const ok = await saveStep({
      step: "industry",
      industry,
      industryCustom: customIndustry,
    });
    if (ok) setActive("connect");
  }, [customIndustry, industry, saveStep]);

  const handleResend = async () => {
    if (!data?.email) return;
    setResending(true);
    setError(null);
    try {
      const res = await fetch("/api/email/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, userId: data.userId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not send verification email.");
      setResent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send verification email.");
    } finally {
      setResending(false);
    }
  };

  const handleVerify = useCallback(() => {
    if (!code.trim()) {
      setError("Enter the verification code from your email.");
      return;
    }
    router.push("/auth/verify?token=" + encodeURIComponent(code.trim()));
  }, [code, router]);

  async function openPlaidLink() {
    setLinking(true);
    setError(null);
    try {
      const res = await fetch("/api/data-sources/plaid/create-link-token", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not start secure account link.");
      setLinkToken(body.link_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start secure account link.");
      setLinking(false);
    }
  }

  const { open: openLink, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token, metadata) => {
      setLinking(false);
      setLinkToken(null);
      setImportModalStep("lookback");
      setAccountTxnPrefs({});
      setPendingLink({ public_token, metadata: metadata as PendingLink["metadata"] });
    },
    onExit: () => {
      setLinking(false);
      setLinkToken(null);
    },
  });

  useEffect(() => {
    if (linkToken && ready) openLink();
  }, [linkToken, ready, openLink]);

  async function finishConnection() {
    setImporting(true);
    setImportError(null);
    setImportStep(0);
    setImportPct(6);

    if (importTimer.current) clearInterval(importTimer.current);
    let step = 0;
    importTimer.current = setInterval(() => {
      step += 1;
      setImportStep(Math.min(step, IMPORT_STEPS.length - 2));
      setImportPct(Math.min(6 + step * 14, 86));
    }, 900);

    try {
      if (!pendingLink) return;
      const opt = LOOKBACK_OPTIONS[selectedLookback];
      const exchange = await fetch("/api/data-sources/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_token: pendingLink.public_token,
          metadata: pendingLink.metadata,
          start_date: opt ? lookbackStartDate(opt) : null,
          account_prefs: accountTxnPrefs,
        }),
      });
      const exchangeBody = await exchange.json().catch(() => ({}));
      if (!exchange.ok) throw new Error(exchangeBody.error ?? "Import failed.");

      const syncIds: string[] = exchangeBody?.syncIds ?? exchangeBody?.dataSourceIds ?? [];
      if (syncIds.length > 0) {
        await Promise.allSettled(
          syncIds.map((id) =>
            fetch("/api/data-sources/plaid/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ dataSourceId: id }),
            })
          )
        );
        await fetch("/api/triage/apply-rules", { method: "POST" }).catch(() => {});
      }

      setImportStep(IMPORT_STEPS.length - 1);
      setImportPct(100);
      await saveStep({ step: "connect", complete: true });
      setPendingLink(null);
      router.push("/triage");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      if (importTimer.current) clearInterval(importTimer.current);
      setImporting(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || pendingLink || importing) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTextInput = tag === "input" || tag === "textarea";
      const key = e.key.toLowerCase();

      if (key >= "1" && key <= "9") {
        const index = Number(key) - 1;
        if (active === "profile" && !isTextInput) {
          if (ENTITY_OPTIONS[index]) setEntityType(ENTITY_OPTIONS[index].id);
          e.preventDefault();
        } else if (active === "reminders" && REMINDER_OPTIONS[index]) {
          setReminder(REMINDER_OPTIONS[index].id);
          e.preventDefault();
        } else if (active === "industry" && INDUSTRY_OPTIONS[index]) {
          setIndustry(INDUSTRY_OPTIONS[index].id);
          e.preventDefault();
        }
      }

      if (e.key !== "Enter") return;
      e.preventDefault();
      if (active === "email") {
        if (data?.emailVerified) setActive("profile");
        else handleVerify();
      } else if (active === "profile" && canUseFlow) {
        void continueFromProfile();
      } else if (active === "reminders" && canUseFlow) {
        void continueFromReminder();
      } else if (active === "industry" && canUseFlow) {
        void continueFromIndustry();
      } else if (active === "connect" && canUseFlow) {
        void openPlaidLink();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    active,
    canUseFlow,
    continueFromIndustry,
    continueFromProfile,
    continueFromReminder,
    data?.emailVerified,
    handleVerify,
    importing,
    pendingLink,
  ]);

  const stageLabel = useMemo(() => {
    if (!data) return "Loading";
    return `${completedCount} of ${STEPS.length} complete`;
  }, [completedCount, data]);

  if (!data) {
    return <div className="onb-flow-loading">Preparing onboarding...</div>;
  }

  return (
    <div className="onb-flow">
      <aside className="onb-flow__rail">
        <div className="onb-flow__brand">Expense Terminal</div>
        <div className="onb-flow__progress">
          <span>{stageLabel}</span>
          <i style={{ width: `${(completedCount / STEPS.length) * 100}%` }} />
        </div>
        <nav className="onb-flow__steps" aria-label="Onboarding steps">
          {STEPS.map((step, index) => {
            const locked = step.id !== "email" && !canUseFlow;
            const done = data.steps[step.id];
            return (
              <button
                key={step.id}
                type="button"
                className={`onb-flow-step${active === step.id ? " is-active" : ""}${done ? " is-done" : ""}`}
                disabled={locked || index > activeIndex + 1}
                onClick={() => setActive(step.id)}
              >
                <span>{done ? "OK" : index + 1}</span>
                <b>{step.title}</b>
              </button>
            );
          })}
        </nav>
        <p className="onb-flow__hint">Press <Kbd>Enter</Kbd> to accept the selected answer and continue.</p>
      </aside>

      <main className="onb-flow__main">
        <section className="onb-flow__card">
          <div className="onb-flow__eyebrow">{STEPS[activeIndex]?.eyebrow ?? "Onboarding"}</div>
          <h1>{STEPS[activeIndex]?.title}</h1>
          <p className="onb-flow__sub">{STEPS[activeIndex]?.sub}</p>

          {error && <div className="onb-flow__error">{error}</div>}

          {active === "email" && (
            <div className="onb-panel">
              <div className={`onb-verify${data.emailVerified ? " is-verified" : ""}`}>
                <div>
                  <span className="onb-verify__label">Email</span>
                  <strong>{data.email ?? "Your account email"}</strong>
                </div>
                <span>{data.emailVerified ? "Verified" : "Waiting"}</span>
              </div>
              {!data.emailVerified ? (
                <>
                  <input
                    className="onb-flow-input"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="ark-the-olive-dove"
                    autoFocus
                  />
                  <div className="onb-flow-actions">
                    <button className="onb-flow-btn onb-flow-btn--ghost" type="button" onClick={handleResend} disabled={resending}>
                      {resending ? "Sending..." : resent ? "Sent again" : "Resend email"}
                    </button>
                    <button className="onb-flow-btn" type="button" onClick={handleVerify}>
                      Verify and continue <Kbd>Enter</Kbd>
                    </button>
                  </div>
                  <button className="onb-flow-link" type="button" onClick={() => void refresh()}>
                    I already verified. Check again.
                  </button>
                </>
              ) : (
                <div className="onb-flow-actions">
                  <button className="onb-flow-btn" type="button" onClick={() => setActive("profile")}>
                    Continue <Kbd>Enter</Kbd>
                  </button>
                </div>
              )}
            </div>
          )}

          {active === "profile" && (
            <div className="onb-panel">
              <ChoiceGrid label="Filing status" options={FILING_OPTIONS} value={filingStatus} onChange={handleFilingStatusChange} compact />
              <IncomeRangePicker options={incomeOptions} value={incomeRange} onChange={setIncomeRange} />
              <ChoiceGrid label="Business type" options={ENTITY_OPTIONS} value={entityType} onChange={setEntityType} />
              <div className="onb-flow-actions">
                <button className="onb-flow-btn" type="button" disabled={saving} onClick={() => void continueFromProfile()}>
                  {saving ? "Saving..." : "Continue"} <Kbd>Enter</Kbd>
                </button>
              </div>
            </div>
          )}

          {active === "reminders" && (
            <div className="onb-panel">
              <ChoiceGrid label="Reminder cadence" options={REMINDER_OPTIONS} value={reminder} onChange={setReminder} />
              <div className="onb-flow-actions">
                <button className="onb-flow-btn" type="button" disabled={saving} onClick={() => void continueFromReminder()}>
                  {saving ? "Saving..." : "Use {0}".replace("{0}", REMINDER_OPTIONS.find((o) => o.id === reminder)?.label ?? "Weekly")} <Kbd>Enter</Kbd>
                </button>
              </div>
            </div>
          )}

          {active === "industry" && (
            <div className="onb-panel">
              <ChoiceGrid label="Industry" options={INDUSTRY_OPTIONS} value={industry} onChange={setIndustry} />
              {industry === "custom" && (
                <input
                  className="onb-flow-input"
                  value={customIndustry}
                  onChange={(e) => setCustomIndustry(e.target.value)}
                  placeholder="Tell us your niche"
                  autoFocus
                />
              )}
              <div className="onb-flow-actions">
                <button className="onb-flow-btn" type="button" disabled={saving} onClick={() => void continueFromIndustry()}>
                  {saving ? "Saving..." : "Continue"} <Kbd>Enter</Kbd>
                </button>
              </div>
            </div>
          )}

          {active === "connect" && (
            <div className="onb-panel onb-connect">
              <h2>Bring in the first batch.</h2>
              <p>
                Pick how far back to import, choose which accounts bring in transactions, then start sorting in Tax Triage.
              </p>
              <button className="onb-flow-btn" type="button" disabled={linking || saving} onClick={openPlaidLink}>
                {linking ? "Opening secure link..." : "Connect account"} <Kbd>Enter</Kbd>
              </button>
            </div>
          )}
        </section>
      </main>

      {typeof document !== "undefined" && pendingLink && !importing && importModalStep === "lookback" && createPortal(
        <div className="acc-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="onb-import-title">
          <div className="acc-modal">
            <div className="acc-modal__head">
              <div>
                <h2 id="onb-import-title" className="acc-modal__title">How far back should we pull?</h2>
                <p className="acc-modal__sub">{pendingLink.metadata?.institution?.name ?? "Your bank"} transaction history</p>
              </div>
            </div>
            <div className="acc-modal__body" style={{ gap: 8 }}>
              {LOOKBACK_OPTIONS.map((opt, i) => (
                <button
                  key={opt.label}
                  type="button"
                  className={`onb-modal-choice${selectedLookback === i ? " is-active" : ""}`}
                  onClick={() => setSelectedLookback(i)}
                >
                  <span />
                  {opt.label}
                  {opt.kind === "days" && opt.days === 365 && <em>Recommended</em>}
                </button>
              ))}
            </div>
            <div className="acc-modal__actions" style={{ flexDirection: "row", justifyContent: "flex-end", paddingTop: 16 }}>
              <button type="button" className="btn btn--ghost" onClick={() => setPendingLink(null)}>Cancel</button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  const prefs: Record<string, boolean> = {};
                  for (const acc of pendingLink.metadata?.accounts ?? []) prefs[acc.id ?? ""] = true;
                  setAccountTxnPrefs(prefs);
                  setImportModalStep("accounts");
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {typeof document !== "undefined" && pendingLink && !importing && importModalStep === "accounts" && createPortal(
        <div className="acc-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="onb-accounts-title">
          <div className="acc-modal">
            <div className="acc-modal__head">
              <div>
                <h2 id="onb-accounts-title" className="acc-modal__title">What should we import?</h2>
                <p className="acc-modal__sub">{pendingLink.metadata?.institution?.name ?? "Your bank"} account controls</p>
              </div>
            </div>
            <div className="acc-modal__body" style={{ gap: 0 }}>
              {(pendingLink.metadata?.accounts ?? []).map((acc) => {
                const key = acc.id ?? "";
                const wantsTxn = accountTxnPrefs[key] ?? true;
                return (
                  <div key={key} className="acc-txn-pref-row">
                    <div className="acc-txn-pref-info">
                      <span className="acc-txn-pref-name">{acc.name ?? "Account"}</span>
                      <span className="acc-txn-pref-type">{acc.subtype ?? acc.type ?? "Account"}</span>
                    </div>
                    <div className="acc-txn-pref-toggle">
                      <button type="button" className={`acc-txn-pref-btn${wantsTxn ? " is-active" : ""}`} onClick={() => setAccountTxnPrefs((p) => ({ ...p, [key]: true }))}>
                        Transactions
                      </button>
                      <button type="button" className={`acc-txn-pref-btn${!wantsTxn ? " is-active" : ""}`} onClick={() => setAccountTxnPrefs((p) => ({ ...p, [key]: false }))}>
                        Transactions off
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="acc-modal__actions" style={{ flexDirection: "row", justifyContent: "flex-end", paddingTop: 16 }}>
              <button type="button" className="btn btn--ghost" onClick={() => setImportModalStep("lookback")}>Back</button>
              <button type="button" className="btn btn--primary" onClick={() => void finishConnection()}>Start import</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {typeof document !== "undefined" && (importing || importError) && createPortal(
        <div className="acc-modal-backdrop" role="dialog" aria-modal="true">
          <div className="acc-modal" style={{ padding: 0 }}>
            {importError ? (
              <div className="acc-import-progress">
                <div className="acc-import-progress__title">Import failed</div>
                <div className="acc-import-progress__status" style={{ color: "var(--ember-deep)" }}>{importError}</div>
                <button type="button" className="btn btn--ghost" onClick={() => setImportError(null)}>Dismiss</button>
              </div>
            ) : (
              <div className="acc-import-progress">
                <div className="acc-import-progress__title">Importing account</div>
                <div className="acc-import-progress__track">
                  <div className="acc-import-progress__fill" style={{ width: `${importPct}%` }} />
                </div>
                <div key={importStep} className="acc-import-progress__status">{IMPORT_STEPS[importStep]}</div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function ChoiceGrid({
  label,
  options,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  options: Array<{ id: string; label: string; hint?: string }>;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="onb-choice-block">
      <div className="onb-flow-label">{label}</div>
      <div className={`onb-choice-grid${compact ? " onb-choice-grid--compact" : ""}`}>
        {options.map((option, index) => (
          <button
            key={option.id}
            type="button"
            className={`onb-choice${value === option.id ? " is-active" : ""}`}
            onClick={() => onChange(option.id)}
          >
            <span className="onb-choice__key">{index + 1}</span>
            <span>
              <b>{option.label}</b>
              {option.hint && <em>{option.hint}</em>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function IncomeRangePicker({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; label: string; taxRate: number }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="onb-choice-block">
      <div>
        <p className="onb-flow-label">IRS federal income range</p>
        <p className="onb-income-note">Choose the bracket that best matches expected self-employed profit. We use this for set-aside estimates.</p>
      </div>
      <div className="onb-bracket-grid">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`onb-bracket${value === option.id ? " is-active" : ""}`}
            onClick={() => onChange(option.id)}
          >
            <span>{option.label.replace(/\s\(\d+%\)$/, "")}</span>
            <b>{Math.round(option.taxRate * 100)}%</b>
          </button>
        ))}
      </div>
    </div>
  );
}
