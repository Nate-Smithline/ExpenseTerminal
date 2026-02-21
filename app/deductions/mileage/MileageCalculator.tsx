"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const INPUT_CLS =
  "w-full border border-bg-tertiary rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-1 focus:ring-accent-sage/30 outline-none tabular-nums";

type Props = {
  currentYear: number;
  taxRate: number;
  ratePerMile: number;
};

export function MileageCalculator({ currentYear, taxRate, ratePerMile }: Props) {
  const router = useRouter();
  const [miles, setMiles] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedMiles = parseFloat(miles) || 0;
  const deductionAmount = parsedMiles > 0 ? Math.round(parsedMiles * ratePerMile * 100) / 100 : 0;
  const taxSavings = Math.round(deductionAmount * taxRate * 100) / 100;

  async function handleSave() {
    if (deductionAmount <= 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/deductions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "mileage",
          tax_year: currentYear,
          amount: deductionAmount,
          tax_savings: taxSavings,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to save deduction");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-6 space-y-6">
      <div>
        <label className="block text-sm font-medium text-mono-dark mb-2">
          Business miles ({currentYear})
        </label>
        <input
          type="number"
          min="0"
          step="1"
          value={miles}
          onChange={(e) => setMiles(e.target.value)}
          placeholder="e.g. 5000"
          className={INPUT_CLS}
        />
        <p className="text-xs text-mono-light mt-1.5">
          IRS rate: ${ratePerMile.toFixed(2)}/mile
        </p>
      </div>

      <div className="border-t border-bg-tertiary/40 pt-5 space-y-3">
        <p className="text-sm font-medium text-mono-dark">Mileage deduction</p>
        <p className="text-2xl font-bold text-accent-sage tabular-nums">
          ${deductionAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        {deductionAmount > 0 && (
          <p className="text-sm text-mono-medium">
            Est. tax savings at {(taxRate * 100).toFixed(0)}%: $
            {taxSavings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || deductionAmount <= 0}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {saving ? "Saving…" : saved ? "Saved" : "Save mileage deduction"}
        </button>
      </div>
    </div>
  );
}
