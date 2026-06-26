"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { startProCheckout } from "@/lib/billing/start-checkout";
import type { TrialStatus } from "@/lib/billing/trial";

const PREMIUM_ROUTES = ["/budget", "/cashflow"];

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

  const premiumRoute = PREMIUM_ROUTES.find(p => pathname === p || pathname.startsWith(p + "/"));
  const hasPremiumAccess = status === "trial" || status === "subscribed";

  // While loading, render children (avoid flash of gate)
  if (!status || !premiumRoute || hasPremiumAccess) {
    return <>{children}</>;
  }

  const notStarted = status === "none";
  const featureName = premiumRoute === "/cashflow" ? "Cash Flow" : "Budget";

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
        {featureName} is a premium workspace
      </h2>
      <p className="upgrade-gate__sub">
        {notStarted
          ? `Start your 15-day free trial to unlock ${featureName.toLowerCase()}, planning views, and the rest of Pro. You will not be charged for 15 days.`
          : `Subscribe to keep ${featureName.toLowerCase()} open alongside triage, tax insights, and reporting.`}
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
