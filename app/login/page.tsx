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
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "session_exchange_failed") {
      setError("Sign-in link expired or invalid. Please sign in again or request a new link.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!forgotPassword) {
      emailInputRef.current?.focus();
    }
  }, [forgotPassword]);

  useEffect(() => {
    if (!forgotPassword) return;
    
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setForgotPassword(false);
        setResetSent(false);
        setError(null);
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [forgotPassword]);

  useEffect(() => {
    if (forgotPassword) return; // Don't handle shortcuts when in forgot password view
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (e.target instanceof HTMLInputElement) return;
      
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setForgotPassword(true);
        setError(null);
        setResetSent(false);
        // Focus email input after state update
        setTimeout(() => emailInputRef.current?.focus(), 0);
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        router.push("/signup");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [forgotPassword, emailInputRef, passwordInputRef, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError) {
        setError(getAuthErrorMessage(signInError, "login"));
        setLoading(false);
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

  async function handleForgotPasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    const emailValue = email.trim();
    if (!emailValue) {
      setError("Enter your email.");
      return;
    }
    setResetLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setError(data.error ?? "Too many attempts. Try again later.");
        setResetLoading(false);
        return;
      }
      if (res.status !== 200) {
        setError(data.error ?? "Request failed.");
        setResetLoading(false);
        return;
      }
      const supabase = createSupabaseClient();
      await supabase.auth.resetPasswordForEmail(emailValue, {
        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/reset-password`,
      });
      setResetSent(true);
    } catch {
      setError("Could not send reset link. Try again.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="relative w-full">
      <AuthLayout isLoading={loading}>
        {forgotPassword ? (
          <>
            <button
              type="button"
              onClick={() => {
                setForgotPassword(false);
                setResetSent(false);
                setError(null);
              }}
              className="flex items-center gap-2 text-sm text-mono-medium hover:text-mono-dark transition-colors mb-6"
            >
              <span className="kbd-hint">Esc</span>
              Back
            </button>
            <p className="text-left text-sm text-mono-medium mb-3.5">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-3.5">
              <input
                ref={emailInputRef}
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
              />

              {error && (
                <p className="text-sm text-danger bg-bg-secondary border border-bg-tertiary p-3 rounded-lg">
                  {error}
                </p>
              )}

              {resetSent ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="text-sm text-green-800">
                    If an account exists for that email, we&apos;ve sent a reset link.
                  </p>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="btn-warm w-full"
                >
                  {resetLoading ? "Sending..." : "Send Reset Link"}
                </button>
              )}
            </form>
          </>
        ) : (
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
                  style={{ height: '20px', width: '20px' }}
                >
                  <span className="material-symbols-rounded text-[20px] leading-none">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setForgotPassword(true);
                    setError(null);
                    setResetSent(false);
                    setTimeout(() => emailInputRef.current?.focus(), 0);
                  }}
                  className="flex items-center gap-2 text-sm font-semibold text-mono-medium hover:text-accent-navy transition-colors"
                >
                  <span className="kbd-hint">F</span>
                  Forgot Password?
                </button>
                <Link href="/signup" className="flex items-center gap-2 text-sm font-semibold text-mono-medium hover:text-accent-navy transition-colors">
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
        )}
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
