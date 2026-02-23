"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CurrencyInput } from "@/components/CurrencyInput";

export function LogIncomeForm({ currentYear }: { currentYear: number }) {
  const router = useRouter();
  const [date, setDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    if (!amount || amount <= 0) {
      setError("Please enter a valid amount greater than 0");
      setSaving(false);
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
      const saved = await res.json();
      setSuccess(`$${amount.toFixed(2)} income from ${vendor.trim()} logged`);
      setVendor("");
      setAmount(0);
      setDescription("");
      setTimeout(() => setSuccess(null), 5000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium text-mono-dark mb-1">
          Date
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border border-bg-tertiary rounded-md px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-mono-dark mb-1">
          Source (e.g. client name, payment)
        </label>
        <input
          type="text"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          placeholder="e.g. Acme Corp"
          className="w-full border border-bg-tertiary rounded-md px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-mono-dark mb-1">
          Amount ($)
        </label>
        <CurrencyInput value={amount} onChange={setAmount} min={0} placeholder="0.00" />
      </div>
      <div>
        <label className="block text-sm font-medium text-mono-medium mb-1">
          Description (optional)
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Project payment Q1"
          className="w-full border border-bg-tertiary rounded-md px-3 py-2 text-sm"
        />
      </div>
      {error && (
        <p className="text-sm text-danger">{error}</p>
      )}
      {success && (
        <p className="text-sm text-accent-sage font-medium">{success}</p>
      )}
      <button
        type="submit"
        disabled={saving || !vendor.trim() || amount <= 0}
        className="btn-primary text-sm"
      >
        {saving ? "Saving…" : "Log income"}
      </button>
    </form>
  );
}
