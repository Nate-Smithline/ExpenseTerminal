"use client";

import { useState, useEffect, useCallback } from "react";
import { SCHEDULE_C_LINES, type ScheduleCLine } from "@/lib/tax/schedule-c-lines";

type TaxFormCardTransaction = {
  id: string;
  vendor: string;
  amount: string | number;
  date: string;
  transaction_type: string | null;
  schedule_c_line: string | null;
  category: string | null;
  status: string;
  deduction_percent: number | null;
  is_meal: boolean | null;
  is_travel: boolean | null;
};

interface TaxFormCardProps {
  title: string;
  subtitle: string;
  lineBreakdown: Record<string, number>;
  transactions: TaxFormCardTransaction[];
  onSelectTransaction?: (id: string) => void;
  onMoveTransaction?: (id: string, targetScheduleLine: string) => void | Promise<void>;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function TaxFormCard({ title, subtitle, lineBreakdown, transactions, onSelectTransaction, onMoveTransaction }: TaxFormCardProps) {
  const [expandedLine, setExpandedLine] = useState<string | null>(null);
  const [hiddenTransactionIds, setHiddenTransactionIds] = useState<string[]>([]);
  const [visiblePerLine, setVisiblePerLine] = useState<Record<string, number>>({});
  const [undoState, setUndoState] = useState<{
    transaction: TaxFormCardTransaction;
    scheduleLine: string;
    expiresAt: number;
  } | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);

