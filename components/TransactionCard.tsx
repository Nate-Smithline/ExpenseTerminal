"use client";

import { useState } from "react";
import type { Database } from "@/lib/types/database";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

interface TransactionUpdate {
  quick_label?: string;
  business_purpose?: string;
  notes?: string;
}

interface TransactionCardProps {
  transaction: Transaction;
  onSave: (data: TransactionUpdate) => Promise<void>;
  onMarkPersonal: () => Promise<void>;
}

function formatDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function TransactionIcon({ category }: { category: string | null }) {
  const cat = (category || "").toLowerCase();
  if (cat.includes("meal") || cat.includes("restaurant")) return <>🍽️</>;
  if (cat.includes("travel") || cat.includes("flight") || cat.includes("uber"))
    return <>✈️</>;
  if (cat.includes("office") || cat.includes("supply")) return <>🧾</>;
  return <>💳</>;
}

export function TransactionCard({
  transaction,
  onSave,
  onMarkPersonal,
}: TransactionCardProps) {
  const [selectedLabel, setSelectedLabel] = useState<string>(
    transaction.quick_label ?? ""
  );
  const [businessPurpose, setBusinessPurpose] = useState(
    transaction.business_purpose ?? ""
  );
  const [notes, setNotes] = useState(transaction.notes ?? "");
  const [saving, setSaving] = useState(false);

  const suggestions: string[] = Array.isArray(transaction.ai_suggestions)
    ? (transaction.ai_suggestions as string[])
    : ["Business", "Personal", "Other"];

  function handleQuickAction(label: string) {
    setSelectedLabel(label);
    if (!businessPurpose && label !== "Personal") {
      setBusinessPurpose(`${label} expense`);
    }
  }

  async function handleSaveClick() {
    if (!businessPurpose && selectedLabel !== "Personal") return;
    setSaving(true);
    await onSave({
      quick_label: selectedLabel,
      business_purpose: selectedLabel === "Personal" ? null ?? "" : businessPurpose,
      notes,
    });
    setSaving(false);
  }

  async function handleMarkPersonalClick() {
    setSaving(true);
    await onMarkPersonal();
    setSaving(false);
  }

  return (
    <div className="card p-6 mb-4">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="text-xl">
            <TransactionIcon category={transaction.category} />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-mono-dark">
              {transaction.vendor}
            </h3>
            <p className="text-sm text-mono-medium">
              {formatDate(transaction.date)} • {transaction.status}
            </p>
          </div>
        </div>
        <span className="text-xl font-bold text-mono-dark">
          ${Math.abs(Number(transaction.amount)).toFixed(2)}
        </span>
      </div>

      {/* AI Summary */}
      <div className="bg-bg-secondary p-4 rounded-md mb-4">
        <p className="text-sm font-medium text-mono-dark mb-1">
          AI suggests: {transaction.category ?? "Uncategorized"}{" "}
          {transaction.schedule_c_line
            ? `(${transaction.schedule_c_line})`
            : null}{" "}
          {transaction.ai_confidence != null &&
            `• ${(Number(transaction.ai_confidence) * 100).toFixed(0)}% confident`}
        </p>
        {transaction.ai_reasoning && (
          <p className="text-sm text-mono-medium">
            {transaction.ai_reasoning}
          </p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-mono-dark mb-2">
          Quick Actions:
        </label>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => handleQuickAction(suggestion)}
              className={`btn-pill ${
                selectedLabel === suggestion ? "selected" : ""
              }`}
            >
              {suggestion}
            </button>
          ))}
          {!suggestions.includes("Personal") && (
            <button
              type="button"
              onClick={() => handleQuickAction("Personal")}
              className={`btn-pill ${
                selectedLabel === "Personal" ? "selected" : ""
              }`}
            >
              Personal
            </button>
          )}
        </div>
      </div>

      {/* Business Purpose Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-mono-dark mb-2">
          Business Purpose (required){" "}
          <span className="text-danger">*</span>
        </label>
        <textarea
          value={businessPurpose}
          onChange={(e) => setBusinessPurpose(e.target.value)}
          placeholder="Describe how this relates to your business..."
          className="w-full border border-bg-tertiary rounded-md p-3 text-sm"
          rows={3}
          disabled={selectedLabel === "Personal"}
        />
      </div>

      {/* Optional Notes */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-mono-medium mb-2">
          Additional Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any other context..."
          className="w-full border border-bg-tertiary rounded-md p-2 bg-bg-secondary text-sm"
          rows={2}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={handleMarkPersonalClick}
          className="btn-secondary"
          disabled={saving}
        >
          Mark as Personal
        </button>
        <button
          type="button"
          onClick={handleSaveClick}
          disabled={
            saving || (!businessPurpose && selectedLabel !== "Personal")
          }
          className="btn-primary"
        >
          {saving ? "Saving..." : "Save & Continue"}
        </button>
      </div>
    </div>
  );
}

