"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { validatePassword } from "@/lib/validation/password";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") {
        e.preventDefault();
        router.push("/login");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    const emailValue = email.trim();
    if (!emailValue) {
      setError("Enter your email.");
      return;
    }
    setLoading(true);
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
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Request failed. Please try again.");
        setLoading(false);
        return;
      }
      setEmailSent(true);
    } catch {
      setError("Could not send reset code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    const emailValue = email.trim();
    if (!emailValue) return;
    setLoading(true);
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
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Request failed. Please try again.");
        setLoading(false);
        return;
      }
    } catch {
      setError("Could not resend reset code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const codeValue = resetCode.trim();
    if (!codeValue) {
      setError("Enter the reset code from your email.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      return;
    }
    const check = validatePassword(newPassword);
    if (!check.valid) {
      setError(check.message ?? "Password does not meet requirements.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: codeValue, password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not update password. Please try again.");
        setLoading(false);
        return;
      }
      router.push("/login?reset=success");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-center text-xl md:text-[22px] mb-6">Reset your password</h1>

      {!emailSent ? (
        <form onSubmit={handleSendCode} className="space-y-3.5 w-full min-w-0">
          <input
            ref={emailInputRef}
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
          />

          {error && <p className="auth-banner-error">{error}</p>}

          <button type="submit" disabled={loading} className="auth-btn-primary mt-2">
            {loading ? "Sending..." : "Send Reset Code"}
          </button>
        </form>
      ) : (
        <>
          <div className="auth-banner-info mb-4 space-y-1">
            <p className="text-sm text-brand-black">
              If an account exists for <span className="font-semibold">{email}</span>, we&apos;ve sent a reset code.
            </p>
          </div>

          <form onSubmit={handleCompleteReset} className="space-y-3.5 w-full min-w-0">
            <input
              type="text"
              required
              placeholder="Reset code from your email"
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value)}
              className="auth-input"
            />
            <input
              type="password"
              name="new-password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="auth-input"
            />
            <input
              type="password"
              name="new-password-confirmation"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Confirm new password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="auth-input"
            />

            {error && <p className="auth-banner-error">{error}</p>}

            <button type="submit" disabled={loading} className="auth-btn-primary mt-2">
              {loading ? "Updating..." : "Reset password"}
            </button>
          </form>

          <button
            type="button"
            onClick={handleResendCode}
            disabled={loading}
            className="auth-text-link mt-4 w-full text-center underline underline-offset-4"
          >
            Resend reset code
          </button>
        </>
      )}

      <p className="mt-6 text-sm text-brand-dark-gray text-center">
        <Link href="/login" className="auth-text-link inline-flex items-center gap-2 justify-center">
          <span className="kbd-hint hidden md:inline-flex">Esc</span>
          <span>Back to sign in</span>
        </Link>
      </p>
    </AuthLayout>
  );
}

