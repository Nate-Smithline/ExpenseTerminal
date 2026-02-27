"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { validatePassword } from "@/lib/validation/password";
import { AuthLayout } from "@/components/AuthLayout";
import Link from "next/link";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid or expired reset link. Please request a new one.");
      setReady(false);
      return;
    }
    setReady(true);
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("Invalid or expired reset link. Please request a new one.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    const check = validatePassword(password);
    if (!check.valid) {
      setError(check.message ?? "Password does not meet requirements.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
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

  if (!ready && !error) {
    return (
      <AuthLayout>
        <p className="text-center text-sm text-mono-medium">Checking link...</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <p className="text-center text-sm text-mono-medium mb-8">
        Set a new password for your account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <input
          type="password"
          name="new-password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="auth-input"
        />
        <input
          type="password"
          name="new-password-confirmation"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
          {loading ? "Updating..." : "Set new password"}
        </button>
      </form>

      <p className="mt-6 text-sm text-mono-medium text-center">
        <Link href="/login" className="text-accent-navy font-medium">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout>
          <p className="text-center text-sm text-mono-medium">Checking link...</p>
        </AuthLayout>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
