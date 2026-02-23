"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BackToDeductionsLink } from "@/components/BackToDeductionsLink";
import { CurrencyInput } from "@/components/CurrencyInput";
import { getStickyTaxYearClient } from "@/lib/tax-year-cookie";

const DEFAULT_TAX_RATE = 0.24;

export default function RetirementPage() {
  const router = useRouter();
  const [amount, setAmount] = useState(20000);
  const [type, setType] = useState("solo_401k");
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
      const existing = list.find((d: { type: string }) => d.type === "retirement");
      if (existing && !cancelled) {
        if (existing.amount != null) setAmount(Number(existing.amount));
        const planType = (existing.metadata as { plan_type?: string } | null)?.plan_type;
        if (planType && ["solo_401k", "sep_ira", "simple_ira"].includes(planType)) setType(planType);
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
          type: "retirement",
          tax_year: taxYear,
          amount,
          tax_savings: taxSavings,
          metadata: { plan_type: type },
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setToast({ message: `Retirement deduction added for ${taxYear}`, kind: "success" });
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
    if (!confirm(`Remove retirement deduction for ${taxYear}? This cannot be undone.`)) return;
    setClearing(true);
    setToast(null);
    try {
      const res = await fetch("/api/deductions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "retirement", tax_year: taxYear }),
      });
      if (!res.ok) throw new Error("Failed to clear");
      setToast({ message: `Retirement deduction cleared for ${taxYear}`, kind: "success" });
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
          Retirement Deduction
        </h1>
        <p className="text-mono-medium text-sm">
          Solo 401k, SEP-IRA, and other self-employed retirement contributions
        </p>
      </div>

      <div className="space-y-2">
        <div>
          <BackToDeductionsLink>Go Back</BackToDeductionsLink>
        </div>
        <div className="card p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-mono-dark mb-2">
            Plan Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border border-bg-tertiary rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-1 focus:ring-accent-sage/30 outline-none"
          >
            <option value="solo_401k">Solo 401(k)</option>
            <option value="sep_ira">SEP-IRA</option>
            <option value="simple_ira">SIMPLE IRA</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-mono-dark mb-2">
            Contribution Amount ($)
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