  useEffect(() => {
    if (!undoState) {
      setUndoSecondsLeft(0);
      return;
    }
    const expiresAt = undoState.expiresAt;
    function tick() {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setUndoSecondsLeft(remaining);
      if (remaining <= 0) {
        setHiddenTransactionIds((prev) =>
          prev.includes(undoState.transaction.id) ? prev : [...prev, undoState.transaction.id],
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

  const expenseTransactions = transactions.filter(
    (t) => t.transaction_type === "expense" || !t.transaction_type,
  );

  const includedTransactions = expenseTransactions.filter((t) => {
    return isIncludedTransaction(t) && !!t.schedule_c_line;
  });

  function deductibleAmount(t: TaxFormCardTransaction): number {
    const amt = Math.abs(Number(t.amount));
    const pct = (t.deduction_percent ?? 100) / 100;
    if (t.is_meal) return amt * 0.5 * pct;
    return amt * pct;
  }

  function isIncludedTransaction(t: TaxFormCardTransaction): boolean {
    const pct = t.deduction_percent ?? 100;
    if (pct <= 0) return false;
    if (t.status === "personal") return false;
    return true;
  }

  const hiddenSet = new Set(hiddenTransactionIds);
  if (undoState) hiddenSet.add(undoState.transaction.id);
  const breakdown: Record<string, number> = {};

  for (const t of includedTransactions) {
    if (hiddenSet.has(t.id)) continue;
    const amt = deductibleAmount(t);
    const line = t.schedule_c_line as string;
    breakdown[line] = (breakdown[line] ?? 0) + amt;
  }

  const linesWithAmounts = SCHEDULE_C_LINES.filter(
    (l) => (breakdown[l.line] ?? 0) > 0,
  );
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

  function getTransactionsForLine(line: ScheduleCLine) {
    return includedTransactions.filter(
      (t) =>
        t.schedule_c_line === line.line &&
        !hiddenSet.has(t.id) &&
        isIncludedTransaction(t),
    );
  }

  return (
    <div className="card p-6">
      {/* Undo bar (same style as Inbox) */}
      {undoState && (
        <div className="flex items-center justify-between rounded-lg bg-mono-dark px-4 py-2.5 text-sm text-white mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span>Transaction excluded from Schedule C.</span>
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
          <h3 className="text-lg font-semibold text-mono-dark">{title}</h3>
          <p className="text-xs text-mono-light mt-0.5">{subtitle}</p>
          <p className="text-[11px] text-mono-light mt-1 max-w-md">
            This total only includes expenses that live on Schedule C itself. Additional deductions
            from calculators (like QBI, home office, retirement, and health insurance) are included
            in the totals at the top of this page and in Other Deductions, but do not appear as
            Schedule C line items here.
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-mono-dark tabular-nums">
            {formatCurrency(total)}
          </p>
          <p className="text-xs text-mono-light">Total deductions</p>
        </div>
      </div>

      <div className="divide-y divide-bg-tertiary/30">
        {linesWithAmounts.map((line) => {
          const amount = breakdown[line.line] ?? 0;
          const isExpanded = expandedLine === line.line;
          const allLineTxs = isExpanded ? getTransactionsForLine(line) : [];
          const visibleCount = visiblePerLine[line.line] ?? 20;
          const lineTxs = isExpanded ? allLineTxs.slice(0, visibleCount) : [];
          const remainingCount = isExpanded ? Math.max(allLineTxs.length - visibleCount, 0) : 0;
          const allConfirmed = includedTransactions
            .filter((t) => t.schedule_c_line === line.line)
            .every((t) => t.status === "completed");

          return (
            <div
              key={line.line}
              onDragOver={onMoveTransaction ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } : undefined}
              onDrop={onMoveTransaction ? (e) => {
                e.preventDefault();
                const raw = e.dataTransfer.getData("application/json");
                if (!raw) return;
                const { id: txId, scheduleLine: sourceLine } = JSON.parse(raw) as { id: string; scheduleLine: string };
                if (sourceLine === line.line) return;
                void Promise.resolve(onMoveTransaction(txId, line.line));
              } : undefined}
              className={onMoveTransaction ? "rounded-lg border-2 border-transparent border-dashed hover:border-accent-sage/40 transition-colors" : undefined}
            >
              <button
                onClick={() => setExpandedLine(isExpanded ? null : line.line)}
                className="w-full flex items-center gap-3 py-3 text-left hover:bg-bg-secondary/40 transition-colors rounded-lg px-2 -mx-2"
              >
                <span className="text-xs text-mono-light w-10 tabular-nums shrink-0">
                  Line {line.line}
                </span>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    allConfirmed ? "bg-success" : "bg-warning"
                  }`}
                />
                <span className="flex-1 text-sm text-mono-dark font-medium">
                  {line.label}
                </span>
                <span className="text-sm font-medium text-mono-dark tabular-nums">
                  {formatCurrency(amount)}
                </span>
                <span className="material-symbols-rounded text-[16px] text-mono-light">
                  {isExpanded ? "expand_less" : "expand_more"}
                </span>
              </button>

              {isExpanded && lineTxs.length > 0 && (
                <div className="ml-14 mb-3 space-y-1 animate-in">
                  {lineTxs.map((tx) => {
                    const pct = tx.deduction_percent ?? 100;
                    const originalAmount = Math.abs(Number(tx.amount));
                    return (
                    <div
                      key={tx.id}
                      role={onSelectTransaction ? "button" : undefined}
                      tabIndex={onSelectTransaction ? 0 : undefined}
                      draggable={!!onMoveTransaction}
                      onDragStart={(e) => {
                        if (!onMoveTransaction) return;
                        e.dataTransfer.setData("application/json", JSON.stringify({ id: tx.id, scheduleLine: line.line }));
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
                          {formatCurrency(originalAmount)}
                        </span>
                        <span className="text-mono-light tabular-nums">
                          ({pct}% deduction)
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUndoState({
                              transaction: tx,
                              scheduleLine: line.line,
                              expiresAt: Date.now() + 5000,
                            });
                          }}
                          className="inline-flex items-center justify-center rounded-full border border-bg-tertiary/60 px-1.5 py-1 text-[10px] text-mono-light hover:bg-bg-secondary hover:text-mono-dark transition-colors"
                          aria-label="Exclude this transaction from Schedule C totals"
                        >
                          <span className="material-symbols-rounded text-[14px]">close_small</span>
                        </button>
                      </span>
                    </div>
                  );})}
                  {remainingCount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setVisiblePerLine((prev) => ({
                          ...prev,
                          [line.line]: visibleCount + 20,
                        }))
                      }
                      className="text-xs text-accent-sage px-2 py-1 hover:underline"
                    >
                      + {remainingCount} more transactions
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {linesWithAmounts.length === 0 && (
        <p className="text-sm text-mono-light text-center py-8">
          No categorized expenses yet. Complete transactions in your Inbox to see them here.
        </p>
      )}
    </div>
  );
}
