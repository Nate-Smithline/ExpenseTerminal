"use client";

import { useState, useEffect } from "react";
import { estimateCombinedTax, formatTaxDollars } from "@/lib/tax/combined-tax";

interface TaxIntelligenceWidgetProps {
  taxYear: number;
  sideHustleRevenue: number;
  sideHustleDeductions: number;
  marginalTaxRate: number;
  initialW2GrossIncome: number | null;
  initialW2WithholdingYtd: number | null;
}

export function TaxIntelligenceWidget({
  taxYear,
  sideHustleRevenue,
  sideHustleDeductions,
  marginalTaxRate,
  initialW2GrossIncome,
  initialW2WithholdingYtd,
}: TaxIntelligenceWidgetProps) {
  const [w2Income, setW2Income] = useState<number | null>(initialW2GrossIncome);
  const [w2Withholding, setW2Withholding] = useState<number | null>(initialW2WithholdingYtd);
  const [modalOpen, setModalOpen] = useState(false);
  const [draftIncome, setDraftIncome] = useState(initialW2GrossIncome != null ? String(initialW2GrossIncome) : "");
  const [draftWithholding, setDraftWithholding] = useState(initialW2WithholdingYtd != null ? String(initialW2WithholdingYtd) : "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Keep draft in sync with modal open state
  useEffect(() => {
    if (modalOpen) {
      setDraftIncome(w2Income != null ? String(w2Income) : "");
      setDraftWithholding(w2Withholding != null ? String(w2Withholding) : "");
      setSaveError(null);
    }
  }, [modalOpen, w2Income, w2Withholding]);

  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setModalOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  const estimate = estimateCombinedTax({
    sideHustleRevenue,
    sideHustleDeductions,
    w2GrossIncome: w2Income,
    w2WithholdingYtd: w2Withholding,
    marginalTaxRate,
  });

  async function handleSave() {
    setSaveError(null);
    const income = draftIncome.trim() === "" ? null : Number(draftIncome.replace(/,/g, ""));
    const withholding = draftWithholding.trim() === "" ? null : Number(draftWithholding.replace(/,/g, ""));

    if (income !== null && (isNaN(income) || income < 0)) {
      setSaveError("Enter a valid W-2 income amount.");
      return;
    }
    if (withholding !== null && (isNaN(withholding) || withholding < 0)) {
      setSaveError("Enter a valid withholding amount.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/tax-year-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tax_year: taxYear,
          w2_gross_income: income,
          w2_withholding_ytd: withholding,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSaveError(d?.error ?? "Failed to save. Try again.");
        return;
      }
      setW2Income(income);
      setW2Withholding(withholding);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const hasRevenue = sideHustleRevenue > 0;

  return (
    <>
      <section className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7]">
        {/* Header */}
        <div className="px-4 py-3 flex items-start justify-between gap-4">
          <div>
            <div
              role="heading"
              aria-level={2}
              className="text-base md:text-lg font-normal font-sans text-mono-dark"
            >
              What do I owe?
            </div>
            <p className="mt-1 text-xs text-mono-medium font-sans">
              Combined tax estimate for {taxYear} — side hustle
              {estimate.hasW2Data ? " + W-2" : ""}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-none bg-[#E8EEF5] px-4 py-2 text-sm font-medium font-sans text-mono-dark hover:opacity-80 shrink-0"
          >
            {estimate.hasW2Data ? "Edit W-2" : "Add W-2"}
          </button>
        </div>

        {!hasRevenue ? (
          <div className="px-4 py-4 text-xs text-mono-medium font-sans">
            No side hustle income recorded yet for {taxYear}. Log revenue to see your tax estimate.
          </div>
        ) : (
          <>
            {/* Side hustle tax row */}
            <div className="px-4 py-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat
                label="Net Profit"
                value={formatTaxDollars(estimate.sideHustleNetProfit)}
              />
              <Stat
                label="SE Tax (15.3%)"
                value={formatTaxDollars(estimate.seTax)}
              />
              <Stat
                label={`Income Tax (~${(marginalTaxRate * 100).toFixed(0)}%)`}
                value={formatTaxDollars(estimate.sideHustleIncomeTax)}
              />
              <Stat
                label="Side Hustle Total"
                value={formatTaxDollars(estimate.totalSideHustleTax)}
                bold
              />
            </div>

            {/* Quarterly payment recommendation */}
            <div className="px-4 py-3 bg-[#F0F4F1] border-t border-[#D8E8D8]">
              <p className="text-xs font-medium text-mono-dark">
                Recommended quarterly payment:{" "}
                <span className="text-accent-sage font-semibold tabular-nums">
                  {formatTaxDollars(estimate.recommendedQuarterlyPayment)}
                </span>
                <span className="font-normal text-mono-medium"> / quarter</span>
              </p>
              <p className="text-xs text-mono-medium mt-0.5">
                Side hustle taxes ÷ 4. Pay via{" "}
                <a
                  href="https://www.irs.gov/payments/direct-pay"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-sage hover:underline"
                >
                  IRS Direct Pay
                </a>
                .
              </p>
            </div>

            {/* Combined picture — only when W-2 data present */}
            {estimate.hasW2Data && estimate.totalCombinedTax != null && (
              <div className="px-4 py-3 space-y-2">
                <p className="text-xs font-medium text-mono-medium uppercase tracking-wider">
                  Combined picture (W-2 + side hustle)
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Stat
                    label="Total Tax Owed"
                    value={formatTaxDollars(estimate.totalCombinedTax)}
                    bold
                  />
                  <Stat
                    label={
                      estimate.isUnderWithheld
                        ? "Under-withheld"
                        : "Over-withheld"
                    }
                    value={formatTaxDollars(Math.abs(estimate.netAmountOwed!))}
                    bold
                    accent={estimate.isUnderWithheld ? "warning" : "positive"}
                  />
                </div>
                <p className="text-xs text-mono-medium">
                  {estimate.isUnderWithheld
                    ? `Your W-2 withholding falls short by ${formatTaxDollars(Math.abs(estimate.netAmountOwed!))}. Make estimated payments or adjust withholding.`
                    : `You've over-withheld by ${formatTaxDollars(Math.abs(estimate.netAmountOwed!))} — expect a refund on the W-2 portion.`}
                </p>
              </div>
            )}

            {/* CTA when no W-2 data yet */}
            {!estimate.hasW2Data && (
              <div className="px-4 py-3 text-xs text-mono-medium font-sans flex items-center justify-between gap-3">
                <span>
                  Add W-2 income + withholding for a full "what do I owe" picture.
                </span>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="shrink-0 text-accent-sage font-medium hover:underline"
                >
                  Add
                </button>
              </div>
            )}

            {/* Disclaimer */}
            <div className="px-4 py-2 border-t border-[#F0F1F7]">
              <p className="text-[10px] text-mono-light leading-relaxed">
                Estimate only. Uses your {(marginalTaxRate * 100).toFixed(0)}% marginal rate on the top-bracket slice.
                Verify with a CPA before filing.
              </p>
            </div>
          </>
        )}
      </section>

      {/* W-2 Input Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 min-h-[100dvh] z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="w2-modal-title"
        >
          <div className="rounded-none bg-white shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-white px-6 pt-6 pb-1">
              <h2
                id="w2-modal-title"
                className="text-xl text-mono-dark font-medium"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                W-2 Income for {taxYear}
              </h2>
              <p className="text-xs text-mono-medium mt-1">
                Used only to estimate your total tax picture. Stored privately.
              </p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-mono-medium mb-1.5">
                  W-2 Gross Income
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-mono-medium pointer-events-none">
                    $
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={draftIncome}
                    onChange={(e) => {
                      setDraftIncome(e.target.value);
                      setSaveError(null);
                    }}
                    placeholder="e.g. 85000"
                    className="w-full border border-bg-tertiary/60 pl-8 pr-4 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none"
                  />
                </div>
                <p className="text-[11px] text-mono-light mt-1">
                  Box 1 from your W-2.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-mono-medium mb-1.5">
                  Federal Taxes Withheld (YTD)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-mono-medium pointer-events-none">
                    $
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={draftWithholding}
                    onChange={(e) => {
                      setDraftWithholding(e.target.value);
                      setSaveError(null);
                    }}
                    placeholder="e.g. 18000"
                    className="w-full border border-bg-tertiary/60 pl-8 pr-4 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none"
                  />
                </div>
                <p className="text-[11px] text-mono-light mt-1">
                  Box 2 from your W-2, or current pay stub YTD total.
                </p>
              </div>
              {saveError && (
                <p className="text-xs text-amber-600">{saveError}</p>
              )}
            </div>
            <div className="px-6 pt-1 pb-6 flex justify-between gap-3">
              {(w2Income != null || w2Withholding != null) && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftIncome("");
                    setDraftWithholding("");
                  }}
                  className="text-xs text-mono-light hover:text-mono-medium"
                >
                  Clear
                </button>
              )}
              <div className="flex gap-3 ml-auto">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-medium font-sans bg-[#F0F1F7] text-mono-dark rounded-none hover:bg-[#E4E7F0] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2.5 text-sm font-medium font-sans bg-black text-white rounded-none hover:bg-black/85 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  bold = false,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: "warning" | "positive";
}) {
  const valueColor =
    accent === "warning"
      ? "text-amber-600"
      : accent === "positive"
        ? "text-accent-sage"
        : "text-mono-dark";

  return (
    <div>
      <p className="text-[10px] font-medium text-mono-medium uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p
        className={`text-base tabular-nums ${bold ? "font-semibold" : "font-medium"} ${valueColor}`}
      >
        {value}
      </p>
    </div>
  );
}
