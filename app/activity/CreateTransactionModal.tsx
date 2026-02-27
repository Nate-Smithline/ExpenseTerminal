"use client";

import { useState } from "react";

interface CreateTransactionModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the created transaction when save succeeds; can open sidebar etc. */
  onSuccess: (created: { id: string; [key: string]: unknown }) => void;
  defaultDate?: string;
}

export function CreateTransactionModal({
  open,
  onClose,
  onSuccess,
  defaultDate = new Date().toISOString().slice(0, 10),
}: CreateTransactionModalProps) {
  const [date, setDate] = useState(defaultDate);
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [transactionType, setTransactionType] = useState<"expense" | "income">("expense");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const num = parseFloat(amount);
    if (Number.isNaN(num)) {
      setError("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          vendor: vendor.trim(),
          amount: num,
          description: description.trim() || undefined,
          transaction_type: transactionType,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((body as { error?: string }).error ?? "Failed to create transaction");
        return;
      }
      setDate(new Date().toISOString().slice(0, 10));
      setVendor("");
      setAmount("");
      setDescription("");
      setTransactionType("expense");
      onSuccess(body as { id: string; [key: string]: unknown });
      // Parent closes modal and opens sidebar; do not call onClose() here
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-mono-dark/30"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="relative bg-white rounded-xl shadow-lg border border-bg-tertiary/60 w-full max-w-md max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-transaction-title"
      >
        <div className="sticky top-0 bg-white border-b border-bg-tertiary/60 px-5 py-4 flex items-center justify-between">
          <h2 id="create-transaction-title" className="text-lg font-semibold text-mono-dark">
            New transaction
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-mono-medium hover:bg-bg-secondary transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-rounded text-xl">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <p className="text-sm text-red-600 font-medium" role="alert">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="create-tx-date" className="block text-sm font-medium text-mono-dark mb-1">
              Date
            </label>
            <input
              id="create-tx-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-bg-tertiary/60 rounded-lg px-3 py-2 text-mono-dark bg-white"
              required
            />
          </div>
          <div>
            <label htmlFor="create-tx-vendor" className="block text-sm font-medium text-mono-dark mb-1">
              Vendor
            </label>
            <input
              id="create-tx-vendor"
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Vendor name"
              className="w-full border border-bg-tertiary/60 rounded-lg px-3 py-2 text-mono-dark bg-white"
              required
            />
          </div>
          <div>
            <label htmlFor="create-tx-amount" className="block text-sm font-medium text-mono-dark mb-1">
              Amount
            </label>
            <input
              id="create-tx-amount"
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full border border-bg-tertiary/60 rounded-lg px-3 py-2 text-mono-dark bg-white"
              required
            />
          </div>
          <div>
            <label htmlFor="create-tx-type" className="block text-sm font-medium text-mono-dark mb-1">
              Type
            </label>
            <select
              id="create-tx-type"
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value as "expense" | "income")}
              className="w-full border border-bg-tertiary/60 rounded-lg px-3 py-2 text-mono-dark bg-white"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div>
            <label htmlFor="create-tx-description" className="block text-sm font-medium text-mono-dark mb-1">
              Description (optional)
            </label>
            <textarea
              id="create-tx-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes"
              rows={2}
              className="w-full border border-bg-tertiary/60 rounded-lg px-3 py-2 text-mono-dark bg-white resize-none"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 rounded-lg border border-bg-tertiary/60 text-mono-dark bg-white hover:bg-bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 px-4 rounded-lg bg-mono-dark text-white font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {saving ? "Saving…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
