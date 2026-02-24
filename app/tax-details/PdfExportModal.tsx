"use client";

import { useState } from "react";

interface PdfExportModalProps {
  open: boolean;
  onClose: () => void;
  taxYear: number;
  quarter: number | null;
  filingType: string | null;
}

export function PdfExportModal({
  open,
  onClose,
  taxYear,
  quarter,
  filingType,
}: PdfExportModalProps) {
  const [includeScheduleC, setIncludeScheduleC] = useState(true);
  const [includeScheduleSE, setIncludeScheduleSE] = useState(true);
  const [includeCategories, setIncludeCategories] = useState(true);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const isScheduleCFiler =
    !filingType ||
    filingType === "sole_proprietor" ||
    filingType === "Sole Proprietor" ||
    filingType === "single_llc" ||
    filingType === "Single-member LLC";

  function handleDownload() {
    setLoading(true);
    const params = new URLSearchParams({
      format: "pdf",
      tax_year: String(taxYear),
    });
    if (quarter) params.set("quarter", String(quarter));
    if (includeScheduleC) params.set("schedule_c", "true");
    if (includeScheduleSE) params.set("schedule_se", "true");
    if (includeCategories) params.set("categories", "true");

    window.open(`/api/reports/export?${params.toString()}`, "_blank");
    setTimeout(() => {
      setLoading(false);
      onClose();
    }, 800);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-tax-documents-title"
    >
      <div className="rounded-xl bg-white shadow-[0_8px_30px_-6px_rgba(0,0,0,0.14)] max-w-[480px] w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="rounded-t-xl bg-[#2d3748] px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="export-tax-documents-title"
                className="text-xl font-bold text-white tracking-tight"
              >
                Export Tax Documents
              </h2>
              <p className="text-sm text-white/80 mt-1.5">
                Choose which sections to include in your{" "}
                <span className="font-semibold">{taxYear}</span>
                {quarter ? (
                  <>
                    {" "}
                    Q{quarter}
                  </>
                ) : null}{" "}
                PDF package.
              </p>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition shrink-0"
              aria-label="Close"
            >
              <span className="material-symbols-rounded text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-4">
          <p className="text-xs text-mono-medium leading-relaxed">
            These PDFs are designed for{" "}
            <span className="font-medium">your tax professional</span> or records.
            They summarize your income, deductions, and categories based on what
            you&apos;ve tracked in ExpenseTerminal.
          </p>

          <div className="space-y-3">
          {isScheduleCFiler && (
            <>
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-bg-secondary/60 transition-colors">
                <input
                  type="checkbox"
                  checked={includeScheduleC}
                  onChange={(e) => setIncludeScheduleC(e.target.checked)}
                  className="w-4 h-4 rounded accent-accent-sage"
                />
                <div>
                  <p className="text-sm font-medium text-mono-dark">Schedule C summary (Form 1040)</p>
                  <p className="text-xs text-mono-light">Line-by-line expense breakdown</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-bg-secondary/60 transition-colors">
                <input
                  type="checkbox"
                  checked={includeScheduleSE}
                  onChange={(e) => setIncludeScheduleSE(e.target.checked)}
                  className="w-4 h-4 rounded accent-accent-sage"
                />
                <div>
                  <p className="text-sm font-medium text-mono-dark">Schedule SE (Self-employment tax)</p>
                  <p className="text-xs text-mono-light">Shows SE tax and deductible half</p>
                </div>
              </label>
            </>
          )}

          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-bg-secondary/60 transition-colors">
            <input
              type="checkbox"
              checked={includeCategories}
              onChange={(e) => setIncludeCategories(e.target.checked)}
              className="w-4 h-4 rounded accent-accent-sage"
            />
            <div>
              <p className="text-sm font-medium text-mono-dark">Category Breakout</p>
              <p className="text-xs text-mono-light">Expense distribution by category for your return</p>
            </div>
          </label>
        </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-bg-tertiary/40">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-bg-tertiary bg-white px-4 py-2.5 text-sm font-semibold text-mono-dark hover:bg-bg-secondary transition disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={loading}
            className="rounded-md bg-mono-dark px-4 py-2.5 text-sm font-semibold text-white hover:bg-mono-dark/90 transition disabled:opacity-40"
          >
            {loading ? "Generating…" : "Download tax PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
