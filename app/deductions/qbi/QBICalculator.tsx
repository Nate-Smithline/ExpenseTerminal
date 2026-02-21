"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [incomeSaving, setIncomeSaving] = useState(false);
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const [incomeSuccess, setIncomeSuccess] = useState<string | null>(null);
  const [deductionSaving, setDeductionSaving] = useState(false);
  const [deductionSaved, setDeductionSaved] = useState(false);
  const [deductionError, setDeductionError] = useState<string | null>(null);

  const qbiAmount = totalIncome > 0 ? totalIncome * 0.2 : 0;
  const taxSavings = qbiAmount * taxRate;

  async function handleAddIncome(e: React.FormEvent) {
    e.preventDefault();
    setIncomeSaving(true);
    setIncomeError(null);
    setIncomeSuccess(null);
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
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
          amount: parsedAmount,
          description: description.trim() || undefined,
          transaction_type: "income",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }
      setIncomeSuccess(`$${parsedAmount.toFixed(2)} income added. Updating total…`);
      setVendor("");
      setAmount("");
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
      router.refresh();
    } catch (err) {
      setDeductionError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeductionSaving(false);
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
        <form onSubmit={handleAddIncome} className="space-y-4 border-t border-bg-tertiary/40 pt-5">
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
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={INPUT_CLS}
              required
            />
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
            disabled={incomeSaving || !vendor.trim() || !amount}
            className="btn-primary text-sm"
          >
            {incomeSaving ? "Saving…" : "Add income"}
          </button>
        </form>
      )}

      {/* QBI result */}
      <div className="border-t border-bg-tertiary/40 pt-5 space-y-3">
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
        <button
          type="button"
          onClick={handleSaveDeduction}
          disabled={deductionSaving || qbiAmount <= 0}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {deductionSaving ? "Saving…" : deductionSaved ? "Saved" : "Save QBI deduction"}
        </button>
      </div>
    </div>
  );
}
