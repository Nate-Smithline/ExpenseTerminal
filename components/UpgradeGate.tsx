"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { startProCheckout } from "@/lib/billing/start-checkout";
import type { TrialStatus } from "@/lib/billing/trial";

const ALLOWED_WHEN_LOCKED = ["/settings/billing"];

export function UpgradeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<TrialStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/onboarding", { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!cancelled) setStatus(d?.trial?.status ?? "none");
      })
      .catch(() => {
        if (!cancelled) setStatus("none");
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const hasPremiumAccess = status === "trial" || status === "subscribed";
  const allowedWhenLocked = ALLOWED_WHEN_LOCKED.some(p => pathname === p || pathname.startsWith(p + "/"));

  if (hasPremiumAccess || allowedWhenLocked) {
    return <>{children}</>;
  }

  if (!status) {
    return (
      <div className="upgrade-gate">
        <p className="upgrade-gate__sub">Checking access...</p>
      </div>
    );
  }

  const notStarted = status === "none";

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const result = await startProCheckout("month");
      if (!result.ok) setLoading(false);
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
        Your free access has ended
      </h2>
      <p className="upgrade-gate__sub">
        {notStarted
          ? "Choose a plan to use ExpenseTerminal."
          : "Subscribe to keep triage, tax insights, budgeting, and reporting open."}
      </p>
      <div className="upgrade-gate__actions">
        <button type="button" className="onb-btn onb-btn--primary"
          disabled={loading} onClick={handleUpgrade}>
          {loading
            ? "Redirecting…"
            : notStarted
            ? "Choose a plan — from $15/mo"
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
