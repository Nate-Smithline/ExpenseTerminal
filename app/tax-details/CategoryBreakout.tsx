"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, useCallback } from "react";
import { DEDUCTION_TYPE_CARDS } from "@/lib/deduction-types";

interface CategoryBreakoutTransaction {
  id: string;
  vendor: string;
  amount: string | number;
  date: string;
  category: string | null;
}

interface CategoryBreakoutProps {
  categoryBreakdown: Record<string, number>;
  transactions: CategoryBreakoutTransaction[];
  onSelectTransaction?: (id: string) => void;
  onMoveTransaction?: (id: string, targetCategory: string) => void | Promise<void>;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

const BAR_COLORS = [
  "bg-accent-sage",
  "bg-accent-navy",
  "bg-accent-warm",
  "bg-accent-terracotta",
  "bg-accent-sage/60",
  "bg-accent-navy/60",
  "bg-accent-warm/60",
  "bg-accent-terracotta/60",
];

const OTHER_DEDUCTIONS_KEY = "__other_deductions__";

export function CategoryBreakout({ categoryBreakdown, transactions, onSelectTransaction, onMoveTransaction }: CategoryBreakoutProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [hiddenTransactionIds, setHiddenTransactionIds] = useState<string[]>([]);
  const [visiblePerCategory, setVisiblePerCategory] = useState<Record<string, number>>({});
  const [undoState, setUndoState] = useState<{
    transaction: CategoryBreakoutTransaction;
    category: string;
    expiresAt: number;
  } | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);

  useEffect(() => {
    if (!undoState) {
      setUndoSecondsLeft(0);
      return;
    }
    const expiresAt = undoState.expiresAt;
    const transactionId = undoState.transaction.id;
    function tick() {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setUndoSecondsLeft(remaining);
      if (remaining <= 0) {
        setHiddenTransactionIds((prev) =>
          prev.includes(transactionId) ? prev : [...prev, transactionId],
        );
        setUndoState(null);
      }
    }
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [undoState]);

  const handleUndo = useCallback(() => {
    if (undoState) setUndoState(null);
  }, [undoState]);

  useEffect(() => {
    if (!undoState) return;
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "z") {
        e.preventDefault();
        handleUndo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoState, handleUndo]);

  const deductionTypeMap = useMemo(() => {
    const map = new Map<string, { label: string }>();
    for (const card of DEDUCTION_TYPE_CARDS) {
      map.set(card.typeKey, { label: card.label });
    }
    return map;
  }, []);

  const { total, maxAmount, displayCategories } = useMemo(() => {
    const entries = Object.entries(categoryBreakdown).filter(([, v]) => v > 0);
    const totalAmount = entries.reduce((a, [, v]) => a + v, 0);

    let otherTotal = 0;
    const regularEntries: Array<[string, number]> = [];

    for (const [category, amount] of entries) {
      if (deductionTypeMap.has(category)) {
        otherTotal += amount;
      } else {
        regularEntries.push([category, amount]);
      }
    }

    if (otherTotal > 0) {
      regularEntries.push([OTHER_DEDUCTIONS_KEY, otherTotal]);
    }

    const sorted = regularEntries.sort(([, a], [, b]) => b - a);
    const max = sorted[0]?.[1] ?? 1;

    return {
      total: totalAmount,
      maxAmount: max,
      displayCategories: sorted,
    };
  }, [categoryBreakdown, deductionTypeMap]);

  if (displayCategories.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-mono-dark mb-2">Category Breakout</h3>
        <p className="text-sm text-mono-light text-center py-8">
          No expense categories to display yet.
        </p>
      </div>
    );
  }

  const hiddenSet = new Set(hiddenTransactionIds);
  if (undoState) hiddenSet.add(undoState.transaction.id);

