"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
        const planName = data.plan ? String(data.plan).charAt(0).toUpperCase() + String(data.plan).slice(1) : "paid";
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

  const startCheckout = async (plan: "starter" | "plus") => {
    setCheckoutLoading(plan);
    setError(null);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
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

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        Billing
      </h1>

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

      <div className="mt-6 space-y-4">
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
          <p className="font-medium text-neutral-900 dark:text-neutral-100">
            Current plan
          </p>
          <p className="text-neutral-600 dark:text-neutral-400 capitalize">
            {usage?.plan ?? "—"}
            {usage?.subscriptionStatus && usage.plan !== "free" ? ` (${usage.subscriptionStatus})` : ""}
          </p>
          {usage?.subscriptionStatus === "canceled" && (
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
              No longer recurring — you’re on the Free plan.
            </p>
          )}
          {usage?.cancelAtPeriodEnd && (usage.plan === "starter" || usage.plan === "plus") && usage?.currentPeriodEnd && (
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
              No longer recurring. Access until {formatNextPayment(usage.currentPeriodEnd) ?? usage.currentPeriodEnd} — then you’ll switch to Free.
            </p>
          )}
          {usage?.currentPeriodEnd && (usage.plan === "starter" || usage.plan === "plus") && !usage?.cancelAtPeriodEnd && (
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
              Next payment: {formatNextPayment(usage.currentPeriodEnd) ?? usage.currentPeriodEnd}
            </p>
          )}
        </div>

        {usage && (usage.plan === "starter" || usage.plan === "plus") && (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
            <p className="font-medium text-neutral-900 dark:text-neutral-100">
              Subscription
            </p>
            <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-3">
              Cancel or change your plan. You’ll keep access until the end of your billing period, then switch to Free.
            </p>
            <button
              type="button"
              onClick={openPortal}
              disabled={portalLoading}
              className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
            >
              {portalLoading ? "Opening…" : "Manage subscription / Downgrade"}
            </button>
          </div>
        )}

        {usage && (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
            <p className="font-medium text-neutral-900 dark:text-neutral-100">
              CSV AI usage
            </p>
            <p className="text-neutral-600 dark:text-neutral-400">
              {usage.csvTransactions.eligibleForAi} of{" "}
              {usage.maxCsvTransactionsForAi == null
                ? "unlimited"
                : usage.maxCsvTransactionsForAi}{" "}
              transactions eligible for AI review
            </p>
            {usage.overLimit && (
              <p className="text-amber-600 dark:text-amber-400 text-sm mt-1">
                Over limit by {usage.csvTransactions.overLimitCount}. Upgrade for
                unlimited.
              </p>
            )}
          </div>
        )}

        {usage?.plan === "free" && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              onClick={() => startCheckout("starter")}
              disabled={!!checkoutLoading}
              className="px-4 py-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {checkoutLoading === "starter" ? "Redirecting…" : "Upgrade to Starter"}
            </button>
            <button
              type="button"
              onClick={() => startCheckout("plus")}
              disabled={!!checkoutLoading}
              className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
            >
              {checkoutLoading === "plus" ? "Redirecting…" : "Upgrade to Plus"}
            </button>
          </div>
        )}

        {invoices.length > 0 && (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
            <p className="font-medium text-neutral-900 dark:text-neutral-100">
              Past receipts
            </p>
            <ul className="mt-3 space-y-2">
              {invoices.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span className="text-neutral-600 dark:text-neutral-400">
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
                      className="text-neutral-700 dark:text-neutral-300 underline hover:no-underline"
                    >
                      View receipt
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="mt-6 text-sm text-neutral-500">
        <Link href="/pricing" className="underline hover:no-underline">
          View plans and pricing
        </Link>
      </p>
    </div>
  );
}
