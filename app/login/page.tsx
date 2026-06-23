"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { AuthLayout } from "@/components/AuthLayout";
import Link from "next/link";

function LoginFallback() {
  return (
    <AuthLayout isLoading>
      <div style={{ height: 48, background: "var(--bone-2)", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
    </AuthLayout>
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

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "session_exchange_failed") {
      setError("Sign-in link expired or invalid. Please sign in again or request a new link.");
    }
  }, [searchParams]);

  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget as HTMLFormElement);
      const emailValue = String(formData.get("email") ?? email).trim();
      const passwordValue = String(formData.get("password") ?? password);
      const supabase = createSupabaseClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailValue,
        password: passwordValue,
      });

      if (signInError) {
        setError(getAuthErrorMessage(signInError, "login"));
        setLoading(false);
        return;
      }

      const user = data.user;
      const metadata = user?.user_metadata as { email_confirm?: boolean } | undefined;
      const emailConfirmed =
        !!user &&
        (user.email_confirmed_at != null || metadata?.email_confirm === true);

      if (!emailConfirmed) {
        try {
          await fetch("/api/email/send-verification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailValue, userId: user?.id }),
          });
        } catch { /* best-effort */ }

        await supabase.auth.signOut();
        setLoading(false);
        const params = new URLSearchParams({ email: emailValue });
        if (user?.id) params.set("userId", user.id);
        router.push("/auth/verify-pending?" + params.toString());
        return;
      }

      if (data.session) {
        try {
          await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
        } catch { /* non-fatal */ }
        const nextParam = searchParams.get("next");
        const destination =
          nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
            ? nextParam
            : "/triage";
        router.refresh();
        router.push(destination);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not connect. Check your network and try again.";
      setError(getAuthErrorMessage({ message }, "connection"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout isLoading={loading}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.02em", color: "var(--ink)", margin: 0 }}>
          Welcome back
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-3)", marginTop: 4 }}>
          Keep swiping transactions into deductions, budgets, and your live Schedule C.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
        suppressHydrationWarning
      >
        {error && (
          <div style={{
            padding: "10px 14px", background: "var(--ember-tint)", border: "1px solid var(--ember-soft)",
            borderRadius: 8, fontSize: 13.5, color: "var(--ember-deep)", lineHeight: 1.4,
          }}>
            {error}
          </div>
        )}

        <input
          ref={emailInputRef}
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onInput={(e) => setEmail(e.currentTarget.value)}
          className="auth-input"
          suppressHydrationWarning
        />

        <div style={{ position: "relative" }}>
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onInput={(e) => setPassword(e.currentTarget.value)}
            className="auth-input"
            style={{ paddingRight: 44 }}
            suppressHydrationWarning
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            suppressHydrationWarning
            style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)",
              display: "flex", alignItems: "center", padding: 0,
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
              {showPassword ? "visibility_off" : "visibility"}
            </span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, marginTop: 2 }}>
          <Link href="/auth/forgot-password" style={{ color: "var(--ink-3)", textDecoration: "none" }}
            onMouseOver={e => (e.currentTarget.style.color = "var(--ink)")}
            onMouseOut={e => (e.currentTarget.style.color = "var(--ink-3)")}
          >
            Forgot password?
          </Link>
          <Link href="/signup" style={{ color: "var(--forest)", fontWeight: 600, textDecoration: "none" }}
            onMouseOver={e => (e.currentTarget.style.color = "var(--forest-deep)")}
            onMouseOut={e => (e.currentTarget.style.color = "var(--forest)")}
          >
            Create account
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          suppressHydrationWarning
          style={{
            width: "100%", height: 44, background: loading ? "var(--forest-mid)" : "var(--forest)",
            color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
            letterSpacing: "-.005em", cursor: loading ? "not-allowed" : "pointer",
            transition: "background .15s ease", marginTop: 4,
          }}
          onMouseOver={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "var(--forest-deep)"; }}
          onMouseOut={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "var(--forest)"; }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
