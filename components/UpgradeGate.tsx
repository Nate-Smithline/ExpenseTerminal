"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { startProCheckout } from "@/lib/billing/start-checkout";
import type { TrialStatus } from "@/lib/billing/trial";

// Pages that remain accessible even after trial expires
const EXEMPT = [
  "/onboarding",
  "/settings/billing",
  "/settings",
  "/pricing",
  "/auth",
  "/login",
  "/signup",
];

export function UpgradeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<TrialStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/onboarding")
      .then(r => r.json())
      .then(d => setStatus(d.trial.status))
      .catch(() => {});
  }, []);

  const isExempt = EXEMPT.some(p => pathname === p || pathname.startsWith(p + "/"));

  // Block the app when the trial has ended ("expired") or hasn't started yet
  // ("none" — the card-required trial needs a payment method first).
  const blocked = status === "expired" || status === "none";

  // While loading, render children (avoid flash of gate)
  if (!status || !blocked || isExempt) {
    return <>{children}</>;
  }

  const notStarted = status === "none";

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      await startProCheckout("year");
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="upgrade-gate">
      <div className="upgrade-gate__icon">
        <svg width={28} height={28} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 11V8a4 4 0 018 0v3" />
          <rect x="4" y="11" width="16" height="9" rx="2" />
        </svg>
      </div>
      <h2 className="upgrade-gate__title">
        {notStarted ? "Start your 15-day free trial" : "Your free trial has ended"}
      </h2>
      <p className="upgrade-gate__sub">
        {notStarted
          ? "Add a card to unlock your transactions, budgets, tax insights, and account sync. You won't be charged for 15 days, and you can cancel anytime."
          : "Subscribe to keep full access to your transactions, budgets, tax insights, and account sync."}
      </p>
      <div className="upgrade-gate__actions">
        <button type="button" className="onb-btn onb-btn--primary"
          disabled={loading} onClick={handleUpgrade}>
          {loading
            ? "Redirecting…"
            : notStarted
            ? "Start free trial — from $15/mo"
            : "Choose a plan — from $15/mo"}
        </button>
        <a href="/settings/billing"
          style={{ fontSize: 13, color: "var(--ink-3)", textDecoration: "none" }}>
          View billing settings
        </a>
      </div>
    </div>
  );
}
