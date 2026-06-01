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

  // While loading, render children (avoid flash of gate)
  if (!status || status !== "expired" || isExempt) {
    return <>{children}</>;
  }

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
      <h2 className="upgrade-gate__title">Your free trial has ended</h2>
      <p className="upgrade-gate__sub">
        Subscribe to keep full access to your transactions, budgets, tax insights, and account sync.
      </p>
      <div className="upgrade-gate__actions">
        <button type="button" className="onb-btn onb-btn--primary"
          disabled={loading} onClick={handleUpgrade}>
          {loading ? "Redirecting…" : "Choose a plan — from $15/mo"}
        </button>
        <a href="/settings/billing"
          style={{ fontSize: 13, color: "var(--ink-3)", textDecoration: "none" }}>
          View billing settings
        </a>
      </div>
    </div>
  );
}
