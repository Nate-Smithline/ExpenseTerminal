"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const INPUT_CLS =
  "w-full border border-bg-tertiary rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-1 focus:ring-accent-sage/30 outline-none tabular-nums";

type Props = {
  currentYear: number;
  taxRate: number;
  ratePerMile: number;
  initialMiles?: number;
};

export function MileageCalculator({ currentYear, taxRate, ratePerMile, initialMiles }: Props) {
  const router = useRouter();
  const [miles, setMiles] = useState(initialMiles != null ? String(initialMiles) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);

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
      setToast({ message: `Mileage deduction added for ${currentYear}`, kind: "success" });
      setTimeout(() => setToast(null), 4000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setToast({ message: "Failed to save deduction", kind: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!confirm(`Remove mileage deduction for ${currentYear}? This cannot be undone.`)) return;
    setClearing(true);
    setToast(null);
    try {
      const res = await fetch("/api/deductions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "mileage", tax_year: currentYear }),
      });
      if (!res.ok) throw new Error("Failed to clear");
      setToast({ message: `Mileage deduction cleared for ${currentYear}`, kind: "success" });
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

      <div className="border-t border-bg-tertiary/40 pt-3 space-y-3">
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
        <div className="flex flex-wrap gap-3 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || deductionAmount <= 0}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {saving ? "Saving…" : saved ? "Saved" : "Save mileage deduction"}
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
