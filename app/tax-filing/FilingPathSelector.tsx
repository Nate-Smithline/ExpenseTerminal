"use client";

import { useState } from "react";
import { SCHEDULE_C_LINES } from "@/lib/tax/schedule-c-lines";
import type { TaxSummaryData, TaxFilingOverride } from "./TaxFilingClient";

interface FilingPathSelectorProps {
  data: TaxSummaryData;
  se: {
    netEarnings: number;
    socialSecurityTax: number;
    medicareTax: number;
    totalSETax: number;
    deductibleHalf: number;
  } | null;
  overrides: TaxFilingOverride[];
  taxYear: number;
  filingType: string | null;
  personalFilingStatus: string | null;
  onDownloadRequest: (type: "self_file" | "cpa_packet") => void;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function FilingPathSelector(props: FilingPathSelectorProps) {
  const { data, overrides, onDownloadRequest } = props;
  const [vendorAccordionOpen, setVendorAccordionOpen] = useState(false);

  const missingLines = SCHEDULE_C_LINES.filter((l) => {
    const amt = data.lineBreakdown[l.line] ?? 0;
    const hasOverride = overrides.some(
      (o) => o.form_type === "schedule_c" && o.line_key === l.line
    );
    return amt === 0 && !hasOverride;
  });

  const estimatedTaxSaved = data.totalExpenses * (data.effectiveTaxRate || 0.24);

  const topCategories = Object.entries(data.categoryBreakdown)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div id="filing-path-selector" className="space-y-6 scroll-mt-8">
      <div>
        <div
          role="heading"
          aria-level={2}
          className="text-xl font-sans font-medium text-mono-dark"
        >
          Choose How to File
        </div>
        <p className="text-sm text-mono-medium mt-1">
          Your forms are pre-filled and ready. Pick the path that works best for you.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card 1 — File Myself */}
        <div className="card p-6 space-y-4 flex flex-col">
          <div className="flex-1 space-y-3">
            <div>
              <div className="text-base font-medium text-mono-dark">File Myself</div>
              <p className="text-xs text-mono-medium mt-1 leading-relaxed">
                Download your pre-filled forms and upload them to a tax e-filing platform.
                You&apos;re in control.
              </p>
            </div>

            <button
              onClick={() => onDownloadRequest("self_file")}
              className="btn-primary w-full justify-center"
            >
              <span
                className="material-symbols-rounded text-[18px] mr-1.5"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
              >
                download
              </span>
              Download My Forms
            </button>

