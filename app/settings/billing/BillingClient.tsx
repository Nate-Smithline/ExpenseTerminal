"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ICheck } from "@/components/ui/icons";
import {
  formatProPrice,
  getPlanDefinition,
  type BillingInterval,
} from "@/lib/billing/plans";
import { startProCheckout } from "@/lib/billing/start-checkout";

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
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("year");
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
        const planName =
          data.plan === "plus" || data.plan === "starter"
            ? "Pro"
            : data.plan
              ? String(data.plan).charAt(0).toUpperCase() + String(data.plan).slice(1)
              : "paid";
        setSuccessPlan(planName);
        setError(null);
        await fetchUsage();
        router.replace("/settings/billing");
        return;
      }

      const msg =
        [data.error, data.details].filter(Boolean).join(" — ") ||
        "Failed to sync subscription";
      setError(msg);
    })();
  }, [checkoutSessionId, router]);

  const startCheckout = async () => {
    setCheckoutLoading("plus");
    setError(null);
    const result = await startProCheckout(billingInterval);
    setCheckoutLoading(null);
    if (!result.ok) {
      setError(result.error ?? "Checkout failed");
    }
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
      return new Date(iso).toLocaleDateString("en-US", {
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
      <div className="settings-panel">
        <p style={{ fontSize: 14, color: "var(--ink-3)" }}>Loading billing…</p>
      </div>
    );
  }

  const isPro = usage?.plan === "plus" || usage?.plan === "starter";
  const isFreeUi = !isPro;
  const freePlan = getPlanDefinition("free");
  const proPlan = getPlanDefinition("plus");
  const planLabel = isFreeUi ? "Free" : isPro ? "Pro" : (usage?.plan ?? "—");

  return (
    <div className="settings-panel">
      {(syncing || successPlan || error) && (
        <div style={{ marginBottom: 16 }}>
          {syncing && (
            <p style={{ fontSize: 13, color: "var(--wheat-deep, #b45309)" }}>
              Processing your subscription…
            </p>
          )}
          {successPlan && (
            <p style={{ fontSize: 13, color: "var(--forest-deep)" }}>
              You&apos;re now on the {successPlan} plan.
            </p>
          )}
          {error && (
            <p style={{ fontSize: 13, color: "var(--ember)" }}>{error}</p>
          )}
        </div>
      )}

      <div className="setting-section">
        <div className="setting-section__head">
          <h2 className="setting-section__title">Plan</h2>
          <p className="setting-section__sub">
            {isFreeUi
              ? "You're on the free plan. Upgrade for live bank sync and unlimited AI review."
              : "Your active subscription and renewal dates."}
          </p>
        </div>
        <div className="setting-section__body">
          <div className="plan">
            <div className="plan__main">
              <div className="plan__name">
                ExpenseTerminal · {planLabel}
                {usage?.subscriptionStatus && usage.plan !== "free"
                  ? ` (${usage.subscriptionStatus})`
                  : ""}
              </div>
              <div className="plan__sub">
                {isFreeUi
                  ? freePlan.description
                  : "Manage payment method and cancellation in the Stripe portal."}
              </div>
              <ul className="plan__perks">
                {(isFreeUi ? freePlan : proPlan).highlights.map((h) => (
                  <li key={h}>
                    <ICheck size={14} />
                    {h}
                  </li>
                ))}
              </ul>
              {!isFreeUi && usage?.currentPeriodEnd && !usage?.cancelAtPeriodEnd && (
                <p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 14 }}>
                  Next payment:{" "}
                  <strong style={{ color: "var(--ink)" }}>
                    {formatNextPayment(usage.currentPeriodEnd) ?? usage.currentPeriodEnd}
                  </strong>
                </p>
              )}
              {!isFreeUi && usage?.cancelAtPeriodEnd && usage?.currentPeriodEnd && (
                <p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 14 }}>
                  Ends{" "}
                  <strong style={{ color: "var(--ink)" }}>
                    {formatNextPayment(usage.currentPeriodEnd) ?? usage.currentPeriodEnd}
                  </strong>
                  {" "}— then you&apos;ll switch to Free.
                </p>
              )}
              {usage?.subscriptionStatus === "canceled" && (
                <p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 14 }}>
                  No longer recurring — you&apos;re on the Free plan.
                </p>
              )}
            </div>
            <div className="plan__price">
              <div className="money money--xl">
                {isFreeUi
                  ? freePlan.priceHuman
                  : formatProPrice(billingInterval)}
              </div>
              <div style={{ color: "var(--ink-3)", fontSize: 13 }}>
                {isFreeUi
                  ? "per year"
                  : billingInterval === "month"
                    ? "per month"
                    : "per year"}
              </div>
              {isPro ? (
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ marginTop: 14 }}
                  disabled={portalLoading}
                  onClick={openPortal}
                >
                  {portalLoading ? "Opening…" : "Manage subscription"}
                </button>
              ) : (
                <>
                  <div
                    className="billing-interval-toggle"
                    style={{
                      display: "flex",
                      gap: 6,
                      marginTop: 14,
                      fontSize: 12,
                    }}
                  >
                    <button
                      type="button"
                      className={`btn btn--ghost btn--mini${billingInterval === "month" ? " btn--active" : ""}`}
                      onClick={() => setBillingInterval("month")}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      className={`btn btn--ghost btn--mini${billingInterval === "year" ? " btn--active" : ""}`}
                      onClick={() => setBillingInterval("year")}
                    >
                      Annual
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn--primary"
                    style={{ marginTop: 10 }}
                    disabled={!!checkoutLoading}
                    onClick={startCheckout}
                  >
                    {checkoutLoading
                      ? "Redirecting…"
                      : `Upgrade to Pro (${formatProPrice(billingInterval)})`}
                  </button>
                  <p style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 8 }}>
                    {proPlan.priceMonthlyHuman}/mo or {proPlan.priceYearlyHuman}/yr
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {usage && isFreeUi && usage.maxCsvTransactionsForAi != null && (
        <div className="setting-section">
          <div className="setting-section__head">
            <h2 className="setting-section__title">AI usage</h2>
            <p className="setting-section__sub">
              CSV transactions eligible for automated review.
            </p>
          </div>
          <div className="setting-section__body">
            <p style={{ fontSize: 14, color: "var(--ink-2)", margin: 0 }}>
              {usage.csvTransactions.eligibleForAi} of {usage.maxCsvTransactionsForAi}{" "}
              transactions
            </p>
            {usage.overLimit && (
              <p style={{ fontSize: 13, color: "var(--ember)", marginTop: 8 }}>
                Over limit by {usage.csvTransactions.overLimitCount}. Upgrade for unlimited.
              </p>
            )}
          </div>
        </div>
      )}

      {invoices.length > 0 && (
        <div className="setting-section">
          <div className="setting-section__head">
            <h2 className="setting-section__title">Invoice history</h2>
            <p className="setting-section__sub">Download receipts for your records.</p>
          </div>
          <div className="setting-section__body">
            <div className="invoices">
              {invoices.map((inv) => (
                <div key={inv.id} className="invoices__row">
                  <span>{inv.date}</span>
                  <span>{inv.number ?? "—"}</span>
                  <span>{formatCurrency(inv.amountPaid, inv.currency)}</span>
                  {inv.hostedInvoiceUrl ? (
                    <a
                      href={inv.hostedInvoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn--ghost btn--mini"
                    >
                      View receipt
                    </a>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isFreeUi && (
        <p style={{ fontSize: 13, color: "var(--ink-3)" }}>
          <Link href="/pricing" style={{ color: "var(--ink-2)", textDecoration: "underline" }}>
            View plans and pricing
          </Link>
        </p>
      )}
    </div>
  );
}
