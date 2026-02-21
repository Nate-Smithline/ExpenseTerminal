"use client";

import { useState, useEffect, useCallback } from "react";
import { QuarterlyToggle } from "./QuarterlyToggle";
import { TaxFormCard } from "./TaxFormCard";
import { CategoryBreakout } from "./CategoryBreakout";
import { PdfExportModal } from "./PdfExportModal";
import { IrsResources } from "./IrsResources";
import { calculateScheduleSE } from "@/lib/tax/form-calculations";
import { getFilingTypeConfig } from "@/lib/tax/schedule-c-lines";
import { persistTaxYear } from "@/lib/tax-year-cookie";

function DisclaimerDisclosure() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border border-bg-tertiary/60 bg-bg-secondary/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-bg-tertiary/20 transition-colors"
      >
        <span className="text-xs font-medium text-mono-medium uppercase tracking-wide">
          For your awareness
        </span>
        <span className="material-symbols-rounded text-[18px] text-mono-light shrink-0 transition-transform">
          {expanded ? "expand_less" : "expand_more"}
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-0">
          <p className="text-xs text-mono-medium leading-relaxed max-w-2xl">
            The numbers and estimates on this page are for awareness and planning only—they are not tax, legal or accounting advice. For decisions about your return, please consult your own tax or accounting professional. ExpenseTerminal does not assume liability for reliance on this information.
          </p>
        </div>
      )}
    </div>
  );
}

interface TaxDetailsClientProps {
  defaultYear: number;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function TaxDetailsClient({ defaultYear }: TaxDetailsClientProps) {
  const [year, setYear] = useState(defaultYear);
  const [quarter, setQuarter] = useState<number | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

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

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-mono-dark mb-2">Tax Details</h1>
          <p className="text-mono-medium text-sm">
            {filingConfig.label} &middot; {filingConfig.forms.join(", ")}
          </p>
        </div>
        <button
          onClick={() => setPdfModalOpen(true)}
          className="btn-primary"
        >
          Generate PDF
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-mono-dark">Tax Year:</label>
          <select
            value={year}
            onChange={(e) => {
              const y = parseInt(e.target.value, 10);
              persistTaxYear(y);
              setYear(y);
            }}
            className="border border-bg-tertiary/60 rounded-full px-4 py-1.5 text-sm bg-white text-mono-dark"
          >
            <option value={defaultYear}>{defaultYear}</option>
            <option value={defaultYear - 1}>{defaultYear - 1}</option>
            <option value={defaultYear - 2}>{defaultYear - 2}</option>
          </select>
        </div>
        <QuarterlyToggle value={quarter} onChange={setQuarter} />
      </div>

      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-3 bg-bg-tertiary/40 rounded w-20 mb-3" />
              <div className="h-6 bg-bg-tertiary/40 rounded w-28" />
            </div>
          ))}
        </div>
      ) : data ? (
        <>
          {/* Key metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-5">
              <p className="text-xs text-mono-light mb-1">Gross Income</p>
              <p className="text-xl font-semibold text-mono-dark tabular-nums">
                {formatCurrency(data.grossIncome)}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-xs text-mono-light mb-1">Total Deductions</p>
              <p className="text-xl font-semibold text-accent-sage tabular-nums">
                {formatCurrency(data.totalExpenses)}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-xs text-mono-light mb-1">Net Profit</p>
              <p className="text-xl font-semibold text-mono-dark tabular-nums">
                {formatCurrency(data.netProfit)}
              </p>
            </div>
            <div className="card p-5">
              <p className="text-xs text-mono-light mb-1">
                {quarter ? `Q${quarter} Est. Payment` : "Quarterly Est. Payment"}
              </p>
              <p className="text-xl font-semibold text-accent-warm tabular-nums">
                {formatCurrency(data.estimatedQuarterlyPayment)}
              </p>
              <p className="text-xs text-mono-light mt-1">
                Effective rate: {formatPercent(data.effectiveTaxRate)}
              </p>
            </div>
          </div>

          {/* "How much should I file" summary */}
          <div className="card p-6 border-l-4 border-l-accent-sage">
            <h2 className="text-lg font-semibold text-mono-dark mb-3">
              How Much Should I File
            </h2>
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
                <div className="flex justify-between border-t border-bg-tertiary/30 pt-2">
                  <span className="text-mono-dark font-medium">Net profit (Line 31)</span>
                  <span className="font-semibold text-mono-dark tabular-nums">
                    {formatCurrency(data.netProfit)}
                  </span>
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
                    <span className="text-mono-medium">Deductible SE tax (½)</span>
                    <span className="font-medium text-accent-sage tabular-nums">
                      {formatCurrency(se.deductibleHalf)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-bg-tertiary/30 pt-2">
                    <span className="text-mono-dark font-medium">Total annual tax estimate</span>
                    <span className="font-semibold text-accent-warm tabular-nums">
                      {formatCurrency(data.estimatedQuarterlyPayment * 4)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Schedule C form card */}
          {isScheduleCFiler && (
            <TaxFormCard
              title="Schedule C — Profit or Loss"
              subtitle="Form 1040, Line-by-line expense deductions"
              lineBreakdown={data.lineBreakdown ?? {}}
              transactions={data.transactions ?? []}
            />
          )}

          {/* Schedule SE summary */}
          {isScheduleCFiler && se && data.netProfit > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-mono-dark mb-4">
                Schedule SE — Self-Employment Tax
              </h3>
              <div className="space-y-2 text-sm max-w-md">
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
                <div className="flex justify-between border-t border-bg-tertiary/30 pt-2">
                  <span className="text-mono-dark font-medium">Total SE tax</span>
                  <span className="font-semibold text-mono-dark tabular-nums">
                    {formatCurrency(se.totalSETax)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Category breakout */}
          <CategoryBreakout
            categoryBreakdown={data.categoryBreakdown}
            transactions={data.transactions ?? []}
          />

          {/* Disclaimer — for awareness */}
          <DisclaimerDisclosure />

          {/* IRS Resources */}
          <IrsResources />
        </>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-mono-light">Could not load tax data.</p>
        </div>
      )}

      {/* PDF Export Modal */}
      <PdfExportModal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        taxYear={year}
        quarter={quarter}
        filingType={data?.filingType}
      />
    </div>
  );
}
