"use client";

import { useEffect } from "react";
import type { Database } from "@/lib/types/database";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

function formatDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDollar(amount: number) {
  return "$" + Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface SimilarTransactionsPopupProps {
  vendor: string;
  transactions: Transaction[];
  quickLabel: string;
  businessPurpose: string;
  deductionPercent?: number | null;
  onCancel: () => void;
  onJustThisOne: () => void;
  onApplyToAll: () => void;
  applying?: boolean;
}

export function SimilarTransactionsPopup({
  vendor,
  transactions,
  quickLabel,
  businessPurpose,
  deductionPercent,
  onCancel,
  onJustThisOne,
  onApplyToAll,
  applying = false,
}: SimilarTransactionsPopupProps) {
  const isPersonal = quickLabel.trim().toLowerCase() === "personal";

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      if (key === "o") {
        onJustThisOne();
        return;
      }
      if (key === "y" || e.key === "Enter") {
        e.preventDefault();
        if (!applying) onApplyToAll();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel, onJustThisOne, onApplyToAll, applying]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="similar-transactions-title"
    >
      <div className="rounded-xl bg-white shadow-[0_8px_30px_-6px_rgba(0,0,0,0.14)] max-w-md w-full mx-4 overflow-hidden">
        <div className="rounded-t-xl bg-[#2d3748] px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="similar-transactions-title" className="text-xl font-bold text-white tracking-tight">
                Similar Transactions Found
              </h2>
              <p className="text-sm text-white/80 mt-1.5">
                We found {transactions.length} more transaction
                {transactions.length === 1 ? "" : "s"} from this vendor.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md border border-white/40 bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20 transition"
                aria-label="Cancel (Esc)"
              >
                Cancel <span className="text-white/60 text-xs ml-1">Esc</span>
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="h-8 w-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition"
                aria-label="Close"
              >
                <span className="material-symbols-rounded text-[18px]">close</span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          <p className="text-mono-medium mb-3">
            From {vendor}:
          </p>

          <ul className="space-y-2 mb-6 max-h-48 overflow-y-auto">
            {transactions.map((t) => (
              <li
                key={t.id}
                className="flex justify-between text-sm border-b border-bg-tertiary/50 pb-2 last:border-0"
              >
                <span>{formatDate(t.date)}</span>
                <span className="font-medium">
                  {formatDollar(Number(t.amount))}
                </span>
              </li>
            ))}
          </ul>

          {!isPersonal && (
            <div className="bg-bg-secondary p-4 rounded-md mb-6 space-y-1.5">
              <p className="text-sm">
                <strong className="text-mono-dark">Category:</strong>{" "}
                <span className="text-mono-medium">{quickLabel}</span>
              </p>
              <p className="text-sm">
                <strong className="text-mono-dark">Purpose:</strong>{" "}
                <span className="text-mono-medium">
                  {businessPurpose || "—"}
                </span>
              </p>
              {typeof deductionPercent === "number" && (
                <p className="text-sm">
                  <strong className="text-mono-dark">Deduction:</strong>{" "}
                  <span className="text-mono-medium">{deductionPercent}% business</span>
                </p>
              )}
            </div>
          )}

          <p className="text-sm text-mono-medium mb-4">
            Apply this categorization to all of these transactions?
          </p>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-bg-tertiary/40">
          <button
            type="button"
            onClick={onJustThisOne}
            className="rounded-md border border-bg-tertiary bg-white px-4 py-2.5 text-sm font-semibold text-mono-dark hover:bg-bg-secondary transition inline-flex items-center gap-2"
            title="Shortcut: O"
          >
            Just This One
            <span className="kbd-hint text-xs">o</span>
          </button>
          <button
            type="button"
            onClick={onApplyToAll}
            disabled={applying}
            className="rounded-md bg-mono-dark px-4 py-2.5 text-sm font-semibold text-white hover:bg-mono-dark/90 transition disabled:opacity-40 inline-flex items-center gap-2"
            title="Shortcut: Y or Enter"
          >
            {applying ? "Applying…" : "Apply to All"}
            <span className="kbd-hint kbd-on-primary text-xs">y</span>
          </button>
        </div>
      </div>
    </div>
  );
}
