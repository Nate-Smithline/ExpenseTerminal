"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CurrencyInput } from "@/components/CurrencyInput";

const INPUT_CLS =
  "w-full border border-bg-tertiary rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-1 focus:ring-accent-sage/30 outline-none tabular-nums";

type Props = {
  totalIncome: number;
  currentYear: number;
  taxRate: number;
};

export function QBICalculator({ totalIncome, currentYear, taxRate }: Props) {
  const router = useRouter();
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [incomeSaving, setIncomeSaving] = useState(false);
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const [incomeSuccess, setIncomeSuccess] = useState<string | null>(null);
  const [deductionSaving, setDeductionSaving] = useState(false);
  const [deductionSaved, setDeductionSaved] = useState(false);
  const [deductionError, setDeductionError] = useState<string | null>(null);
  const [deductionClearing, setDeductionClearing] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);

  const qbiAmount = totalIncome > 0 ? totalIncome * 0.2 : 0;
  const taxSavings = qbiAmount * taxRate;

  async function handleAddIncome(e: React.FormEvent) {
    e.preventDefault();
    setIncomeSaving(true);
    setIncomeError(null);
    setIncomeSuccess(null);
    if (!amount || amount <= 0) {
      setIncomeError("Please enter a valid amount greater than 0");
      setIncomeSaving(false);
      return;
    }
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          vendor: vendor.trim(),
          amount,
          description: description.trim() || undefined,
          transaction_type: "income",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }
      setIncomeSuccess(`$${amount.toFixed(2)} income added. Updating total…`);
      setVendor("");
      setAmount(0);
      setDescription("");
      setShowAddIncome(false);
      router.refresh();
      setTimeout(() => setIncomeSuccess(null), 4000);
    } catch (err) {
      setIncomeError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIncomeSaving(false);
    }
  }

  async function handleSaveDeduction() {
    if (qbiAmount <= 0) return;
    setDeductionSaving(true);
    setDeductionError(null);
    try {
      const res = await fetch("/api/deductions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "qbi",
          tax_year: currentYear,
          amount: Math.round(qbiAmount * 100) / 100,
          tax_savings: Math.round(taxSavings * 100) / 100,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to save deduction");
      }
      setDeductionSaved(true);
      setTimeout(() => setDeductionSaved(false), 3000);
      setToast({ message: `QBI deduction added for ${currentYear}`, kind: "success" });
      setTimeout(() => setToast(null), 4000);
      router.refresh();
    } catch (err) {
      setDeductionError(err instanceof Error ? err.message : "Something went wrong");
      setToast({ message: "Failed to save deduction", kind: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setDeductionSaving(false);
    }
  }

  async function handleClearDeduction() {
    if (!confirm(`Remove QBI deduction for ${currentYear}? This cannot be undone.`)) return;
    setDeductionClearing(true);
    setToast(null);
    try {
      const res = await fetch("/api/deductions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "qbi", tax_year: currentYear }),
      });
      if (!res.ok) throw new Error("Failed to clear");
      setToast({ message: `QBI deduction cleared for ${currentYear}`, kind: "success" });
      setTimeout(() => setToast(null), 4000);
      router.refresh();
    } catch {
      setToast({ message: "Failed to clear deduction", kind: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setDeductionClearing(false);
    }
  }

  return (
    <div className="card p-6 space-y-6">
      {/* Income from database */}
      <div>
        <p className="text-sm font-medium text-mono-dark mb-1">
          Total income ({currentYear}, from your records)
        </p>
        <p className="text-2xl font-bold text-mono-dark tabular-nums">
          ${totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        {totalIncome === 0 ? (
          <p className="text-sm text-mono-medium mt-1">
            No income logged yet. Add income below to calculate your QBI deduction.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddIncome((v) => !v)}
            className="text-sm text-accent-sage hover:underline mt-2"
          >
            {showAddIncome ? "Cancel" : "Add or update income"}
          </button>
        )}
      </div>

      {/* Add income form */}
      {(showAddIncome || totalIncome === 0) && (
        <form onSubmit={handleAddIncome} className="space-y-4 border-t border-bg-tertiary/40 pt-3">
          <p className="text-sm font-medium text-mono-dark">Log income (saves to your income records)</p>
          <div>
            <label className="block text-xs font-medium text-mono-medium mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-mono-medium mb-1">Source (e.g. client, payment)</label>
            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="e.g. Acme Corp"
              className={INPUT_CLS}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-mono-medium mb-1">Amount ($)</label>
            <CurrencyInput value={amount} onChange={setAmount} min={0} placeholder="0.00" className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-xs font-medium text-mono-medium mb-1">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Project payment Q1"
              className={INPUT_CLS}
            />
          </div>
          {incomeError && <p className="text-sm text-danger">{incomeError}</p>}
          {incomeSuccess && <p className="text-sm text-accent-sage font-medium">{incomeSuccess}</p>}
          <button
            type="submit"
            disabled={incomeSaving || !vendor.trim() || amount <= 0}
            className="btn-primary text-sm"
          >
            {incomeSaving ? "Saving…" : "Add income"}
          </button>
        </form>
      )}

      {/* QBI result */}
      <div className="border-t border-bg-tertiary/40 pt-3 space-y-3">
        <p className="text-sm font-medium text-mono-dark">QBI deduction (20% of qualified business income)</p>
        <p className="text-2xl font-bold text-accent-sage tabular-nums">
          ${qbiAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        {qbiAmount > 0 && (
          <p className="text-sm text-mono-medium">
            Est. tax savings at {(taxRate * 100).toFixed(0)}%: $
            {taxSavings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        )}
        {deductionError && (
          <p className="text-sm text-danger">{deductionError}</p>
        )}
        <div className="flex flex-wrap gap-3 pt-1">
          <button
            type="button"
            onClick={handleSaveDeduction}
            disabled={deductionSaving || qbiAmount <= 0}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {deductionSaving ? "Saving…" : deductionSaved ? "Saved" : "Save QBI deduction"}
          </button>
          <button
            type="button"
            onClick={handleClearDeduction}
            disabled={deductionClearing}
            className="rounded-full border border-bg-tertiary/60 px-4 py-2 text-sm font-medium text-mono-medium hover:bg-bg-tertiary/40 transition disabled:opacity-50"
          >
            {deductionClearing ? "Clearing…" : "Clear deduction"}
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
