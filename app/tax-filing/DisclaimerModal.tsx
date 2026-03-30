"use client";

import { useState, useEffect } from "react";

interface DisclaimerModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  exportType: "self_file" | "cpa_packet";
  taxYear: number;
  hasOverrides: boolean;
}

export function DisclaimerModal({
  open,
  onClose,
  onConfirm,
  exportType,
  taxYear,
  hasOverrides,
}: DisclaimerModalProps) {
  const [loading, setLoading] = useState(false);

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

  async function handleConfirm() {
    setLoading(true);
    try {
      await fetch("/api/tax-filing/disclaimer-ack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type: exportType === "cpa_packet" ? "cpa_packet_download" : "self_file_download",
          tax_year: taxYear,
        }),
      });
    } catch {
      // Non-blocking — proceed even if ack fails
    }
    onConfirm();
    setLoading(false);
  }

  const title =
    exportType === "cpa_packet"
      ? "Download CPA Packet"
      : "Download Tax Forms";

  return (
    <div
      className="fixed inset-0 min-h-[100dvh] z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-modal-title"
    >
      <div className="rounded-none bg-white shadow-xl max-w-lg w-full mx-4 overflow-hidden">
        <div className="bg-white px-6 pt-6 pb-2">
          <h2
            id="disclaimer-modal-title"
            className="text-xl text-mono-dark font-medium"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {title}
          </h2>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="bg-warm-stock/60 border border-accent-warm/20 px-4 py-3">
            <p className="text-xs text-mono-dark leading-relaxed">
              <span className="font-semibold">Important:</span> You are fully responsible
              for reviewing, verifying, and approving all values included in this export
              before filing with the IRS or sharing with a tax professional. The data in
              these documents is generated from your transaction imports and categorization
              decisions. This is not tax advice, and ExpenseTerminal is not a licensed tax
              preparer.
            </p>
          </div>

          <p className="text-xs text-mono-medium leading-relaxed">
            By proceeding, you confirm that you have reviewed the pre-filled values on this
            page and accept full liability for any decisions and filings made using these
            documents.
          </p>

          {hasOverrides && (
            <div className="flex items-start gap-2 text-xs text-mono-medium">
              <span
                className="material-symbols-rounded text-[16px] text-accent-warm shrink-0 mt-0.5"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
              >
                edit_note
              </span>
              <span>
                Your export includes manually overridden values. These are flagged in the
                cover sheet{exportType === "cpa_packet" ? " and CPA memo" : ""}.
              </span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 pt-2 pb-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 text-sm font-medium font-sans bg-[#F0F1F7] text-mono-dark rounded-none hover:bg-[#E4E7F0] transition-colors disabled:opacity-40"
          >
            Go back and review
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="px-4 py-2.5 text-sm font-medium font-sans bg-black text-white rounded-none hover:bg-black/85 transition-colors disabled:opacity-40"
          >
            {loading ? "Preparing…" : "I understand — Download"}
          </button>
        </div>
      </div>
    </div>
  );
}
