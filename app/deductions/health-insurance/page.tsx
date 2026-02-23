"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BackToDeductionsLink } from "@/components/BackToDeductionsLink";
import { CurrencyInput } from "@/components/CurrencyInput";
import { getStickyTaxYearClient } from "@/lib/tax-year-cookie";

const DEFAULT_TAX_RATE = 0.24;

export default function HealthInsurancePage() {
  const router = useRouter();
  const [amount, setAmount] = useState(8000);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);

  const taxSavings = amount * DEFAULT_TAX_RATE;
  const taxYear = getStickyTaxYearClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/deductions?tax_year=${taxYear}`);
      if (!res.ok || cancelled) return;
      const json = await res.json().catch(() => ({}));
      const list = json.data ?? [];
      const existing = list.find((d: { type: string }) => d.type === "health_insurance");
      if (existing?.amount != null && !cancelled) {
        setAmount(Number(existing.amount));
      }
    })();
    return () => { cancelled = true; };
  }, [taxYear]);

  async function handleAdd() {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/deductions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "health_insurance",
          tax_year: taxYear,
          amount,
          tax_savings: taxSavings,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setToast({ message: `Health insurance deduction added for ${taxYear}`, kind: "success" });
      setTimeout(() => setToast(null), 4000);
      router.refresh();
    } catch (e) {
      console.error(e);
      setToast({ message: "Failed to save deduction", kind: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!confirm(`Remove health insurance deduction for ${taxYear}? This cannot be undone.`)) return;
    setClearing(true);
    setToast(null);
    try {
      const res = await fetch("/api/deductions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "health_insurance", tax_year: taxYear }),
      });
      if (!res.ok) throw new Error("Failed to clear");
      setToast({ message: `Health insurance deduction cleared for ${taxYear}`, kind: "success" });
      setTimeout(() => setToast(null), 4000);
      router.refresh();
    } catch {
      setToast({ message: "Failed to clear deduction", kind: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-3xl font-bold text-mono-dark mb-2">
          Health Insurance Deduction
        </h1>
        <p className="text-mono-medium text-sm">
          Self-employed health insurance premium deduction
        </p>
      </div>

      <div className="space-y-2">
        <div>
          <BackToDeductionsLink>Go Back</BackToDeductionsLink>
        </div>
        <div className="card p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-mono-dark mb-2">
            Premiums Paid ($)
          </label>
          <CurrencyInput value={amount} onChange={setAmount} min={0} placeholder="0.00" />
        </div>
        <div className="bg-bg-secondary rounded-lg p-4">
          <p className="text-sm font-medium text-mono-dark">
            Est. Tax Savings at {(DEFAULT_TAX_RATE * 100).toFixed(0)}%: $
            {taxSavings.toFixed(2)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 pt-1">
          <button
            onClick={handleAdd}
            disabled={saving || amount <= 0}
            className="btn-primary"
          >
            {saving ? "Saving…" : "Add to My Deductions"}
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={clearing}
            className="rounded-full border border-bg-tertiary/60 px-4 py-2 text-sm font-medium text-mono-medium hover:bg-bg-tertiary/40 transition disabled:opacity-50"
          >
            {clearing ? "Clearing…" : "Clear deduction"}
          </button>
        </div>
      </div>
      </div>

      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-lg px-4 py-2.5 text-sm shadow-lg ${
            toast.kind === "success" ? "bg-accent-sage text-white" : "bg-accent-red/90 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
