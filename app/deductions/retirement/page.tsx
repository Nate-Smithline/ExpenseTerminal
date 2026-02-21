"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BackToDeductionsLink } from "@/components/BackToDeductionsLink";

const DEFAULT_TAX_RATE = 0.24;

export default function RetirementPage() {
  const router = useRouter();
  const [amount, setAmount] = useState(20000);
  const [type, setType] = useState("solo_401k");
  const [saving, setSaving] = useState(false);

  const taxSavings = amount * DEFAULT_TAX_RATE;

  async function handleAdd() {
    setSaving(true);
    try {
      const res = await fetch("/api/deductions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "retirement",
          tax_year: new Date().getFullYear(),
          amount,
          tax_savings: taxSavings,
          metadata: { plan_type: type },
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
          Retirement Deduction
        </h1>
        <p className="text-mono-medium text-sm">
          Solo 401k, SEP-IRA, and other self-employed retirement contributions
        </p>
      </div>

      <div className="card p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-mono-dark mb-2">
            Plan Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border border-bg-tertiary rounded-md px-3 py-2"
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
