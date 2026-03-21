"use client";

import { useState, useEffect } from "react";

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
  const [includeAuditList, setIncludeAuditList] = useState(false);
  const [loading, setLoading] = useState(false);

  // ESC to close, align with preferences modals
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    if (!open) return;
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  const isScheduleCFiler =
    !filingType ||
    filingType === "sole_prop" ||
    filingType === "llc" ||
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
    if (includeAuditList) params.set("audit_only", "true");

    window.open(`/api/reports/export?${params.toString()}`, "_blank");
    setTimeout(() => {
      setLoading(false);
      onClose();
    }, 800);
  }

  return (
    <div
      className="fixed inset-0 min-h-[100dvh] z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-tax-documents-title"
    >
      <div className="rounded-none bg-white shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header (preferences-style) */}
        <div className="bg-white px-6 pt-6 pb-2 flex items-center justify-between gap-4">
          <div>
            <h2
              id="export-tax-documents-title"
              className="text-xl text-mono-dark font-medium"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Export tax documents
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-3">
          <p className="text-xs text-mono-medium leading-relaxed">
            Export a PDF package your tax preparer can reference alongside IRS forms for{" "}
            <span className="font-medium">{taxYear}</span>
            {quarter ? (
              <>
                {" "}
                Q{quarter}
              </>
            ) : null}
            .
          </p>

          <div className="space-y-2.5">
          {isScheduleCFiler && (
            <>
              <label className="flex items-center gap-3 cursor-pointer p-3 border border-[#F0F1F7] bg-white hover:bg-[#F0F1F7]/40 transition-colors">
                <input
                  type="checkbox"
                  checked={includeScheduleC}
                  onChange={(e) => setIncludeScheduleC(e.target.checked)}
                  className="w-4 h-4 rounded-none border-bg-tertiary accent-[#2563EB]"
                />
                <div>
                  <p className="text-sm font-medium text-mono-dark">Schedule C summary (Form 1040)</p>
                  <p className="text-xs text-mono-light">
                    Line-by-line expense totals that line up with the Schedule C expense section.
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 border border-[#F0F1F7] bg-white hover:bg-[#F0F1F7]/40 transition-colors">
                <input
                  type="checkbox"
                  checked={includeScheduleSE}
                  onChange={(e) => setIncludeScheduleSE(e.target.checked)}
                  className="w-4 h-4 rounded-none border-bg-tertiary accent-[#2563EB]"
                />
                <div>
                  <p className="text-sm font-medium text-mono-dark">Schedule SE (Self-employment tax)</p>
                  <p className="text-xs text-mono-light">
                    Breaks out the Schedule SE math: net earnings, Social Security, Medicare, and the
                    deductible half.
                  </p>
                </div>
              </label>
            </>
          )}

          <label className="flex items-center gap-3 cursor-pointer p-3 border border-[#F0F1F7] bg-white hover:bg-[#F0F1F7]/40 transition-colors">
            <input
              type="checkbox"
              checked={includeCategories}
              onChange={(e) => setIncludeCategories(e.target.checked)}
              className="w-4 h-4 rounded-none border-bg-tertiary accent-[#2563EB]"
            />
            <div>
              <p className="text-sm font-medium text-mono-dark">Category breakdown</p>
              <p className="text-xs text-mono-light">
                Summary of your deductible expenses by category (matches the Category Breakout card).
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer p-3 border border-[#F0F1F7] bg-white hover:bg-[#F0F1F7]/40 transition-colors">
            <input
              type="checkbox"
              checked={includeAuditList}
              onChange={(e) => setIncludeAuditList(e.target.checked)}
              className="w-4 h-4 rounded-none border-bg-tertiary accent-[#2563EB]"
            />
            <div>
              <p className="text-sm font-medium text-mono-dark">Audit-ready transaction list</p>
              <p className="text-xs text-mono-light">
                Extra page listing only transactions with a non-zero deduction and a written audit reason.
              </p>
            </div>
          </label>
        </div>
        </div>

        {/* Footer (preferences-style) */}
        <div className="flex justify-end gap-3 px-6 pt-2 pb-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 text-sm font-medium font-sans bg-[#F0F1F7] text-mono-dark rounded-none hover:bg-[#E4E7F0] transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={loading}
            className="px-4 py-2.5 text-sm font-medium font-sans bg-black text-white rounded-none hover:bg-black/85 transition-colors disabled:opacity-40"
          >
            {loading ? "Generating…" : "Download tax PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
