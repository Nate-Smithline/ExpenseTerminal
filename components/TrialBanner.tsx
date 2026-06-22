"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { startProCheckout } from "@/lib/billing/start-checkout";
import type { TrialStatus } from "@/lib/billing/trial";

type StatusData = {
  status: TrialStatus;
  daysLeft: number;
};

// Pages where the banner is irrelevant or redundant
const HIDE_ON = ["/onboarding", "/settings/billing", "/pricing"];

export function TrialBanner() {
  const pathname = usePathname();
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/onboarding")
      .then(r => r.json())
      .then(d => setData({ status: d.trial.status, daysLeft: d.trial.daysLeft }))
      .catch(() => {});
  }, []);

  if (!data) return null;
  if (data.status === "subscribed") return null;
  if (HIDE_ON.some(p => pathname === p || pathname.startsWith(p + "/"))) return null;

  const isExpired = data.status === "expired";
  const notStarted = data.status === "none";
  // "none" and "expired" both render the locked treatment.
  const locked = isExpired || notStarted;

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      await startProCheckout("year");
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className={`trial-banner${locked ? " trial-banner--expired" : ""}`}>
      <span className="trial-banner__ic">
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {locked
            ? <><path d="M8 11V8a4 4 0 018 0v3" /><rect x="4" y="11" width="16" height="9" rx="2" /></>
            : <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
        </svg>
      </span>
      <div className="trial-banner__body">
        <div className="trial-banner__t">
          {isExpired
            ? "Your free trial has ended"
            : notStarted
            ? "Start your 15-day free trial"
            : `Free trial — ${data.daysLeft} day${data.daysLeft !== 1 ? "s" : ""} left`}
        </div>
        <div className="trial-banner__d">
          {isExpired
            ? "Upgrade to keep your data and access all features."
            : notStarted
            ? "Add a card to begin. No charge for 15 days — cancel anytime."
            : "Connect, tag, and explore. Subscribe anytime to keep everything."}
        </div>
      </div>
      <button type="button" className="trial-banner__cta" disabled={loading} onClick={handleUpgrade}>
        {loading ? "Redirecting…" : notStarted ? "Start free trial" : isExpired ? "Choose a plan" : "Upgrade now"}
      </button>
    </div>
  );
}
