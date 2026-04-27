"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { validatePassword } from "@/lib/validation/password";
import { OtpSixInputs } from "@/components/onboarding/OtpSixInputs";
import {
  SIGNUP_FLOW_KEY,
  type SignupJtbdKey,
  type SignupStage,
  type SignupV1Progress,
  loadSignupDraft,
  mergeSignupProgress,
  saveSignupDraft,
} from "@/lib/onboarding/signup-state";
import {
  INCOME_BRACKETS,
  SIGNUP_BUSINESS_TYPES,
  findBracket,
  formatMoneyTwoDecimals,
  savingsRateFromSeed,
  type FilingStatus,
} from "@/lib/onboarding/income-brackets";

const RESEND_COOLDOWN_SEC = 60;

const JTBD_CARDS: Array<{
  key: SignupJtbdKey;
  icon: string;
  title: string;
  body: string;
}> = [
  {
    key: "tax_walkthrough",
    icon: "calendar_month",
    title: "Walk me through paying my taxes",
    body: "Deadlines, methods, and whether I need help.",
  },
  {
    key: "deductions_export",
    icon: "receipt_long",
    title: "Find my itemized deductions",
    body: "Share with my accountant or download them myself.",
  },
  {
    key: "set_aside",
    icon: "savings",
    title: "Tell me how much to set aside",
    body: "Each month so I'm never caught off guard.",
  },
  {
    key: "peace_of_mind",
    icon: "verified_user",
    title: "Give me peace of mind",
    body: "That I'm not missing anything.",
  },
];

const DEDUCTION_TILES: Array<{ icon: string; title: string; hint: string }> = [
  { icon: "home_work", title: "Home office", hint: "Dedicated space & utilities" },
  { icon: "directions_car", title: "Vehicle & mileage", hint: "Business trips" },
  { icon: "laptop_mac", title: "Equipment & software", hint: "Tools of the trade" },
  { icon: "restaurant", title: "Business meals", hint: "Ordinary & necessary" },
  { icon: "flight", title: "Travel", hint: "Lodging & transport" },
  { icon: "cell_tower", title: "Phone & internet", hint: "Business use %" },
  { icon: "school", title: "Education & training", hint: "Skills for your work" },
  { icon: "health_and_safety", title: "Insurance & health", hint: "Self-employed rules" },
  { icon: "campaign", title: "Marketing & ads", hint: "Growing your business" },
  { icon: "inventory_2", title: "Supplies & inventory", hint: "Cost of goods" },
  { icon: "handyman", title: "Professional services", hint: "Legal, accounting" },
  { icon: "percent", title: "Retirement contributions", hint: "SEP, Solo 401(k)" },
];

function isEmailConfirmedUser(user: { email_confirmed_at?: string | null; user_metadata?: Record<string, unknown> } | null): boolean {
  if (!user) return false;
  const meta = user.user_metadata ?? {};
  return user.email_confirmed_at != null || meta.email_confirm === true;
}

function stageProgressClass(i: number, stage: number): string {
  return i <= stage ? "bg-brand-blue" : "bg-brand-light-grey";
}

type Props = {
  /** signup = /signup embedded; continue = /onboarding full page */
  variant: "embedded" | "page";
};

