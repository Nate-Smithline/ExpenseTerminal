"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";

function VerifyPendingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") ?? "";
  const userId = searchParams.get("userId") ?? "";
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleResend() {
    if (!email) return;
    setResending(true);
    try {
      const res = await fetch("/api/email/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          userId: userId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not resend verification email. Try again in a few minutes.");
        setResent(false);
      } else {
        setResent(true);
        setError(null);
      }
    } catch {
      setError("Could not resend verification email. Check your connection and try again.");
    } finally {
      setResending(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      setError("Enter the verification code from your email.");
      return;
    }
    setVerifying(true);
    setError(null);
    // Use the same verification path as the email link so codes
    // always match what's stored, independent of email/user lookups.
    const token = code.trim();
    router.push("/auth/verify?token=" + encodeURIComponent(token));
  }

  return (
    <>
      <p className="text-center text-sm text-brand-dark-gray mb-4">
        Welcome to ExpenseTerminal. We sent a <strong className="text-brand-black">6-digit code</strong> to your email
        — or continue in the full onboarding flow at{" "}
        <a href="/onboarding" className="auth-text-link underline">
          /onboarding
        </a>
        .
      </p>

      {email && (
        <p className="text-center text-xs text-brand-dark-gray mb-4">
          We sent a verification email to <strong className="font-semibold text-brand-black">{email}</strong>
        </p>
      )}

      <form onSubmit={handleVerify} className="space-y-3.5 mb-6">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-brand-dark-gray">
          Verification code
        </label>
        <input
          type="text"
          required
          placeholder="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="auth-input"
        />

        {error && <p className="auth-banner-error">{error}</p>}

        <button
          type="submit"
          disabled={verifying}
          className="btn-warm w-full"
        >
          {verifying ? "Verifying..." : "Verify and continue"}
        </button>
      </form>

      <div className="border-t border-brand-medium-grey pt-4 mt-2">
        <p className="text-center text-xs text-brand-dark-gray mb-3">
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
          <p className="text-center text-xs text-brand-green mt-3 font-medium">
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
          <p className="text-center text-sm text-brand-dark-gray">Loading...</p>
        }
      >
        <VerifyPendingContent />
      </Suspense>
    </AuthLayout>
  );
}

