"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPlanDefinition, type PlanId } from "@/lib/billing/plans";

export function PricingClient({
  checkoutSessionId,
  checkoutStatus,
}: {
  checkoutSessionId?: string;
  checkoutStatus?: string;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successPlan, setSuccessPlan] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlanId | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [downgradeModalOpen, setDowngradeModalOpen] = useState(false);
  const syncedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/billing/usage");
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        setCurrentPlan((data.plan as PlanId) ?? "free");
      } else {
        setCurrentPlan(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [successPlan]);

  useEffect(() => {
    if (!checkoutSessionId || syncedRef.current) return;
    syncedRef.current = true;
    setSyncing(true);
    setError(null);

    (async () => {
      const res = await fetch("/api/billing/checkout/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: checkoutSessionId }),
      });

      setSyncing(false);

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const planName = (data.plan === "plus" || data.plan === "starter") ? "Pro" : (data.plan ? String(data.plan).charAt(0).toUpperCase() + String(data.plan).slice(1) : "paid");
        setSuccessPlan(planName);
        setError(null);
        router.replace("/pricing");
        return;
      }

      const msg =
        [data.error, data.details].filter(Boolean).join(" — ") ||
        "Failed to sync subscription";
      setError(msg);
    })();
  }, [checkoutSessionId, router]);

  const planIds: PlanId[] = ["free", "plus"];
  const isPro = currentPlan === "starter" || currentPlan === "plus";

  const startCheckout = async () => {
    setCheckoutLoading(true);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "plus" }),
    });
    const data = await res.json().catch(() => ({}));
    setCheckoutLoading(false);
    if (res.ok && data.url) window.location.href = data.url;
    else setError(data.error ?? "Checkout failed");
  };

  return (
    <div>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        {planIds.map((id) => {
          const plan = getPlanDefinition(id);
          const isCurrentPlan = id === "plus" ? isPro : currentPlan === "free";

          return (
            <div
              key={plan.id}
              className="flex flex-col border border-[#E8EEF5] bg-[#F5F0E8] px-5 py-6 sm:px-6 sm:py-7"
            >
              <p className="font-display text-lg text-[#0D1F35]">
                {plan.name}
              </p>
              <p className="mt-1 text-sm text-[#5B82B4]">
                {plan.priceHuman}
                {plan.priceInterval === "year" && "/year"}
              </p>
              <p className="mt-3 text-sm text-mono-medium">
                {plan.description}
              </p>
              <ul className="mt-4 flex-1 space-y-3 list-none pl-0">
                {plan.highlights.map((h, i) => (
                  <li
                    key={i}
                    className="flex gap-3 text-sm text-mono-medium"
                  >
                    <span
                      className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full border border-[#5B82B4] bg-[#5B82B4]/10"
                      aria-hidden
                    />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              {plan.id === "free" && (
                <>
                  {isPro ? (
                    <button
                      type="button"
                      onClick={() => setDowngradeModalOpen(true)}
                      className="mt-4 w-full px-4 py-2 border border-[#E8EEF5] text-sm font-medium text-mono-dark hover:bg-[#E8EEF5] text-center"
                    >
                      Downgrade
                    </button>
                  ) : (
                    <>
                      {currentPlan !== null ? (
                        <button
                          type="button"
                          onClick={startCheckout}
                          disabled={checkoutLoading}
                          className="mt-4 w-full px-4 py-2 bg-[#2563EB] text-white text-sm font-medium rounded-none hover:bg-[#1D4ED8] disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {checkoutLoading ? "Redirecting…" : "Upgrade to Pro"}
                        </button>
                      ) : (
                        <Link
                          href="/signup"
                          className="mt-4 inline-block text-center w-full px-4 py-2 border border-[#E8EEF5] text-sm font-medium text-mono-dark hover:bg-[#E8EEF5]"
                        >
                          Get started
                        </Link>
                      )}
                    </>
                  )}
                </>
              )}
              {plan.id === "plus" && (
                <>
                  {isPro ? (
                    <Link
                      href="/settings/billing"
                      className="mt-4 inline-block text-center w-full px-4 py-2 bg-[#2563EB] text-white text-sm font-medium rounded-none hover:bg-[#1D4ED8]"
                    >
                      You&apos;re on Pro · Manage plan
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={startCheckout}
                      disabled={checkoutLoading}
                      className="mt-4 w-full px-4 py-2 bg-[#2563EB] text-white text-sm font-medium rounded-none hover:bg-[#1D4ED8] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {checkoutLoading ? "Redirecting…" : "Upgrade to Pro"}
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {downgradeModalOpen && (
        <div
          className="fixed inset-0 min-h-[100dvh] z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setDowngradeModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="downgrade-modal-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="downgrade-modal-title"
              className="text-lg font-semibold text-[#0D1F35]"
            >
              Downgrade to Free
            </h2>
            <p className="mt-3 text-sm text-mono-medium">
              To move back to the Free plan, cancel your subscription in billing.
              You’ll keep your current plan until the end of your billing period,
              then your account will switch to Free.
            </p>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDowngradeModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-mono-medium hover:bg-[#E8EEF5] rounded-none"
              >
                Cancel
              </button>
              <Link
                href="/settings/billing"
                className="px-4 py-2 text-sm font-medium bg-[#2563EB] text-white rounded-none hover:bg-[#1D4ED8]"
              >
                Go to Billing
              </Link>
            </div>
          </div>
        </div>
      )}

      <p className="mt-8 text-sm text-mono-medium">
        <Link href="/settings/billing" className="text-accent-navy underline hover:no-underline">
          Manage billing
        </Link>{" "}
        · <Link href="/" className="text-accent-navy underline hover:no-underline">Home</Link>{" "}
        · <Link href="/request-demo" className="text-accent-navy underline hover:no-underline">Request Demo</Link>
      </p>
    </div>
  );
}
