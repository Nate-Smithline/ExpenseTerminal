"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BackToDeductionsLink } from "@/components/BackToDeductionsLink";

const DEFAULT_TAX_RATE = 0.24;

export default function HealthInsurancePage() {
  const router = useRouter();
  const [amount, setAmount] = useState(8000);
  const [saving, setSaving] = useState(false);

  const taxSavings = amount * DEFAULT_TAX_RATE;

  async function handleAdd() {
    setSaving(true);
    try {
      const res = await fetch("/api/deductions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "health_insurance",
          tax_year: new Date().getFullYear(),
          amount,
          tax_savings: taxSavings,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      router.push("/dashboard");
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h1 className="text-3xl font-bold text-mono-dark mb-2">
          Health Insurance Deduction
        </h1>
        <p className="text-mono-medium text-sm">
          Self-employed health insurance premium deduction
        </p>
      </div>

      <div className="card p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-mono-dark mb-2">
            Premiums Paid ($)
          </label>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value, 10) || 0)}
            className="w-full border border-bg-tertiary rounded-md px-3 py-2"
          />
        </div>
        <div className="bg-bg-secondary rounded-md p-4">
          <p className="text-sm font-medium text-mono-dark">
            Est. Tax Savings at {(DEFAULT_TAX_RATE * 100).toFixed(0)}%: $
            {taxSavings.toFixed(2)}
          </p>
        </div>
        <div className="flex gap-3">
          <BackToDeductionsLink>Back</BackToDeductionsLink>
          <button
            onClick={handleAdd}
            disabled={saving || amount <= 0}
            className="btn-primary"
          >
            {saving ? "Saving…" : "Add to My Deductions"}
          </button>
        </div>
      </div>
    </div>
  );
}
