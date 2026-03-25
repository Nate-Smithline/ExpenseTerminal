"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getPlanDefinition } from "@/lib/billing/plans";
import { PreferencesTabs } from "@/app/preferences/PreferencesTabs";

type Usage = {
  plan: string;
  maxCsvTransactionsForAi: number | null;
  csvTransactions: {
    totalCsvUploaded: number;
    eligibleForAi: number;
    overLimitCount: number;
  };
  overLimit: boolean;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

type InvoiceItem = {
  id: string;
  date: string;
  amountPaid: number;
  currency: string;
  status: string;
  hostedInvoiceUrl: string | null;
  number: string | null;
};

const PREF_TABS = [
  { href: "/preferences/automations", label: "Automations" },
  { href: "/preferences/profile", label: "Profile" },
] as const;

export function BillingClient({
  checkoutSessionId,
}: {
  checkoutSessionId?: string;
}) {
  const router = useRouter();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successPlan, setSuccessPlan] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [portalLoading, setPortalLoading] = useState(false);
  const syncedRef = useRef(false);

  const fetchUsage = async () => {
    const res = await fetch("/api/billing/usage");
    if (res.ok) {
      const data = await res.json();
      setUsage(data);
    }
    setLoading(false);
  };

  const fetchInvoices = async () => {
    const res = await fetch("/api/billing/invoices");
    if (res.ok) {
      const data = await res.json();
      setInvoices(data.invoices ?? []);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, []);

  // When user has a paid plan, sync subscription from Stripe so we pick up cancellations
  // (e.g. after they return from the billing portal).
  useEffect(() => {
    if (!usage?.plan || usage.plan === "free") return;
    (async () => {
      const res = await fetch("/api/billing/sync-subscription", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.updated) await fetchUsage();
      }
    })();
  }, [usage?.plan]);

  useEffect(() => {
    if (usage?.plan && usage.plan !== "free") fetchInvoices();
  }, [usage?.plan]);

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
        await fetchUsage();
        router.replace("/settings/billing");
        return;
      }

      const msg = [data.error, data.details].filter(Boolean).join(" — ") || "Failed to sync subscription";
      setError(msg);
    })();
  }, [checkoutSessionId, router]);

  const startCheckout = async () => {
    setCheckoutLoading("plus");
    setError(null);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "plus" }),
    });
    const data = await res.json().catch(() => ({}));
    setCheckoutLoading(null);
    if (res.ok && data.url) {
      window.location.href = data.url;
      return;
    }
    setError(data.error ?? "Checkout failed");
  };

  const openPortal = async () => {
    setPortalLoading(true);
    setError(null);
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setPortalLoading(false);
    if (res.ok && data.url) {
      window.location.href = data.url;
      return;
    }
    setError(data.error ?? "Could not open billing portal");
  };

  const formatNextPayment = (iso: string | null) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return null;
    }
  };

  const formatCurrency = (cents: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toLowerCase(),
    }).format(cents / 100);
  };

  if (loading && !usage) {
    return (
      <div className="p-6">
        <p className="text-neutral-500">Loading billing…</p>
      </div>
    );
  }

  const isPro = usage?.plan === "plus" || usage?.plan === "starter";
  const isFreeUi = !isPro;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <div
            role="heading"
            aria-level={1}
            className="text-[32px] leading-tight font-sans font-normal text-mono-dark"
          >
            Billing
          </div>
          <p className="text-base text-mono-medium mt-1 font-sans">
            Manage your subscription, invoices, and receipts
          </p>
        </div>
        <PreferencesTabs tabs={PREF_TABS} />
      </div>

      {syncing && (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
          Processing your subscription…
        </p>
      )}
      {successPlan && (
        <p className="mt-2 text-sm text-green-600 dark:text-green-400">
          You’re now on the {successPlan} plan.
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Current plan summary in flat card */}
      <section className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7]">
        <div className="px-4 py-3">
          <div
            role="heading"
            aria-level={2}
            className="text-base md:text-lg font-normal font-sans text-mono-dark"
          >
            Current plan
          </div>
          <p className="mt-1 text-xs text-mono-medium font-sans">
            Your active subscription and renewal dates.
          </p>
        </div>
        <div className="px-4 py-3 space-y-2 text-xs font-sans text-mono-medium">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-semibold text-mono-dark min-w-[110px]">Plan</span>
            <span className="capitalize">
              {isFreeUi ? "Free plan" : isPro ? "Pro" : usage?.plan ?? "—"}
              {usage?.subscriptionStatus && usage.plan !== "free" ? ` (${usage.subscriptionStatus})` : ""}
            </span>
          </div>
          {!isFreeUi && usage?.currentPeriodEnd && (usage.plan === "starter" || usage.plan === "plus") && !usage?.cancelAtPeriodEnd && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="font-semibold text-mono-dark min-w-[110px]">Next payment</span>
              <span>
                {formatNextPayment(usage.currentPeriodEnd) ?? usage.currentPeriodEnd}
              </span>
            </div>
          )}
          {!isFreeUi && usage?.cancelAtPeriodEnd && (usage.plan === "starter" || usage.plan === "plus") && usage?.currentPeriodEnd && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="font-semibold text-mono-dark min-w-[110px]">Ends</span>
              <span>
                {formatNextPayment(usage.currentPeriodEnd) ?? usage.currentPeriodEnd} — then you’ll switch to Free.
              </span>
            </div>
          )}
          {usage?.subscriptionStatus === "canceled" && (
            <p className="text-xs text-mono-medium">
              No longer recurring — you’re on the Free plan.
            </p>
          )}
        </div>
      </section>

      {/* Subscription management in flat card */}
      {usage && isPro && (
        <section className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7]">
          <div className="px-4 py-3">
            <div
              role="heading"
              aria-level={2}
              className="text-base md:text-lg font-normal font-sans text-mono-dark"
            >
              Subscription
            </div>
            <p className="mt-1 text-xs text-mono-medium font-sans">
              Cancel or change your plan. You’ll keep access until the end of your billing period, then switch to Free.
            </p>
          </div>
          <div className="px-4 py-3">
            <button
              type="button"
              onClick={openPortal}
              disabled={portalLoading}
              className="px-4 py-2.5 text-sm font-medium font-sans bg-black text-white rounded-none hover:bg-black/85 disabled:opacity-50 transition-colors"
            >
              {portalLoading ? "Opening…" : "Manage subscription / Downgrade"}
            </button>
          </div>
        </section>
      )}

      {/* Usage summary in flat card */}
      {usage && isFreeUi && (
        <section className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7]">
          <div className="px-4 py-3">
            <div
              role="heading"
              aria-level={2}
              className="text-base md:text-lg font-normal font-sans text-mono-dark"
            >
              AI usage
            </div>
            <p className="mt-1 text-xs text-mono-medium font-sans">
              How many CSV transactions are eligible for automated review.
            </p>
          </div>
          <div className="px-4 py-3 space-y-3 text-xs font-sans text-mono-medium">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="font-semibold text-mono-dark min-w-[110px]">Eligible</span>
              <span>
                {usage.csvTransactions.eligibleForAi} of{" "}
                {usage.maxCsvTransactionsForAi == null ? "unlimited" : usage.maxCsvTransactionsForAi}{" "}
                transactions
              </span>
            </div>
            {usage.overLimit && (
              <p className="text-amber-600 text-xs">
                Over limit by {usage.csvTransactions.overLimitCount}. Upgrade for unlimited.
              </p>
            )}
            <div>
              <button
                type="button"
                onClick={() => startCheckout()}
                disabled={!!checkoutLoading}
                className="mt-1 px-4 py-2.5 bg-black text-white rounded-none text-sm font-medium font-sans hover:bg-black/85 disabled:opacity-50 transition-colors"
              >
                {checkoutLoading === "plus"
                  ? "Redirecting…"
                  : `Upgrade to Pro (${getPlanDefinition("plus").priceHuman}/year)`}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Past receipts in flat card */}
      {invoices.length > 0 && (
        <section className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7]">
          <div className="px-4 py-3">
            <div
              role="heading"
              aria-level={2}
              className="text-base md:text-lg font-normal font-sans text-mono-dark"
            >
              Past receipts
            </div>
            <p className="mt-1 text-xs text-mono-medium font-sans">
              Download invoices for your records.
            </p>
          </div>
          <div className="px-4 py-3">
            <ul className="space-y-2 text-xs font-sans text-mono-medium">
              {invoices.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span>
                    {inv.date}
                    {inv.number ? ` · ${inv.number}` : ""}
                    {" — "}
                    {formatCurrency(inv.amountPaid, inv.currency)}
                  </span>
                  {inv.hostedInvoiceUrl ? (
                    <a
                      href={inv.hostedInvoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-mono-dark underline hover:no-underline"
                    >
                      View receipt
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {isFreeUi && (
        <p className="text-sm text-neutral-500">
          <Link href="/pricing" className="underline hover:no-underline">
            View plans and pricing
          </Link>
        </p>
      )}
    </div>
  );
}
