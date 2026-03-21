"use client";

import { useCallback, useEffect, useState } from "react";
import { TaxFormCard } from "@/app/tax-details/TaxFormCard";
import { CategoryBreakout } from "@/app/tax-details/CategoryBreakout";
import {
  TransactionDetailPanel,
  type PartialTransaction,
  type TransactionDetailUpdate,
} from "@/components/TransactionDetailPanel";
import { calculateScheduleSE } from "@/lib/tax/form-calculations";
import { getFilingTypeConfig } from "@/lib/tax/schedule-c-lines";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function TaxDetailsSections({ defaultYear }: { defaultYear: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] =
    useState<PartialTransaction | null>(null);
  const [netProfitExpanded, setNetProfitExpanded] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tax_year: String(defaultYear) });
      const res = await fetch(`/api/tax-details/summary?${params.toString()}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to fetch dashboard tax detail sections:", err);
    } finally {
      setLoading(false);
    }
  }, [defaultYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filingConfig = getFilingTypeConfig(data?.filingType);
  const isScheduleCFiler =
    filingConfig.type === "sole_proprietor" || filingConfig.type === "single_llc";
  const se = data ? calculateScheduleSE(data.netProfit ?? 0) : null;
  const deductibleTxs = data?.deductibleTransactions ?? data?.transactions ?? [];

  function handleSelectTransaction(id: string) {
    const tx = deductibleTxs.find((t: PartialTransaction) => t.id === id);
    if (tx) setSelectedTransaction(tx as PartialTransaction);
  }

  async function handleSaveTransaction(id: string, update: TransactionDetailUpdate) {
    const res = await fetch("/api/transactions/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...update }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "Failed to update");
    }
    await fetchData();
    setSelectedTransaction((prev) => {
      if (!prev || prev.id !== id) return prev;
      const next = { ...prev, ...update };
      const amount: string =
        typeof next.amount === "number" ? String(next.amount) : next.amount ?? "";
      return { ...next, amount };
    });
  }

  if (loading) return null;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <section className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7]">
        <div className="px-4 py-3">
          <div
            role="heading"
            aria-level={2}
            className="text-base md:text-lg font-normal font-sans text-mono-dark"
          >
            How Much Should I File
          </div>
          <p className="text-xs text-mono-medium mt-1 font-sans">
            Planning summary aligned to Schedule C / SE calculations.
          </p>
        </div>
        <div className="px-4 py-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-mono-medium">Gross receipts (Line 1)</span>
                <span className="font-medium text-mono-dark tabular-nums">
                  {formatCurrency(data.grossIncome)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-mono-medium">Total expenses (Line 28)</span>
                <span className="font-medium text-mono-dark tabular-nums">
                  {formatCurrency(data.totalExpenses)}
                </span>
              </div>
              <div className="flex justify-between border-t border-[#F0F1F7] pt-2">
                <span className="text-mono-dark font-medium">Net profit (Line 31)</span>
                <span className="font-semibold text-mono-dark tabular-nums">
                  {formatCurrency(data.netProfit)}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-mono-light max-w-md">
                <p>
                  Total expenses here combine your card-sorted business expenses with
                  any additional deductions you&apos;ve entered.
                </p>
                {netProfitExpanded && (
                  <p className="mt-1">
                    That means this total can be higher than the Schedule C card
                    alone, which only reflects expenses that live directly on
                    Schedule C.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setNetProfitExpanded((v) => !v)}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-mono-medium hover:text-mono-dark"
                >
                  {netProfitExpanded
                    ? "Show less detail"
                    : "Show how this connects to Schedule C"}
                  <span className="material-symbols-rounded text-[14px]">
                    {netProfitExpanded ? "expand_less" : "expand_more"}
                  </span>
                </button>
              </div>
            </div>
            {isScheduleCFiler && se && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-mono-medium">Self-employment tax</span>
                  <span className="font-medium text-mono-dark tabular-nums">
                    {formatCurrency(se.totalSETax)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-mono-medium">Deductible SE tax (1/2)</span>
                  <span className="font-medium text-mono-dark tabular-nums">
                    {formatCurrency(se.deductibleHalf)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[#F0F1F7] pt-2">
                  <span className="text-mono-dark font-medium">
                    Total annual tax estimate
                  </span>
                  <span className="font-semibold text-mono-dark tabular-nums">
                    {formatCurrency(data.estimatedQuarterlyPayment * 4)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {isScheduleCFiler && (
        <TaxFormCard
          title="Schedule C — Profit or Loss"
          subtitle="Form 1040, Line-by-line expense deductions"
          lineBreakdown={data.lineBreakdown ?? {}}
          transactions={deductibleTxs}
          onSelectTransaction={handleSelectTransaction}
          variant="section"
        />
      )}

      {isScheduleCFiler && se && data.netProfit > 0 && (
        <section className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7]">
          <div className="px-4 py-3">
            <div
              role="heading"
              aria-level={3}
              className="text-base md:text-lg font-normal font-sans text-mono-dark"
            >
              Schedule SE — Self-Employment Tax
            </div>
          </div>
          <div className="px-4 py-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-mono-medium">Net earnings from self-employment</span>
              <span className="font-medium text-mono-dark tabular-nums">
                {formatCurrency(se.netEarnings)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-mono-medium">Social Security tax (12.4%)</span>
              <span className="font-medium text-mono-dark tabular-nums">
                {formatCurrency(se.socialSecurityTax)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-mono-medium">Medicare tax (2.9%)</span>
              <span className="font-medium text-mono-dark tabular-nums">
                {formatCurrency(se.medicareTax)}
              </span>
            </div>
            <div className="flex justify-between border-t border-[#F0F1F7] pt-2">
              <span className="text-mono-dark font-medium">Total SE tax</span>
              <span className="font-semibold text-mono-dark tabular-nums">
                {formatCurrency(se.totalSETax)}
              </span>
            </div>
          </div>
        </section>
      )}

      <CategoryBreakout
        categoryBreakdown={data.categoryBreakdown ?? {}}
        transactions={deductibleTxs}
        onSelectTransaction={handleSelectTransaction}
        variant="section"
      />

      {selectedTransaction && (
        <TransactionDetailPanel
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          editable
          onSave={handleSaveTransaction}
          taxRate={0.24}
        />
      )}
    </div>
  );
}

