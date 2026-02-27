"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";

function VerifyPendingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") ?? "";
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleResend() {
    if (!email) return;
    setResending(true);
    try {
      await fetch("/api/email/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResent(true);
      setError(null);
    } catch {
      // Best effort
    } finally {
      setResending(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      setError("Email missing from this verification step. Please start from the signup page again.");
      return;
    }
    if (!code.trim()) {
      setError("Enter the verification code from your email.");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-passphrase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, passphrase: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not verify code. Try again.");
        setVerifying(false);
        return;
      }
      router.push("/login?verified=true");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <>
      <p className="text-center text-sm text-mono-medium mb-4">
        Welcome to ExpenseTerminal. Please check your email and confirm your
        account to get started.
      </p>

      {email && (
        <p className="text-center text-xs text-mono-light mb-4">
          We sent a verification email to <strong className="text-mono-medium">{email}</strong>
        </p>
      )}

      <form onSubmit={handleVerify} className="space-y-3.5 mb-6">
        <label className="block text-xs font-medium text-mono-medium">
          Verification code
        </label>
        <input
          type="text"
          required
          placeholder="e.g. ark-the-olive-dove"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="auth-input"
        />

        {error && (
          <p className="text-sm text-danger bg-bg-secondary border border-bg-tertiary p-3 rounded-lg">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={verifying}
          className="btn-warm w-full"
        >
          {verifying ? "Verifying..." : "Verify and continue"}
        </button>
      </form>

      <div className="border-t border-bg-tertiary pt-4 mt-2">
        <p className="text-center text-xs text-mono-light mb-3">
          Didn&apos;t see the email? You can resend it.
        </p>
        <button
          onClick={handleResend}
          disabled={resending || resent}
          className="btn-secondary w-full text-sm"
        >
          {resent
            ? "Verification Email Sent"
            : resending
            ? "Sending..."
            : "Resend Verification Email"}
        </button>
        {resent && (
          <p className="text-center text-xs text-success mt-3">
            Check your inbox — a new link and code are on the way.
          </p>
        )}
      </div>
    </>
  );
}

export default function VerifyPendingPage() {
  return (
    <AuthLayout>
      <Suspense
        fallback={
          <p className="text-center text-sm text-mono-light">Loading...</p>
        }
      >
        <VerifyPendingContent />
      </Suspense>
    </AuthLayout>
  );
}

