"use client";

import { useState, useRef } from "react";
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
      <p className="text-center text-sm text-mono-medium mb-8">
        Reset the password for your ExpenseTerminal account.
      </p>

      {!emailSent ? (
        <form onSubmit={handleSendCode} className="space-y-3.5">
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
            {loading ? "Sending..." : "Send Reset Code"}
          </button>
        </form>
      ) : (
        <>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3 mb-4">
            <p className="text-sm text-green-800">
              If an account exists for <span className="font-medium">{email}</span>, we&apos;ve sent a reset code.
            </p>
            <p className="text-xs text-mono-medium">
              Check your email for a Bible-word style code (for example: <span className="font-mono">ark-the-olive-dove</span>), then enter it below with your new password.
            </p>
          </div>

          <form onSubmit={handleCompleteReset} className="space-y-3.5">
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
              {loading ? "Updating..." : "Reset password"}
            </button>
          </form>

          <button
            type="button"
            onClick={handleResendCode}
            disabled={loading}
            className="mt-4 w-full text-sm text-mono-medium underline underline-offset-4 hover:text-accent-navy transition-colors"
          >
            Resend reset code
          </button>
        </>
      )}

      <p className="mt-6 text-sm text-mono-medium text-center">
        <Link href="/login" className="text-accent-navy font-medium">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

