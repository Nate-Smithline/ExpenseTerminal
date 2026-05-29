"use client";

import { useState, useCallback } from "react";
import { formatProPrice, type BillingInterval } from "@/lib/billing/plans";
import { startProCheckout } from "@/lib/billing/start-checkout";

const PRO_BENEFITS = [
  "Unlimited AI categorization",
  "Multiple bank connections",
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
  const [interval, setInterval] = useState<BillingInterval>("year");

  const handleUpgrade = useCallback(async () => {
    setLoading(true);
    try {
      const result = await startProCheckout(interval);
      if (!result.ok) setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [interval]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 min-h-[100dvh] z-[200] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div className="bg-white shadow-xl max-w-md w-full mx-4 overflow-hidden rounded-none border border-bg-tertiary/40">
        <div className="px-6 pt-4 pb-2">
          <div
            id="upgrade-modal-title"
            role="heading"
            aria-level={2}
            className="text-xl font-normal font-sans text-mono-dark"
          >
            Upgrade to Pro
          </div>
          <p className="text-sm text-mono-medium mt-1.5 font-sans">
            Your Free plan has limits. Pro is {formatProPrice(interval)} and unlocks the full power of ExpenseTerminal.
          </p>
        </div>
        <div className="px-6 pb-4 pt-2 space-y-4">
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setInterval("month")}
              className={`px-2 py-1 border ${interval === "month" ? "border-black text-mono-dark" : "border-bg-tertiary/40 text-mono-medium"}`}
            >
              $18/mo
            </button>
            <button
              type="button"
              onClick={() => setInterval("year")}
              className={`px-2 py-1 border ${interval === "year" ? "border-black text-mono-dark" : "border-bg-tertiary/40 text-mono-medium"}`}
            >
              $180/yr
            </button>
          </div>
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
        <div className="flex justify-end gap-3 px-6 pt-1 pb-3 border-t border-bg-tertiary/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium font-sans bg-[#F0F1F7] text-mono-dark rounded-none hover:bg-[#F5F0E8] transition"
          >
            Maybe later
          </button>
          <button
            type="button"
            onClick={handleUpgrade}
            disabled={loading}
            className="px-4 py-2.5 text-sm font-medium font-sans bg-black text-white rounded-none hover:bg-black/80 transition disabled:opacity-60"
          >
            {loading ? "Redirecting…" : `Upgrade to Pro (${formatProPrice(interval)})`}
          </button>
        </div>
      </div>
    </div>
  );
}
