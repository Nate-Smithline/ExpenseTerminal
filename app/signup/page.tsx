"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { AuthLayout } from "@/components/AuthLayout";
import { validatePassword, getPasswordStrength } from "@/lib/validation/password";
import Link from "next/link";

const BUSINESS_TYPES = [
  "Sole Proprietor",
  "Single-member LLC",
  "S-Corp",
  "Partnership",
  "C-Corp",
  "Other",
];

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [businessType, setBusinessType] = useState("");
  const [noBusinessYet, setNoBusinessYet] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        router.push("/login");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!agreedToTerms) {
      setError("Please agree to the Terms & Conditions to continue.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      setError(passwordCheck.message ?? "Password does not meet requirements.");
      return;
    }

    setLoading(true);

    try {
      const emailValue = email.trim();

      // Check if an account already exists for this email before attempting sign up.
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
        // If the check fails, fall back to Supabase's own validation below.
      }

      const supabase = createSupabaseClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: emailValue,
        password,
        options: {
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/auth/callback`
              : undefined,
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            business_type: noBusinessYet ? null : businessType,
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

      // Send custom verification email
      try {
        await fetch("/api/email/send-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailValue, userId: data.user?.id }),
        });
      } catch {
        // Verification email is best-effort
      }

      router.push("/auth/verify-pending?email=" + encodeURIComponent(emailValue));
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not connect. Check your network and try again.";
      setError(getAuthErrorMessage({ message }, "connection"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative w-full">
      <AuthLayout>
        <p className="text-center text-sm text-mono-medium mb-8">
          Track and maximize your business deductions.
        </p>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Name row */}
        <div className="flex gap-3">
          <input
            type="text"
            required
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="auth-input flex-1"
          />
          <input
            type="text"
            required
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="auth-input flex-1"
          />
        </div>

        {/* Email */}
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="auth-input"
        />

        {/* Password */}
        <div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-mono-light hover:text-mono-medium transition-colors flex items-center justify-center"
              tabIndex={-1}
              style={{ height: '20px', width: '20px' }}
            >
              <span className="material-symbols-rounded text-[20px] leading-none">
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
          {password && (
            <div className="mt-2 p-3 rounded-lg border border-bg-tertiary bg-bg-secondary">
              <div className="space-y-1.5 text-xs">
                <div className={`flex items-center gap-2 ${password.length >= 12 || (password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) ? "text-green-600" : "text-mono-medium"}`}>
                  <span className="material-symbols-rounded text-[16px]">
                    {password.length >= 12 || (password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <span>{password.length >= 12 ? "12+ characters" : "8+ characters with uppercase, lowercase, number, and special character"}</span>
                </div>
                <div className={`flex items-center gap-2 ${/[a-z]/.test(password) ? "text-green-600" : "text-mono-medium"}`}>
                  <span className="material-symbols-rounded text-[16px]">
                    {/[a-z]/.test(password) ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <span>Lowercase letter</span>
                </div>
                <div className={`flex items-center gap-2 ${/[A-Z]/.test(password) ? "text-green-600" : "text-mono-medium"}`}>
                  <span className="material-symbols-rounded text-[16px]">
                    {/[A-Z]/.test(password) ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <span>Uppercase letter</span>
                </div>
                <div className={`flex items-center gap-2 ${/\d/.test(password) ? "text-green-600" : "text-mono-medium"}`}>
                  <span className="material-symbols-rounded text-[16px]">
                    {/\d/.test(password) ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <span>Number</span>
                </div>
                <div className={`flex items-center gap-2 ${/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) ? "text-green-600" : "text-mono-medium"}`}>
                  <span className="material-symbols-rounded text-[16px]">
                    {/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <span>Special character</span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-bg-tertiary">
                <p className={`text-xs font-medium ${getPasswordStrength(password) === "weak" ? "text-red-600" : getPasswordStrength(password) === "fair" ? "text-amber-600" : "text-green-600"}`}>
                  Strength: {getPasswordStrength(password)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="relative">
          <input
            type={showConfirm ? "text" : "password"}
            required
            minLength={8}
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="auth-input pr-12"
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-mono-light hover:text-mono-medium transition-colors flex items-center justify-center"
            tabIndex={-1}
            style={{ height: '20px', width: '20px' }}
          >
            <span className="material-symbols-rounded text-[20px] leading-none">
              {showConfirm ? "visibility_off" : "visibility"}
            </span>
          </button>
        </div>

        {/* Business type selector */}
        <div className="pt-2">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: noBusinessYet ? "var(--color-mono-light)" : "var(--color-accent-terracotta)" }}
            />
            <span className="text-sm text-mono-dark font-medium">
              What type of business do you have?
            </span>
          </div>

          {!noBusinessYet && (
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("business-type-select");
                if (el) (el as HTMLSelectElement).showPicker?.();
              }}
              className="w-full rounded-lg border border-accent-terracotta/30 bg-white px-4 py-3 text-sm text-left transition hover:border-accent-terracotta/60 relative"
            >
              <select
                id="business-type-select"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              >
                <option value="">+ Select Your Business Type</option>
                {BUSINESS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span className={businessType ? "text-mono-dark" : "text-accent-terracotta"}>
                {businessType || "+ Select Your Business Type"}
              </span>
            </button>
          )}

          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={noBusinessYet}
              onChange={(e) => {
                setNoBusinessYet(e.target.checked);
                if (e.target.checked) setBusinessType("");
              }}
              className="w-4 h-4 rounded border-bg-tertiary accent-accent-sage"
            />
            <span className="text-sm text-mono-medium">
              I don&apos;t have a registered business yet
            </span>
          </label>
        </div>


        {/* Terms agreement */}
        <label className="flex items-start gap-2 pt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded border-bg-tertiary accent-accent-sage"
          />
          <span className="text-sm text-mono-medium">
            I agree to the{" "}
            <Link href="/terms" className="text-accent-navy underline">
              Terms & Conditions
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-accent-navy underline">
              Privacy Policy
            </Link>
          </span>
        </label>

        {/* Error */}
        {error && (
          <p className="text-sm text-danger bg-bg-secondary border border-bg-tertiary p-3 rounded-lg">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="btn-warm w-full mt-2"
        >
          {loading ? "Creating account..." : "Get Started"}
        </button>
        </form>

        <p className="mt-6 text-sm text-mono-medium text-center">
          Already have an account?{" "}
          <Link href="/login" className="flex items-center gap-2 text-accent-navy font-medium inline-flex">
            <span className="kbd-hint">L</span>
            Sign In
          </Link>
        </p>
      </AuthLayout>
      
      <div className="fixed bottom-6 right-6 text-right z-10">
        <p className="text-xs text-mono-light">
          By using this app, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-mono-medium transition-colors">
            terms
          </Link>
          {", "}
          <Link href="/privacy" className="underline hover:text-mono-medium transition-colors">
            privacy policy
          </Link>
          {", and "}
          <Link href="/cookies" className="underline hover:text-mono-medium transition-colors">
            cookie policy
          </Link>
        </p>
      </div>
    </div>
  );
}
