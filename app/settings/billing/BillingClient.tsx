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
          {syncing && <p style={{ fontSize: 13, color: "var(--wheat-deep, #b45309)" }}>Processing your subscription…</p>}
          {successPlan && <p style={{ fontSize: 13, color: "var(--forest-deep)" }}>You&apos;re now on the {successPlan} plan.</p>}
          {error && <p style={{ fontSize: 13, color: "var(--ember)" }}>{error}</p>}
        </div>
      )}

      {/* ── Active subscriber view ── */}
      {isPro && (
        <div className="setting-section">
          <div className="setting-section__head">
            <h2 className="setting-section__title">Your plan</h2>
            <p className="setting-section__sub">Active subscription and renewal details.</p>
          </div>
          <div className="setting-section__body">
            <div className="plan">
              <div className="plan__main">
                <div className="plan__name">ExpenseTerminal Pro</div>
                <div className="plan__sub">Manage payment method and cancellation below.</div>
                <ul className="plan__perks">
                  {proPlan.highlights.map((h) => (
                    <li key={h}><ICheck size={14} />{h}</li>
                  ))}
                </ul>
                {usage?.currentPeriodEnd && !usage?.cancelAtPeriodEnd && (
                  <p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 14 }}>
                    Next payment: <strong style={{ color: "var(--ink)" }}>{formatNextPayment(usage.currentPeriodEnd) ?? usage.currentPeriodEnd}</strong>
                  </p>
                )}
                {usage?.cancelAtPeriodEnd && usage?.currentPeriodEnd && (
                  <p style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 14 }}>
                    Ends <strong style={{ color: "var(--ink)" }}>{formatNextPayment(usage.currentPeriodEnd) ?? usage.currentPeriodEnd}</strong> — then switches to Free.
                  </p>
                )}
              </div>
              <div className="plan__price">
                <div className="money money--xl">{formatProPrice(billingInterval)}</div>
                <div style={{ color: "var(--ink-3)", fontSize: 13 }}>per {billingInterval}</div>
                <button type="button" className="btn btn--ghost" style={{ marginTop: 14 }} disabled={portalLoading} onClick={openPortal}>
                  {portalLoading ? "Opening…" : "Manage subscription"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Free / unsubscribed view ── */}
      {isFreeUi && (
        <div className="setting-section">
          <div className="setting-section__head">
            <h2 className="setting-section__title">Upgrade to Pro</h2>
            <p className="setting-section__sub">Live bank sync, unlimited AI review, and full Schedule C tools.</p>
          </div>
          <div className="setting-section__body">
            <div className="billing-plans">
              {/* Monthly */}
              <div className={`billing-plan${billingInterval === "month" ? " billing-plan--selected" : ""}`} onClick={() => setBillingInterval("month")}>
                <div className="billing-plan__label">Monthly</div>
                <div className="billing-plan__price">
                  <span className="billing-plan__amount">{proPlan.priceMonthlyHuman}</span>
                  <span className="billing-plan__per">/mo</span>
                </div>
                <div className="billing-plan__note">Billed monthly</div>
              </div>

              {/* Annual */}
              <div className={`billing-plan${billingInterval === "year" ? " billing-plan--selected" : ""}`} onClick={() => setBillingInterval("year")}>
                <div className="billing-plan__label">
                  Annual
                  <span className="billing-plan__badge">Save 17%</span>
                </div>
                <div className="billing-plan__price">
                  <span className="billing-plan__amount">$15</span>
                  <span className="billing-plan__per">/mo</span>
                </div>
                <div className="billing-plan__note">{proPlan.priceYearlyHuman} billed yearly</div>
              </div>
            </div>

            <ul className="billing-features">
              {proPlan.highlights.map((h) => (
                <li key={h}><ICheck size={14} />{h}</li>
              ))}
            </ul>

            <button
              type="button"
              className="btn btn--primary billing-cta"
              disabled={!!checkoutLoading}
              onClick={startCheckout}
            >
              {checkoutLoading ? "Redirecting to checkout…" : `Get Pro — ${formatProPrice(billingInterval)}`}
            </button>
            <p style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 8 }}>
              15-day free trial · Cancel anytime · <Link href="/pricing" style={{ color: "var(--ink-3)" }}>See full pricing</Link>
            </p>
          </div>
        </div>
      )}

      {/* ── Invoice history ── */}
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
                    <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--mini">View receipt</a>
                  ) : <span />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
