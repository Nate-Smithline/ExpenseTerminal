"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { AuthLayout } from "@/components/AuthLayout";
import Link from "next/link";

function LoginFallback() {
  return (
    <div className="relative w-full">
      <AuthLayout isLoading={false}>
        <p className="text-center text-sm text-mono-medium mb-8">
          Sign in to review your business deductions.
        </p>
        <div className="h-10 rounded-lg bg-bg-tertiary animate-pulse" />
      </AuthLayout>
    </div>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "session_exchange_failed") {
      setError("Sign-in link expired or invalid. Please sign in again or request a new link.");
    }
  }, [searchParams]);

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        router.push("/auth/forgot-password");
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        router.push("/signup");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [emailInputRef, passwordInputRef, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const emailValue = email.trim();

      // Check if an account exists for this email before attempting login.
      try {
        const res = await fetch("/api/auth/check-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailValue, intent: "login" as const }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Could not check this email. Please try again.");
          setLoading(false);
          return;
        }
        if (!data.exists) {
          setError("No account found with this email. Try signing up instead.");
          setLoading(false);
          return;
        }
      } catch {
        // If the check fails, fall back to Supabase's own error handling.
      }

      const supabase = createSupabaseClient();
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: emailValue,
          password,
        });

      if (signInError) {
        setError(getAuthErrorMessage(signInError, "login"));
        setLoading(false);
        return;
      }

      const user = data.user;
      const emailConfirmed =
        !!user &&
        (user.email_confirmed_at != null ||
          (user.user_metadata as any)?.email_confirm === true);

      if (!emailConfirmed) {
        // If the email isn't confirmed yet, send a fresh verification email
        // and guide the user to the verification screen.
        try {
          await fetch("/api/email/send-verification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailValue }),
          });
        } catch {
          // Best-effort; the verify-pending screen still allows resending.
        }

        // Ensure any partial session is cleared.
        await supabase.auth.signOut();

        setLoading(false);
        router.push(
          "/auth/verify-pending?email=" + encodeURIComponent(emailValue)
        );
        return;
      }

      if (data.session) {
        router.refresh();
        router.push("/inbox");
      }
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
      <AuthLayout isLoading={loading}>
        <>
          <p className="text-center text-sm text-mono-medium mb-8">
            Sign in to review your business deductions.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <input
              ref={emailInputRef}
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
            />

            <div className="relative">
              <input
                ref={passwordInputRef}
                type={showPassword ? "text" : "password"}
                required
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
                style={{ height: "20px", width: "20px" }}
              >
                <span className="material-symbols-rounded text-[20px] leading-none">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>

            <div className="flex items-center justify-between">
              <Link
                href="/auth/forgot-password"
                className="flex items-center gap-2 text-sm font-semibold text-mono-medium hover:text-accent-navy transition-colors"
              >
                <span className="kbd-hint">F</span>
                Forgot Password?
              </Link>
              <Link
                href="/signup"
                className="flex items-center gap-2 text-sm font-semibold text-mono-medium hover:text-accent-navy transition-colors"
              >
                <span className="kbd-hint">S</span>
                Sign Up
              </Link>
            </div>

            {error && (
              <p className="text-sm text-danger bg-bg-secondary border border-bg-tertiary p-3 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-warm w-full"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </>
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

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