export function SignupOnboardingWizard({ variant }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hydrated, setHydrated] = useState(false);
  const [stage, setStage] = useState<SignupStage>(1);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [jtbd, setJtbd] = useState<SignupJtbdKey | null>(null);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [businessType, setBusinessType] = useState<string | null>(null);
  const [filingStatus, setFilingStatus] = useState<FilingStatus | null>(null);
  const [expectedIncomeRange, setExpectedIncomeRange] = useState<string | null>(null);
  const [savingsEstimateUsd, setSavingsEstimateUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const incomeOptions = filingStatus ? INCOME_BRACKETS[filingStatus] : [];

  const savingsDisplay = useMemo(() => {
    if (savingsEstimateUsd == null) return null;
    return formatMoneyTwoDecimals(savingsEstimateUsd);
  }, [savingsEstimateUsd]);

  const persist = useCallback(
    async (partial: Partial<SignupV1Progress> & { stage?: SignupStage }) => {
      const em = (partial.email ?? email).trim();
      const st = (partial.stage ?? stage) as SignupStage;
      if (em) {
        saveSignupDraft(em, {
          firstName: partial.firstName ?? firstName,
          email: em,
          stage: st,
          jtbd: partial.jtbd ?? jtbd,
          businessType: partial.businessType ?? businessType,
          filingStatus: partial.filingStatus ?? filingStatus,
          expectedIncomeRange: partial.expectedIncomeRange ?? expectedIncomeRange,
          savingsEstimateUsd: partial.savingsEstimateUsd ?? savingsEstimateUsd,
          completedAt: partial.completedAt,
          updatedAt: new Date().toISOString(),
        });
      }
      const supabase = createSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const getRes = await fetch("/api/profile", { method: "GET" });
      const body = await getRes.json().catch(() => ({}));
      const current =
        body?.data?.onboarding_progress && typeof body.data.onboarding_progress === "object"
          ? body.data.onboarding_progress
          : {};
      const prevRaw = (current as Record<string, unknown>)[SIGNUP_FLOW_KEY];
      const prev =
        typeof prevRaw === "object" && prevRaw !== null ? (prevRaw as SignupV1Progress) : ({} as SignupV1Progress);

      const nextSignup: SignupV1Progress = {
        ...prev,
        updatedAt: new Date().toISOString(),
        firstName: partial.firstName ?? firstName,
        email: em || email,
        stage: st,
        jtbd: (partial.jtbd !== undefined ? partial.jtbd : jtbd) ?? prev.jtbd ?? null,
        businessType: (partial.businessType !== undefined ? partial.businessType : businessType) ?? prev.businessType ?? null,
        filingStatus: (partial.filingStatus !== undefined ? partial.filingStatus : filingStatus) ?? prev.filingStatus ?? null,
        expectedIncomeRange:
          (partial.expectedIncomeRange !== undefined ? partial.expectedIncomeRange : expectedIncomeRange) ??
          prev.expectedIncomeRange ??
          null,
        savingsEstimateUsd:
          (partial.savingsEstimateUsd !== undefined ? partial.savingsEstimateUsd : savingsEstimateUsd) ??
          prev.savingsEstimateUsd ??
          null,
        completedAt: partial.completedAt !== undefined ? partial.completedAt : prev.completedAt,
      };

      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: partial.firstName ?? firstName,
          onboarding_progress: {
            ...current,
            [SIGNUP_FLOW_KEY]: nextSignup,
            onboarding_flow: SIGNUP_FLOW_KEY,
          },
        }),
      });
    },
    [
      email,
      firstName,
      stage,
      jtbd,
      businessType,
      filingStatus,
      expectedIncomeRange,
      savingsEstimateUsd,
    ]
  );

  /** Load session + profile + localStorage and set stage + fields */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const qEmail = searchParams.get("email")?.trim() ?? "";
      const confirmed = isEmailConfirmedUser(user);

      let profileEmail = "";
      let onboardingProgress: unknown = null;
      if (user) {
        const getRes = await fetch("/api/profile", { method: "GET" });
        const body = await getRes.json().catch(() => ({}));
        if (!cancelled && body?.data) {
          profileEmail = (body.data.email as string) ?? user.email ?? "";
          onboardingProgress = body.data.onboarding_progress;
          if (body.data.first_name) {
            setFirstName((prev) => prev || String(body.data.first_name));
          }
        }
      }

      const em = (qEmail || profileEmail || user?.email || "").trim();
      const local = em ? loadSignupDraft(em) : null;
      const merged = mergeSignupProgress(onboardingProgress, local);

      if (merged) {
        if (merged.firstName) setFirstName(merged.firstName);
        if (merged.email) setEmail(merged.email);
        if (merged.jtbd) setJtbd(merged.jtbd);
        if (merged.businessType) setBusinessType(merged.businessType);
        if (merged.filingStatus) setFilingStatus(merged.filingStatus);
        if (merged.expectedIncomeRange) setExpectedIncomeRange(merged.expectedIncomeRange);
        if (merged.savingsEstimateUsd != null) setSavingsEstimateUsd(merged.savingsEstimateUsd);
        if (user?.id) setUserId(user.id);
        let nextStage = (merged.stage ?? 1) as SignupStage;
        if (!confirmed && nextStage > 3) nextStage = 3;
        setStage(nextStage);
      } else if (em) {
        setEmail(em);
      }

      if (user?.id) setUserId(user.id);

      if (confirmed && merged && (merged as SignupV1Progress).completedAt) {
        router.replace("/inbox");
        return;
      }

      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init once; searchParams email matters once
  }, [searchParams]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  async function handleStage1Submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      setError(passwordCheck.message ?? "Password does not meet requirements.");
      return;
    }
    const emailValue = email.trim();
    if (!firstName.trim()) {
      setError("Please enter your first name.");
      return;
    }
    setLoading(true);
    try {
      try {
        const res = await fetch("/api/auth/check-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailValue, intent: "signup" as const }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Could not check this email. Please try again.");
          setLoading(false);
          return;
        }
        if (data.exists) {
          setError("An account with this email already exists. Try signing in.");
          setLoading(false);
          return;
        }
      } catch {
        /* fall through */
      }

      const supabase = createSupabaseClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: emailValue,
        password,
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
          data: {
            first_name: firstName.trim(),
            email_opt_in: true,
            terms_accepted_at: new Date().toISOString(),
          },
        },
      });

      if (signUpError) {
        setError(getAuthErrorMessage(signUpError, "signup"));
        setLoading(false);
        return;
      }

      const uid = data.user?.id ?? null;
      setUserId(uid);

      try {
        await fetch("/api/email/send-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailValue, userId: uid }),
        });
      } catch {
        /* best-effort */
      }

      setResendCooldown(RESEND_COOLDOWN_SEC);
      const nextStage = 2 as SignupStage;
      setStage(nextStage);
      await persist({
        stage: nextStage,
        firstName: firstName.trim(),
        email: emailValue,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? getAuthErrorMessage(err, "connection")
          : "Could not connect. Check your network and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (!email.trim() || resendCooldown > 0) return;
    setResending(true);
    setOtpError(null);
    try {
      const res = await fetch("/api/email/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), userId: userId ?? undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOtpError(data.error ?? "Could not resend code.");
      } else {
        setResendCooldown(RESEND_COOLDOWN_SEC);
      }
    } catch {
      setOtpError("Could not resend code. Check your connection.");
    } finally {
      setResending(false);
    }
  }

  async function verifyOtpAndAdvance() {
    const code = otp.replace(/\D/g, "");
    if (code.length !== 6) {
      setOtpError("Enter the 6-digit code.");
      return;
    }
    setLoading(true);
    setOtpError(null);
    try {
      const res = await fetch("/api/auth/verify-passphrase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error?.includes("expired")) {
          setOtpError("This code has expired. Resend a new code.");
        } else {
          setOtpError("That code doesn’t match. Check the email and try again.");
        }
        setLoading(false);
        return;
      }

      const supabase = createSupabaseClient();
      await supabase.auth.refreshSession();

      const nextStage = 4 as SignupStage;
      setStage(nextStage);
      await persist({ stage: nextStage, email: email.trim(), firstName });
      setOtp("");
    } catch {
      setOtpError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function goForward() {
    setError(null);
    if (stage === 2) {
      if (!jtbd) {
        setError("Pick one goal to continue (you can change this later).");
        return;
      }
      const next = 3 as SignupStage;
      setStage(next);
      await persist({ stage: next, jtbd });
      return;
    }
    if (stage === 3) {
      await verifyOtpAndAdvance();
      return;
    }
    if (stage === 4) {
      if (!businessType || !filingStatus || !expectedIncomeRange) {
        setError("Please complete all fields.");
        return;
      }
      const bracket = findBracket(filingStatus, expectedIncomeRange);
      if (!bracket) {
        setError("Invalid income selection.");
        return;
      }
      const rate = savingsRateFromSeed(`${email}:${expectedIncomeRange}:${filingStatus}`);
      const estimate = Math.round(bracket.midpointUsd * rate * 100) / 100;
      setSavingsEstimateUsd(estimate);
      const next = 5 as SignupStage;
      setStage(next);
      await persist({
        stage: next,
        businessType,
        filingStatus,
        expectedIncomeRange,
        savingsEstimateUsd: estimate,
      });

      const taxYear = new Date().getFullYear();
      await fetch("/api/tax-year-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tax_year: taxYear,
          tax_rate: bracket.taxRate,
          expected_income_range: expectedIncomeRange,
        }),
      }).catch(() => {});
      return;
    }
    if (stage === 5) {
      const next = 6 as SignupStage;
      setStage(next);
      await persist({ stage: next, savingsEstimateUsd: savingsEstimateUsd ?? undefined });
      return;
    }
    if (stage === 6) {
      await persist({
        stage: 6,
        completedAt: new Date().toISOString(),
      });
      router.push("/inbox");
      router.refresh();
    }
  }

  function goBack() {
    setError(null);
    setOtpError(null);
    if (stage <= 1) {
      if (variant === "embedded") router.push("/");
      return;
    }
    if (stage === 4) {
      setStage(3);
      return;
    }
    setStage((s) => Math.max(1, (s - 1) as SignupStage) as SignupStage);
  }

  const shellClass =
    variant === "page"
      ? "min-h-screen bg-brand-light-grey px-4 py-10 sm:py-14"
      : "w-full min-w-0";

  if (!hydrated) {
    return (
      <div className={shellClass}>
        <div className="mx-auto max-w-xl animate-pulse space-y-4">
          <div className="h-1.5 rounded-full bg-brand-medium-grey/50" />
          <div className="h-32 rounded-[12px] bg-brand-light-grey" />
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="mx-auto w-full max-w-xl auth-shell">
        <div className="mb-8 flex gap-1.5 sm:gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-200 ease-out ${stageProgressClass(
                i,
                stage
              )}`}
            />
          ))}
        </div>

        {stage === 1 && (
          <section className="space-y-5 transition-opacity duration-200 ease-out">
            <div className="space-y-2 text-center sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-blue">Start free</p>
              <h1 className="text-2xl text-brand-black sm:text-3xl">Create your account</h1>
              <p className="text-sm text-brand-dark-gray leading-relaxed">
                We&apos;ll get you set up in a few quick steps — warm, simple, and built around your taxes.
              </p>
            </div>

            <form onSubmit={handleStage1Submit} className="space-y-3.5">
              <input
                type="text"
                name="given-name"
                autoComplete="given-name"
                required
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="auth-input w-full"
              />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input w-full"
              />
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input w-full pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-brand-dark-gray transition-colors duration-150 hover:text-brand-black"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-rounded text-[22px] leading-none">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>

              <p className="text-xs text-brand-dark-gray leading-relaxed">
                By continuing, you agree to the{" "}
                <Link href="/terms" className="text-brand-blue underline">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-brand-blue underline">
                  Privacy Policy
                </Link>
                .
              </p>

              {error && (
                <p className="auth-banner-error">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary mt-2 w-full transition-opacity duration-150 disabled:opacity-50"
              >
                {loading ? "Creating account…" : "Continue"}
              </button>
            </form>

            {variant === "embedded" && (
              <p className="text-center text-sm text-brand-dark-gray">
                <Link href="/login" className="font-medium text-brand-blue hover:underline">
                  Already have an account?
                </Link>
              </p>
            )}
          </section>
        )}

        {stage === 2 && (
          <section className="space-y-6 transition-opacity duration-200 ease-out">
            <div className="space-y-2">
              <h1 className="text-2xl text-brand-black sm:text-3xl">
                Welcome, {firstName.trim() || "there"}
              </h1>
              <p className="text-sm text-brand-dark-gray leading-relaxed">
                ExpenseTerminal is your personal tax guide — we help you track deductions, plan for payments, and stay
                ahead without the jargon.
              </p>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-blue">What matters most?</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {JTBD_CARDS.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => setJtbd(card.key)}
                  className={`rounded-[var(--radius-lg)] border p-4 text-left transition-all duration-150 ease-out ${
                    jtbd === card.key
                      ? "border-brand-blue bg-brand-blue/5 ring-2 ring-brand-blue/20"
                      : "border-brand-medium-grey bg-white hover:border-brand-blue/30"
                  }`}
                >
                  <span className="material-symbols-rounded mb-2 block text-brand-blue" style={{ fontSize: 28 }}>
                    {card.icon}
                  </span>
                  <span className="block text-sm font-semibold text-brand-black">{card.title}</span>
                  <span className="mt-1 block text-xs text-brand-dark-gray leading-snug">{card.body}</span>
                </button>
              ))}
            </div>
            {error && <p className="auth-banner-error">{error}</p>}
          </section>
        )}

        {stage === 3 && (
          <section className="space-y-6 transition-opacity duration-200 ease-out">
            <div className="space-y-2">
              <h1 className="text-2xl text-brand-black sm:text-3xl">Check your email</h1>
              <p className="text-sm text-brand-dark-gray">
                We sent a 6-digit code to <span className="font-medium text-brand-black">{email}</span>
              </p>
            </div>

            <OtpSixInputs value={otp} onChange={setOtp} error={!!otpError} autoFocus />

            {otpError && (
              <p className="auth-banner-error text-center">{otpError}</p>
            )}

            <p className="text-center text-xs text-brand-dark-gray">Don&apos;t see it? Check your spam folder.</p>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resending || resendCooldown > 0}
                className="text-sm font-medium text-brand-blue transition-opacity duration-150 hover:underline disabled:opacity-40"
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : resending ? "Sending…" : "Resend code"}
              </button>
            </div>
          </section>
        )}

        {stage === 4 && (
          <section className="space-y-5 transition-opacity duration-200 ease-out">
            <div className="space-y-2">
              <h1 className="text-2xl text-brand-black sm:text-3xl">Your tax profile</h1>
              <p className="rounded-[14px] border border-brand-medium-grey bg-brand-light-grey/80 p-3 text-xs text-brand-dark-gray leading-relaxed">
                We ask so estimates and deduction suggestions match your situation. Nothing here is shared without your
                say — it just helps us personalize your workspace.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-brand-dark-gray">Business type</label>
              <div className="flex flex-wrap gap-2">
                {SIGNUP_BUSINESS_TYPES.map((b) => (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => setBusinessType(b.value)}
                    className={`rounded-[var(--radius-lg)] border px-3 py-2 text-xs font-medium transition-all duration-150 ${
                      businessType === b.value
                        ? "border-brand-blue bg-brand-blue/10 text-brand-black"
                        : "border-brand-medium-grey bg-white text-brand-dark-gray hover:border-brand-blue/30"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-brand-dark-gray">Filing status</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFilingStatus("single");
                    setExpectedIncomeRange(null);
                  }}
                  className={`rounded-[var(--radius-lg)] border px-4 py-2 text-sm font-medium transition-all duration-150 ${
                    filingStatus === "single"
                      ? "border-brand-blue bg-brand-blue/10"
                      : "border-brand-medium-grey bg-white hover:border-brand-blue/30"
                  }`}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilingStatus("married_filing_jointly");
                    setExpectedIncomeRange(null);
                  }}
                  className={`rounded-[var(--radius-lg)] border px-4 py-2 text-sm font-medium transition-all duration-150 ${
                    filingStatus === "married_filing_jointly"
                      ? "border-brand-blue bg-brand-blue/10"
                      : "border-brand-medium-grey bg-white hover:border-brand-blue/30"
                  }`}
                >
                  Married filing jointly
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-brand-dark-gray">
                Expected annual income (business + personal)
              </label>
              {!filingStatus ? (
                <p className="text-xs text-brand-dark-gray">Select filing status first to see income ranges.</p>
              ) : (
                <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-[12px] border border-brand-medium-grey bg-white p-2">
                  {incomeOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setExpectedIncomeRange(opt.id)}
                      className={`flex w-full rounded-[var(--radius-lg)] px-3 py-2.5 text-left text-sm transition-colors duration-150 ${
                        expectedIncomeRange === opt.id
                          ? "bg-brand-blue/15 font-medium text-brand-black"
                          : "text-brand-dark-gray hover:bg-brand-light-grey"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="auth-banner-error">{error}</p>}
          </section>
        )}

        {stage === 5 && savingsDisplay && (
          <section className="space-y-6 text-center transition-opacity duration-200 ease-out sm:text-left">
            <h1 className="text-2xl text-brand-black sm:text-3xl">Your potential savings</h1>
            <div className="rounded-[var(--radius-lg)] border border-brand-blue/25 bg-brand-blue/5 px-6 py-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-blue">Illustrative only</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-brand-black sm:text-4xl">
                ${savingsDisplay}
                <span className="text-lg font-sans font-normal text-brand-dark-gray"> / yr</span>
              </p>
              <p className="mt-4 text-sm text-brand-dark-gray leading-relaxed">
                You could potentially save this much from <strong className="text-brand-black">itemized deductions</strong>{" "}
                based on your income band — not a guarantee, not tax advice. Actual savings depend on your expenses and
                IRS rules.
              </p>
            </div>
          </section>
        )}

        {stage === 6 && (
          <section className="space-y-6 transition-opacity duration-200 ease-out">
            <div className="space-y-2">
              <h1 className="text-2xl text-brand-black sm:text-3xl">Common deductions</h1>
              <p className="text-sm text-brand-dark-gray leading-relaxed">
                You don&apos;t need to memorize these — we&apos;ll help surface what applies as you go. Here&apos;s a
                snapshot of what many small businesses track.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DEDUCTION_TILES.map((t) => (
                <div
                  key={t.title}
                  className="rounded-[12px] border border-brand-medium-grey bg-white p-3 shadow-sm transition-transform duration-150 ease-out hover:-translate-y-0.5"
                >
                  <span className="material-symbols-rounded text-brand-blue" style={{ fontSize: 26 }}>
                    {t.icon}
                  </span>
                  <p className="mt-2 text-sm font-semibold text-brand-black">{t.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-brand-dark-gray">{t.hint}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-brand-dark-gray">
              We&apos;re on your side — organized, optimistic, and built to reduce tax-season surprises.
            </p>
          </section>
        )}

        {stage > 1 && (
          <div className="mt-10 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={goBack}
              className="text-sm font-medium text-brand-dark-gray transition-colors duration-150 hover:text-brand-black"
            >
              Back
            </button>
            <button
              type="button"
              onClick={goForward}
              disabled={loading}
              className="btn-primary px-8 transition-opacity duration-150 disabled:opacity-50"
            >
              {loading
                ? "…"
                : stage === 6
                  ? "Go to inbox"
                  : stage === 3
                    ? "Verify"
                    : "Continue"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
