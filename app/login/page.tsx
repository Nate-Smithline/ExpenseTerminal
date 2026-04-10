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
        <h1 className="text-center text-lg md:text-2xl font-display text-mono-dark mb-6">
          Sign in to review your business deductions.
        </h1>
        <div className="h-12 bg-bg-tertiary animate-pulse" />
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
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (isMobile) return;

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
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const emailValue = email.trim();

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
            body: JSON.stringify({ email: emailValue, userId: user?.id }),
          });
        } catch {
          // Best-effort; the verify-pending screen still allows resending.
        }

        // Ensure any partial session is cleared.
        await supabase.auth.signOut();

        setLoading(false);
        const params = new URLSearchParams({ email: emailValue });
        if (user?.id) params.set("userId", user.id);
        router.push("/auth/verify-pending?" + params.toString());
        return;
      }

      if (data.session) {
        // Backfill / ensure a profile row exists for this user.
        try {
          await fetch("/api/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
        } catch {
          // Non-fatal; other parts of the app can still function.
        }

        router.refresh();
        router.push("/dashboard");
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
          <h1 className="text-center text-lg md:text-2xl font-display text-mono-dark mb-6">
            Sign in to review your business deductions.
          </h1>

          <form onSubmit={handleSubmit} className="space-y-3.5 w-full min-w-0">
            {error && (
              <p className="text-sm p-3 bg-[#FEE2E2] text-[#DC2626]">
                {error}
              </p>
            )}

            <input
              ref={emailInputRef}
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input h-12"
            />
            <div className="relative">
              <input
                ref={passwordInputRef}
                type={showPassword ? "text" : "password"}
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input h-12 pr-12"
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
                <span className="kbd-hint hidden md:inline-flex">F</span>
                Forgot Password?
              </Link>
              <Link
                href="/signup"
                className="flex items-center gap-2 text-sm font-semibold text-mono-medium hover:text-accent-navy transition-colors"
              >
                <span className="kbd-hint hidden md:inline-flex">S</span>
                Sign Up
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-black text-white text-sm font-medium h-12 px-4 rounded-none transition-opacity duration-150 hover:opacity-70 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </>
      </AuthLayout>
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