  function renderExpandedContent(category: string, hasTransactions: boolean) {
    if (category === OTHER_DEDUCTIONS_KEY) {
      // Deterministic order: known types from DEDUCTION_TYPE_CARDS first, then any other keys from categoryBreakdown
      const knownRows = Array.from(deductionTypeMap.entries())
        .map(([typeKey, meta]) => {
          const amount = categoryBreakdown[typeKey] ?? 0;
          return amount > 0 ? { typeKey, label: meta.label, amount } : null;
        })
        .filter((x): x is { typeKey: string; label: string; amount: number } => !!x);

      const knownKeys = new Set(deductionTypeMap.keys());
      const unknownRows = Object.entries(categoryBreakdown)
        .filter(([typeKey, amount]) => amount > 0 && !knownKeys.has(typeKey))
        .map(([typeKey, amount]) => ({
          typeKey,
          label: typeKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          amount,
        }));

      const rows = [...knownRows, ...unknownRows];

      if (rows.length === 0) {
        return (
          <p className="text-xs text-mono-light px-2">
            No calculator-based deductions yet. Add QBI, home office, mileage, and more from the
            Other Deductions page.
          </p>
        );
      }

      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 pb-1">
            <p className="text-xs text-mono-medium">
              These amounts come from your deduction calculators (for example home office, QBI,
              mileage, and others) rather than individual card-sorted transactions.
            </p>
            <Link
              href="/other-deductions"
              className="inline-flex items-center gap-1 text-xs font-medium text-accent-sage hover:underline shrink-0"
            >
              Open calculators
              <span className="material-symbols-rounded text-[14px] align-middle">
                open_in_new
              </span>
            </Link>
          </div>
          <div className="space-y-1">
            {rows.map((row) => (
              <div
                key={row.typeKey}
                className="flex items-center justify-between gap-2 py-1 px-2 text-xs rounded hover:bg-bg-secondary/60 transition-colors"
              >
                <span className="text-mono-medium truncate flex-1 mr-3">
                  {row.label}
                </span>
                <span className="text-mono-dark font-medium tabular-nums">
                  {formatCurrency(row.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (!hasTransactions) {
      return (
        <p className="text-xs text-mono-light px-2">
          This amount comes from your additional deduction entries (for example mileage, QBI, or
          other calculators) rather than individual card-sorted transactions.
        </p>
      );
    }

    return null;
  }

  return (
    <div className="card p-6">
      {/* Undo bar (same style as Inbox) */}
      {undoState && (
        <div className="flex items-center justify-between rounded-lg bg-mono-dark px-4 py-2.5 text-sm text-white mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span>Transaction removed from list.</span>
            {undoSecondsLeft > 0 && (
              <span className="text-white/70">
                Undo available for {undoSecondsLeft}s.
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleUndo}
            className="inline-flex items-center gap-1 rounded-full border border-white/40 px-3 py-1.5 text-xs font-semibold hover:bg-white/10 transition"
          >
            Undo
            <kbd className="kbd-hint kbd-on-primary ml-1">z</kbd>
          </button>
        </div>
      )}

      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-lg font-semibold text-mono-dark">Category Breakout</h3>
          <p className="text-xs text-mono-light mt-0.5">Expense distribution by category</p>
          <p className="text-[11px] text-mono-light mt-1 max-w-md">
            This total includes both card-sorted business expenses and any additional amounts you
            have added via deduction calculators (like QBI, home office, mileage, and more).
          </p>
        </div>
        <p className="text-sm font-medium text-mono-dark tabular-nums">
          {formatCurrency(total)} total
        </p>
      </div>

      <div className="space-y-2">
        {displayCategories.map(([category, amount], i) => {
          const pct = total > 0 ? (amount / total) * 100 : 0;
          const barWidth = (amount / maxAmount) * 100;
          const isExpanded = expandedCategory === category;

          const baseTxs =
            category === OTHER_DEDUCTIONS_KEY
              ? []
              : transactions.filter((t) => (t.category || "Uncategorized") === category);
          const allCatTxs = baseTxs.filter((t) => !hiddenSet.has(t.id));
          const visibleCount = visiblePerCategory[category] ?? 20;
          const catTxs = isExpanded ? allCatTxs.slice(0, visibleCount) : [];
          const remainingCount = isExpanded
            ? Math.max(allCatTxs.length - visibleCount, 0)
            : 0;

          const label =
            category === OTHER_DEDUCTIONS_KEY
              ? "Other Deductions"
              : category;

          const canDrop = category !== OTHER_DEDUCTIONS_KEY && !!onMoveTransaction;

          return (
            <div
              key={category}
              onDragOver={canDrop ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } : undefined}
              onDrop={canDrop ? (e) => {
                e.preventDefault();
                const raw = e.dataTransfer.getData("application/json");
                if (!raw) return;
                const { id: txId, category: sourceCategory } = JSON.parse(raw) as { id: string; category: string };
                if (sourceCategory === category) return;
                void Promise.resolve(onMoveTransaction!(txId, category));
              } : undefined}
              className={canDrop ? "rounded-lg border-2 border-transparent border-dashed hover:border-accent-sage/40 transition-colors" : undefined}
            >
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : category)}
                className="w-full group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-mono-dark font-medium truncate flex-1 text-left">
                    {label}
                  </span>
                  <span className="text-xs text-mono-light ml-2 tabular-nums">
                    {pct.toFixed(1)}%
                  </span>
                  <span className="text-sm font-medium text-mono-dark ml-3 tabular-nums">
                    {formatCurrency(amount)}
                  </span>
                </div>
                <div className="w-full h-2 bg-bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      BAR_COLORS[i % BAR_COLORS.length]
                    }`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </button>

              {isExpanded && (
                <div className="ml-4 mt-2 mb-3 space-y-1 animate-in">
                  {catTxs.length > 0 && (
                    <>
                      {catTxs.slice(0, 15).map((tx) => (
                        <div
                          key={tx.id}
                          role={onSelectTransaction ? "button" : undefined}
                          tabIndex={onSelectTransaction ? 0 : undefined}
                          draggable={!!onMoveTransaction}
                          onDragStart={(e) => {
                            if (!onMoveTransaction) return;
                            e.dataTransfer.setData("application/json", JSON.stringify({ id: tx.id, category }));
                            e.dataTransfer.effectAllowed = "move";
                            e.stopPropagation();
                          }}
                          onClick={() => onSelectTransaction?.(tx.id)}
                          onKeyDown={(e) => {
                            if (onSelectTransaction && (e.key === "Enter" || e.key === " ")) {
                              e.preventDefault();
                              onSelectTransaction(tx.id);
                            }
                          }}
                          className={`flex items-center justify-between gap-2 py-1.5 px-2 text-xs rounded hover:bg-bg-secondary/60 transition-colors ${onSelectTransaction ? "cursor-pointer" : ""}`}
                        >
                          <span className="text-mono-medium truncate flex-1 mr-3">
                            {tx.vendor}
                          </span>
                          <span className="text-mono-light shrink-0 mr-3">
                            {new Date(tx.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            <span className="text-mono-dark font-medium tabular-nums">
                              {formatCurrency(Math.abs(Number(tx.amount)))}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUndoState({
                                  transaction: tx,
                                  category,
                                  expiresAt: Date.now() + 5000,
                                });
                              }}
                              className="inline-flex items-center justify-center rounded-full border border-bg-tertiary/60 px-1.5 py-1 text-[10px] text-mono-light hover:bg-bg-secondary hover:text-mono-dark transition-colors"
                              aria-label="Hide this transaction from the category list"
                            >
                              <span className="material-symbols-rounded text-[14px]">
                                close_small
                              </span>
                            </button>
                          </span>
                        </div>
                      ))}
                      {remainingCount > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setVisiblePerCategory((prev) => ({
                              ...prev,
                              [category]: visibleCount + 20,
                            }))
                          }
                          className="text-xs text-accent-sage px-2 py-1 hover:underline"
                        >
                          + {remainingCount} more transactions
                        </button>
                      )}
                    </>
                  )}

                  {renderExpandedContent(category, catTxs.length > 0)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

