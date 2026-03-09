"use client";

import { useState, useCallback } from "react";

const PRO_PRICE = "$400/year";

const PRO_BENEFITS = [
  "Unlimited AI categorization",
  "Multiple Stripe bank connections",
  "Full transaction history (beyond 30 days)",
  "Rules & alerts automation",
];

export function UpgradeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleUpgrade = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "plus" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 min-h-[100dvh] z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div className="rounded-xl bg-white shadow-xl max-w-md w-full overflow-hidden border border-bg-tertiary/40">
        <div className="bg-[#2d3748] px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="upgrade-modal-title" className="text-xl font-bold text-white tracking-tight">
                Upgrade to Pro
              </h2>
              <p className="text-sm text-white/85 mt-1.5">
                Your Free plan has limits. Pro is {PRO_PRICE} and unlocks the full power of ExpenseTerminal.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition shrink-0"
              aria-label="Close"
            >
              <span className="material-symbols-rounded text-[18px]">close</span>
            </button>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-mono-medium">
            On average, organized businesses save time and avoid missed deductions at tax time. Pro helps you stay on top of expenses year-round.
          </p>
          <ul className="space-y-2">
            {PRO_BENEFITS.map((benefit, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-mono-dark">
                <span className="material-symbols-rounded text-accent-sage text-[18px]">check_circle</span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-bg-tertiary/40">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-bg-tertiary bg-white px-4 py-2.5 text-sm font-semibold text-mono-dark hover:bg-bg-secondary transition"
          >
            Maybe later
          </button>
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={loading}
            className="rounded-md bg-mono-dark px-4 py-2.5 text-sm font-semibold text-white hover:bg-mono-dark/90 transition disabled:opacity-60"
          >
            {loading ? "Redirecting…" : "Upgrade to Pro"}
          </button>
        </div>
      </div>
    </div>
  );
}
