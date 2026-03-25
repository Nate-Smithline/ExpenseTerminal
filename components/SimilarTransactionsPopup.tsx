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
        e.preventDefault();
        e.stopPropagation();
        onCancel();
        return;
      }
      if (key === "o") {
        e.preventDefault();
        e.stopPropagation();
        onJustThisOne();
        return;
      }
      if (key === "y" || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (!applying) onApplyToAll();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onCancel, onJustThisOne, onApplyToAll, applying]);

  return (
    <div
      className="fixed inset-0 min-h-[100dvh] z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="similar-transactions-title"
    >
      <div className="bg-white rounded-none shadow-xl max-w-md w-full p-6">
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <h2
              id="similar-transactions-title"
              className="font-display text-xl md:text-2xl text-mono-dark mb-1"
            >
              Similar Transactions Found
            </h2>
            <p className="text-[11px] text-mono-medium flex items-center gap-1">
              <span className="kbd-hint kbd-on-primary" style={{ background: "#F5F0E8", color: "#000000", borderRadius: 0, border: "none" }}>
                Esc
              </span>
              <span>to close</span>
            </p>
          </div>
        </div>

        <div>
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
            <div className="bg-bg-secondary p-4 rounded-none mb-6 space-y-1.5">
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

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onJustThisOne}
            className="px-4 py-2.5 text-sm font-medium text-mono-dark bg-[#F0F1F7] rounded-none hover:bg-[#E4E7F0] transition-colors inline-flex items-center gap-2"
            title="Shortcut: O"
          >
            Just This One
            <span className="kbd-hint !bg-white/50 !text-mono-dark !border-transparent !rounded-none text-xs">o</span>
          </button>
          <button
            type="button"
            onClick={onApplyToAll}
            disabled={applying}
            className="px-4 py-2.5 text-sm font-medium font-sans bg-black text-white rounded-none hover:bg-black/85 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
            title="Shortcut: Y or Enter"
          >
            {applying ? "Applying…" : "Apply to All"}
            <span className="kbd-hint !rounded-none !border-transparent !bg-white/20 !text-white text-xs">y</span>
          </button>
        </div>
      </div>
    </div>
  );
}
