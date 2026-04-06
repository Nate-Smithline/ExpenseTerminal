"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { QuarterlyToggle } from "./QuarterlyToggle";
import { TaxFormCard } from "./TaxFormCard";
import { CategoryBreakout } from "./CategoryBreakout";
import { TransactionDetailPanel, type PartialTransaction, type TransactionDetailUpdate } from "@/components/TransactionDetailPanel";
import { calculateScheduleSE } from "@/lib/tax/form-calculations";
import { getFilingTypeConfig } from "@/lib/tax/schedule-c-lines";
import { TaxYearSelector } from "@/components/TaxYearSelector";

interface TaxDetailsClientProps {
  defaultYear: number;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

export function TaxDetailsClient({ defaultYear }: TaxDetailsClientProps) {
  const [year, setYear] = useState(defaultYear);
  const [quarter, setQuarter] = useState<number | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<PartialTransaction | null>(null);
  const [netProfitExpanded, setNetProfitExpanded] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tax_year: String(year) });
      if (quarter) params.set("quarter", String(quarter));
      const res = await fetch(`/api/tax-details/summary?${params.toString()}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to fetch tax details:", err);
    } finally {
      setLoading(false);
    }
  }, [year, quarter]);

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
      const body = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? "Failed to update");
    }
    await fetchData();
    setSelectedTransaction((prev) => {
      if (!prev || prev.id !== id) return prev;
      const next = { ...prev, ...update };
      const amount: string =
        typeof next.amount === "number" ? String(next.amount) : (next.amount ?? "");
      return { ...next, amount };
    });
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="space-y-3">
        <div>
          <div
            role="heading"
            aria-level={1}
            className="text-[32px] leading-tight font-sans font-normal text-mono-dark"
          >
            Tax Details
          </div>
          <p className="text-base text-mono-medium mt-1 font-sans">
            {filingConfig.label} &middot; {filingConfig.forms.join(", ")}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <TaxYearSelector
            value={year}
            onChange={(y) => setYear(y)}
            label="Tax year"
            compact
          />
          <QuarterlyToggle value={quarter} onChange={setQuarter} />
        </div>
        {quarter != null && (
          <span className="block text-xs text-mono-medium">
            Showing Q{quarter} only (transactions). Additional deductions are full-year.
          </span>
        )}
      </div>

      {/* No pending-expense banner on this page */}

      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-3 bg-bg-tertiary/40 rounded w-20 mb-3" />
              <div className="h-6 bg-bg-tertiary/40 rounded w-28" />
            </div>
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="card p-5 min-w-0">
            <p className="text-xs text-mono-light mb-1">Total Deductions</p>
            <p className="text-lg sm:text-xl font-semibold text-accent-sage tabular-nums break-words">
              {formatCurrency(data.totalExpenses)}
            </p>
            <p className="text-xs text-mono-light mt-1">
              Transaction expenses plus additional deductions (home office, mileage, etc.).
            </p>
          </div>
          <div className="card p-5 min-w-0">
            <p className="text-xs text-mono-light mb-1">Net Profit</p>
            <p className="text-lg sm:text-xl font-semibold text-mono-dark tabular-nums break-words">
              {formatCurrency(data.netProfit)}
            </p>
          </div>
          <div className="card p-5 min-w-0">
            <p className="text-xs text-mono-light mb-1">
              {quarter ? `Q${quarter} Est. Payment` : "Quarterly Est. Payment"}
            </p>
            <p className="text-lg sm:text-xl font-semibold text-accent-warm tabular-nums break-words">
              {formatCurrency(data.estimatedQuarterlyPayment)}
            </p>
            <p className="text-xs text-mono-light mt-1">
              Effective rate: {formatPercent(data.effectiveTaxRate)}
            </p>
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-mono-light">Could not load tax data.</p>
        </div>
      )}
    </div>
  );
}
