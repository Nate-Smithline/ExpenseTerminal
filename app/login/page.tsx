"use client";

import { Suspense, useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { AuthLayout } from "@/components/AuthLayout";
import Link from "next/link";

function LoginFallback() {
  return (
    <div className="relative w-full">
      <AuthLayout isLoading={false}>
        <h1 className="text-center text-xl md:text-[22px] mb-6">
          Sign in to review your business deductions.
        </h1>
        <div className="h-12 bg-brand-light-grey animate-pulse rounded-[12px]" />
      </AuthLayout>
    </div>
  );
}

function safeAppInternalPath(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  if (next.includes(":")) return null;
  return next;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postLoginPath = useMemo(
    () => safeAppInternalPath(searchParams.get("next")) ?? "/inbox",
    [searchParams]
  );
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
        try {
          await fetch("/api/email/send-verification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailValue, userId: user?.id }),
          });
        } catch {
          // Best-effort; onboarding still allows resending.
        }

        setLoading(false);
        const params = new URLSearchParams();
        params.set("email", emailValue);
        router.push("/onboarding?" + params.toString());
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
        router.push(postLoginPath);
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
          <h1 className="text-center text-xl md:text-[22px] mb-6">
            Sign in to review your business deductions.
          </h1>

          <form onSubmit={handleSubmit} className="space-y-3.5 w-full min-w-0">
            {error && <p className="auth-banner-error">{error}</p>}

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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-dark-gray hover:opacity-70 transition-opacity flex items-center justify-center"
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
                className="auth-text-link inline-flex items-center gap-2 underline-offset-4 hover:underline"
              >
                <span className="kbd-hint hidden md:inline-flex">F</span>
                Forgot Password?
              </Link>
              <Link
                href="/signup"
                className="auth-text-link inline-flex items-center gap-2 underline-offset-4 hover:underline"
              >
                <span className="kbd-hint hidden md:inline-flex">S</span>
                Sign Up
              </Link>
            </div>

            <button type="submit" disabled={loading} className="auth-btn-primary mt-2">
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