            {/* Vendor accordion */}
            <div className="border border-bg-tertiary/30 rounded-lg overflow-hidden">
              <button
                onClick={() => setVendorAccordionOpen(!vendorAccordionOpen)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-cool-stock/40 transition-colors"
              >
                <span className="text-xs font-medium text-mono-medium">
                  Where can I upload these?
                </span>
                <span
                  className="material-symbols-rounded text-[16px] text-mono-light"
                  style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
                >
                  {vendorAccordionOpen ? "expand_less" : "expand_more"}
                </span>
              </button>
              {vendorAccordionOpen && (
                <div className="px-3 pb-3 text-xs text-mono-medium space-y-1.5 border-t border-bg-tertiary/20 pt-2">
                  <p className="font-medium text-mono-dark">Compatible platforms:</p>
                  <ul className="space-y-1 list-disc list-inside text-[11px]">
                    <li>FreeTaxUSA (free federal)</li>
                    <li>Cash App Taxes (free)</li>
                    <li>TaxAct ($65+)</li>
                    <li>TurboTax Self-Employed ($130+)</li>
                    <li>H&R Block Premium ($85+)</li>
                    <li>TaxSlayer Self-Employed ($50+)</li>
                  </ul>
                  <p className="text-[11px] text-mono-light mt-1">
                    See the full comparison table below.
                  </p>
                </div>
              )}
            </div>

            {/* Missing lines checklist */}
            {missingLines.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-mono-medium">
                  Lines to enter manually on the platform:
                </p>
                <ul className="space-y-0.5">
                  {missingLines.slice(0, 5).map((l) => (
                    <li
                      key={l.line}
                      className="flex items-center gap-1.5 text-[11px] text-mono-light"
                    >
                      <span
                        className="material-symbols-rounded text-[14px]"
                        style={{
                          fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
                        }}
                      >
                        check_box_outline_blank
                      </span>
                      Line {l.line}: {l.label}
                    </li>
                  ))}
                  {missingLines.length > 5 && (
                    <li className="text-[11px] text-mono-light pl-5">
                      +{missingLines.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Card 2 — Review with CPA */}
        <div className="card p-6 space-y-4 flex flex-col">
          <div className="flex-1 space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-medium text-mono-dark">
                  Review with a CPA
                </span>
                <span className="text-[10px] font-semibold text-accent-sage bg-accent-sage/10 px-2 py-0.5 rounded-sm">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-mono-medium mt-1 leading-relaxed">
                Get a professional to review your numbers before filing. Your forms and
                data are ready to hand off.
              </p>
            </div>

            <button
              onClick={() => onDownloadRequest("cpa_packet")}
              className="btn-primary w-full justify-center"
            >
              <span
                className="material-symbols-rounded text-[18px] mr-1.5"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
              >
                folder_zip
              </span>
              Download CPA Packet
            </button>

            <p className="text-[11px] text-mono-light leading-relaxed">
              Includes pre-filled forms, a CPA cover memo with methodology notes,
              transaction summary CSV, and a deduction breakdown sheet.
            </p>

            <div className="border-t border-bg-tertiary/30 pt-3 space-y-2">
              <p className="text-xs font-medium text-mono-medium">
                Want a CPA to review this directly?
              </p>
              {/* TODO: CPA partner referral links — placeholder until partnerships confirmed */}
              <div className="space-y-1.5">
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-sovereign-blue hover:text-sovereign-blue/80 transition-colors"
                >
                  <span
                    className="material-symbols-rounded text-[14px]"
                    style={{
                      fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
                    }}
                  >
                    open_in_new
                  </span>
                  Taxfyle — On-demand CPA matching
                </a>
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-sovereign-blue hover:text-sovereign-blue/80 transition-colors"
                >
                  <span
                    className="material-symbols-rounded text-[14px]"
                    style={{
                      fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
                    }}
                  >
                    open_in_new
                  </span>
                  Column Tax — Self-employed specialists
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3 — Insights & Next Steps */}
        <div className="card p-6 space-y-4 flex flex-col">
          <div className="flex-1 space-y-3">
            <div>
              <div className="text-base font-medium text-mono-dark">Your Tax Picture</div>
              <p className="text-xs text-mono-medium mt-1 leading-relaxed">
                What your categorization saved you, and what to watch for next year.
              </p>
            </div>

            <div className="space-y-3">
              {/* Estimated tax saved */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-mono-medium">Estimated tax saved</span>
                <span className="text-sm font-semibold text-accent-sage tabular-nums">
                  {formatCurrency(estimatedTaxSaved)}
                </span>
              </div>

              {/* Effective tax rate */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-mono-medium">Effective rate on side income</span>
                <span className="text-sm font-medium text-mono-dark tabular-nums">
                  {formatPercent(data.effectiveTaxRate)}
                </span>
              </div>

              {/* Top categories */}
              {topCategories.length > 0 && (
                <div className="pt-2 border-t border-bg-tertiary/20 space-y-1.5">
                  <p className="text-[11px] font-medium text-mono-medium">
                    Top deduction categories
                  </p>
                  {topCategories.map(([name, amt]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-[11px] text-mono-medium truncate max-w-[140px]">
                        {name}
                      </span>
                      <span className="text-[11px] font-medium text-mono-dark tabular-nums">
                        {formatCurrency(amt as number)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Set a reminder */}
              <div className="pt-2 border-t border-bg-tertiary/20">
                {/* TODO: Set a reminder CTA — wire to notification system when ready */}
                <button
                  className="btn-secondary w-full justify-center text-xs py-2"
                  onClick={() => {
                    // TODO: Wire to notification/settings system
                    alert("Reminder feature coming soon.");
                  }}
                >
                  <span
                    className="material-symbols-rounded text-[16px] mr-1"
                    style={{
                      fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
                    }}
                  >
                    notifications
                  </span>
                  Set a reminder for next year
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
