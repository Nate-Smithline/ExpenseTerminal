"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { AuthLayout } from "@/components/AuthLayout";
import { validatePassword, getPasswordStrength } from "@/lib/validation/password";
import { formatUSPhone, parseUSPhone } from "@/lib/format-us-phone";
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
  const [phone, setPhone] = useState("");
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
            phone_us: parseUSPhone(phone) || null,
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

      const userId = data.user?.id ?? null;

      // Send custom verification email (this route now also ensures a profile
      // row exists with the correct email using the service-role client).
      try {
        await fetch("/api/email/send-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailValue, userId }),
        });
      } catch {
        // Verification email is best-effort
      }

      const params = new URLSearchParams({ email: emailValue });
      if (userId) params.set("userId", userId);
      router.push("/auth/verify-pending?" + params.toString());
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
    <div className="relative w-full min-w-0 max-w-full">
      <AuthLayout>
        <p className="text-center text-sm text-mono-medium mb-8">
          Track and maximize your business deductions.
        </p>

      <form onSubmit={handleSubmit} className="space-y-3.5 w-full min-w-0">
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

        {/* Phone (US only) */}
        <div className="space-y-1">
          <input
            type="tel"
            inputMode="tel"
            placeholder="Phone (optional)"
            value={phone}
            onChange={(e) => setPhone(formatUSPhone(e.target.value))}
            className="auth-input"
          />
          <p className="text-[11px] text-mono-light">
            US phone numbers only. Example: (555) 555-1234
          </p>
        </div>

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
            <div className="mt-2 p-3 rounded-lg border border-bg-tertiary bg-bg-secondary min-w-0">
              <div className="space-y-1.5 text-xs break-words">
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

        {/* Terms agreement */}
        <label className="flex items-start gap-2 pt-1 cursor-pointer min-w-0">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="w-4 h-4 mt-0.5 shrink-0 rounded border-bg-tertiary accent-accent-sage"
          />
          <span className="text-sm text-mono-medium break-words">
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

        <p className="mt-6 text-sm text-mono-medium text-center break-words">
          Already have an account?{" "}
          <Link href="/login" className="flex items-center gap-2 text-accent-navy font-medium inline-flex">
            <span className="kbd-hint">L</span>
            Sign In
          </Link>
        </p>
      </AuthLayout>
    </div>
  );
}
