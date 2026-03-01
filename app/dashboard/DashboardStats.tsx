"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIncomeForm } from "./LogIncomeForm";

/** Typical small business finds ~15–25% of revenue in deductions (benchmark for comparison). */
const TYPICAL_DEDUCTION_PCT = 0.20;

type IncomeRow = { id: string; date: string; vendor: string; amount: string; status: string | null };

interface DashboardStatsProps {
  revenue: number;
  fromTransactions: number;
  additionalTotal: number;
  totalSavings: number;
  taxRate: number;
  taxYear: number;
}

export function DashboardStats({
  revenue,
  fromTransactions,
  additionalTotal,
  totalSavings,
  taxRate,
  taxYear,
}: DashboardStatsProps) {
  const router = useRouter();
  const [logIncomeOpen, setLogIncomeOpen] = useState(false);
  const [viewIncomeOpen, setViewIncomeOpen] = useState(false);
  const [incomeList, setIncomeList] = useState<IncomeRow[]>([]);
  const [incomeLoading, setIncomeLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchIncomeList = useCallback(async () => {
    setIncomeLoading(true);
    try {
      const res = await fetch(
        `/api/transactions?tax_year=${taxYear}&transaction_type=income&limit=500&sort_by=date&sort_order=desc`
      );
      const data = await res.json().catch(() => ({}));
      const list: IncomeRow[] = (data.data ?? []).filter(
        (t: { status: string | null }) => t.status === "completed" || t.status === "auto_sorted"
      );
      setIncomeList(list);
    } finally {
      setIncomeLoading(false);
    }
  }, [taxYear]);

  useEffect(() => {
    if (viewIncomeOpen) fetchIncomeList();
  }, [viewIncomeOpen, fetchIncomeList]);

  async function deleteIncome(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch("/api/transactions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      setIncomeList((prev) => prev.filter((t) => t.id !== id));
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    if (!logIncomeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLogIncomeOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [logIncomeOpen]);

  useEffect(() => {
    if (logIncomeOpen || viewIncomeOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [logIncomeOpen, viewIncomeOpen]);

  const typicalDeductionAmount = revenue * TYPICAL_DEDUCTION_PCT;
  const comparisonNote =
    revenue > 0
      ? `Typical businesses deduct ~${(TYPICAL_DEDUCTION_PCT * 100).toFixed(0)}% of revenue ($${typicalDeductionAmount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} at your revenue).`
      : "Track revenue and deductions to see how you compare to typical business deduction rates.";

  return (
    <>
      <div className="space-y-3">
        {/* Top row: Revenue, Deductions, Additional */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="card p-6">
          <p className="text-xs text-mono-light mb-1 uppercase tracking-wide">Revenue</p>
          <p className="text-2xl font-display text-mono-dark tabular-nums">
            ${revenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={() => setLogIncomeOpen(true)}
              className="text-xs text-accent-sage font-medium hover:underline"
            >
              Log more
            </button>
            <button
              type="button"
              onClick={() => setViewIncomeOpen(true)}
              className="text-xs text-accent-sage font-medium hover:underline"
            >
              View logged income
            </button>
          </div>
        </div>
        <div className="card p-6">
          <p className="text-xs text-mono-light mb-1 uppercase tracking-wide">Deductions</p>
          <p className="text-2xl font-display text-mono-dark tabular-nums">
            ${fromTransactions.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-mono-light mt-1">From transactions</p>
          <Link href="/inbox" className="text-xs text-accent-sage font-medium mt-1 inline-block hover:underline">
            Inbox
          </Link>
        </div>
        <div className="card p-6">
          <p className="text-xs text-mono-light mb-1 uppercase tracking-wide">Additional</p>
          <p className="text-2xl font-display text-mono-dark tabular-nums">
            ${additionalTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-mono-light mt-1">
            From deduction calculators like home office, QBI, and mileage
          </p>
          <Link href="/other-deductions" className="text-xs text-accent-sage font-medium mt-1 inline-block hover:underline">
            Other Deductions
          </Link>
        </div>
        </div>

        {/* Savings on its own line with cross-comparison */}
        <div className="card p-6">
        <p className="text-xs text-mono-light mb-1 uppercase tracking-wide">Est. Savings</p>
        <p className="text-2xl font-display text-accent-sage tabular-nums">
          ${totalSavings.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-mono-light mt-1">
          At {(taxRate * 100).toFixed(0)}% rate
          <Link href="/org-profile" className="text-accent-sage ml-1 hover:underline">Edit</Link>
        </p>
        <p className="text-xs text-mono-medium mt-3 pt-3 border-t border-bg-tertiary/40">
          {comparisonNote}
        </p>
      </div>
      </div>

      {/* Log Income modal */}
      {logIncomeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-auto">
          <div
            className="fixed inset-0 min-h-full min-w-full bg-mono-dark/30"
            aria-hidden
            onClick={() => setLogIncomeOpen(false)}
          />
          <div
            className="relative z-10 bg-white rounded-xl shadow-lg border border-bg-tertiary/60 w-full max-w-md max-h-[90vh] overflow-y-auto my-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="log-income-title"
          >
            <div className="sticky top-0 bg-white border-b border-bg-tertiary/60 px-5 py-4 flex items-center justify-between">
              <h2 id="log-income-title" className="text-lg font-semibold text-mono-dark">
                Log income
              </h2>
              <button
                type="button"
                onClick={() => setLogIncomeOpen(false)}
                className="p-2 rounded-lg text-mono-medium hover:bg-bg-secondary transition-colors"
                aria-label="Close"
              >
                <span className="material-symbols-rounded text-xl">close</span>
              </button>
            </div>
            <div className="p-5">
              <LogIncomeForm
                currentYear={taxYear}
                onSuccess={() => {
                  setLogIncomeOpen(false);
                  router.refresh();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* View logged income modal */}
      {viewIncomeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-auto">
          <div
            className="fixed inset-0 min-h-full min-w-full bg-mono-dark/30"
            aria-hidden
            onClick={() => setViewIncomeOpen(false)}
          />
          <div
            className="relative z-10 bg-white rounded-xl shadow-lg border border-bg-tertiary/60 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col my-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-income-title"
          >
            <div className="sticky top-0 bg-white border-b border-bg-tertiary/60 px-5 py-4 flex items-center justify-between shrink-0">
              <h2 id="view-income-title" className="text-lg font-semibold text-mono-dark">
                Logged income
              </h2>
              <button
                type="button"
                onClick={() => setViewIncomeOpen(false)}
                className="p-2 rounded-lg text-mono-medium hover:bg-bg-secondary transition-colors"
                aria-label="Close"
              >
                <span className="material-symbols-rounded text-xl">close</span>
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 min-h-0">
              {incomeLoading ? (
                <p className="text-sm text-mono-medium">Loading…</p>
              ) : incomeList.length === 0 ? (
                <p className="text-sm text-mono-medium">No logged income for this year yet.</p>
              ) : (
                <ul className="space-y-3">
                  {incomeList.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-4 py-2 border-b border-bg-tertiary/40 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-mono-dark truncate">{t.vendor || "—"}</p>
                        <p className="text-xs text-mono-light">
                          {t.date} · ${Math.abs(Number(t.amount)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteIncome(t.id)}
                        disabled={deletingId === t.id}
                        className="text-xs text-mono-light hover:text-danger transition-colors disabled:opacity-50 shrink-0"
                      >
                        {deletingId === t.id ? "Removing…" : "Remove"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
