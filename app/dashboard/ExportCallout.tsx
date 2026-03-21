"use client";

import { useState } from "react";
import { PdfExportModal } from "../tax-details/PdfExportModal";

export function ExportCallout({
  taxYear,
  filingType,
}: {
  taxYear: number;
  filingType: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="w-full bg-[#F0F1F7] px-4 py-3 flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs sm:text-sm font-medium text-mono-dark">
            Tax documents for download
          </p>
          <p className="text-[11px] text-mono-medium">
            Schedule C, Schedule SE, and 1040-ES style summaries in one PDF
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-4 py-2.5 text-sm font-medium font-sans bg-black text-white rounded-none hover:bg-black/85 transition-colors shrink-0"
        >
          Export
        </button>
      </div>

      <PdfExportModal
        open={open}
        onClose={() => setOpen(false)}
        taxYear={taxYear}
        quarter={null}
        filingType={filingType}
      />
    </>
  );
}

