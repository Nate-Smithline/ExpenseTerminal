"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { AuthLayout } from "@/components/AuthLayout";
import { validatePassword } from "@/lib/validation/password";
import { formatUSPhone, parseUSPhone } from "@/lib/format-us-phone";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      setError(passwordCheck.message ?? "Password does not meet requirements.");
      return;
    }

    setLoading(true);

    try {
      const emailValue = email.trim();

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
        /* fall through to Supabase validation */
      }

      const supabase = createSupabaseClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: emailValue,
        password,
        options: {
          emailRedirectTo: typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback?next=/onboarding`
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

      try {
        await fetch("/api/email/send-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailValue, userId }),
        });
      } catch { /* best-effort */ }

      if (userId) {
        try {
          await fetch("/api/email/notify-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: emailValue,
              userId,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              phone: parseUSPhone(phone) || null,
            }),
          });
        } catch { /* best-effort */ }
      }

      const params = new URLSearchParams({ email: emailValue });
      if (userId) params.set("userId", userId);
      router.push("/auth/verify-pending?" + params.toString());
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
          Start Swiping for Savings
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-3)", marginTop: 4 }}>
          Create your account, add a card, and start a 15-day free trial before your first charge.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Name row */}
        <div style={{ display: "flex", gap: 10 }}>
          <input
            type="text"
            required
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="auth-input"
          />
          <input
            type="text"
            required
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="auth-input"
          />
        </div>

        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="auth-input"
        />

        <input
          type="tel"
          inputMode="tel"
          placeholder="Phone (US)"
          required
          value={phone}
          onChange={(e) => setPhone(formatUSPhone(e.target.value))}
          className="auth-input"
        />

        <div style={{ position: "relative" }}>
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
            style={{ paddingRight: 44 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
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

        {/* Password strength hints */}
        {password && (
          <div style={{
            padding: "10px 14px", background: "var(--bone-2)", borderRadius: 8,
            display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5,
          }}>
            {[
              { label: "8+ characters", ok: password.length >= 8 },
              { label: "Uppercase letter", ok: /[A-Z]/.test(password) },
              { label: "Lowercase letter", ok: /[a-z]/.test(password) },
              { label: "Number", ok: /\d/.test(password) },
            ].map(({ label, ok }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, color: ok ? "var(--forest)" : "var(--ink-3)" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  {ok ? <path d="M20 6L9 17l-5-5" /> : <circle cx="12" cy="12" r="9" strokeWidth="1.5" />}
                </svg>
                {label}
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize: 12, color: "var(--ink-4)", lineHeight: 1.5, margin: "2px 0" }}>
          By proceeding you agree to the{" "}
          <Link href="/terms" style={{ color: "var(--forest)", textDecoration: "none" }}>Terms</Link>{" "}
          and{" "}
          <Link href="/privacy" style={{ color: "var(--forest)", textDecoration: "none" }}>Privacy Policy</Link>.
        </p>

        {error && (
          <div style={{
            padding: "10px 14px", background: "var(--ember-tint)", border: "1px solid var(--ember-soft)",
            borderRadius: 8, fontSize: 13.5, color: "var(--ember-deep)", lineHeight: 1.4,
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%", height: 44, background: loading ? "var(--forest-mid)" : "var(--forest)",
            color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
            letterSpacing: "-.005em", cursor: loading ? "not-allowed" : "pointer",
            transition: "background .15s ease", marginTop: 4,
          }}
          onMouseOver={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "var(--forest-deep)"; }}
          onMouseOut={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "var(--forest)"; }}
        >
          {loading ? "Creating account…" : "Create account"}
        </button>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--ink-3)", margin: 0 }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--forest)", fontWeight: 600, textDecoration: "none" }}>
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
