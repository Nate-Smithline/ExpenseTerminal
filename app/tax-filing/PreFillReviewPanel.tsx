"use client";

import { useState } from "react";
import { SCHEDULE_C_LINES } from "@/lib/tax/schedule-c-lines";
import { CurrencyInput } from "@/components/CurrencyInput";
import type { TaxSummaryData, TaxFilingOverride } from "./TaxFilingClient";

interface PreFillReviewPanelProps {
  data: TaxSummaryData;
  se: {
    netEarnings: number;
    socialSecurityTax: number;
    medicareTax: number;
    totalSETax: number;
    deductibleHalf: number;
  } | null;
  overrides: TaxFilingOverride[];
  onOverrideSave: (
    formType: string,
    lineKey: string,
    originalValue: number | null,
    overrideValue: number
  ) => void;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

interface LineRowProps {
  lineKey: string;
  label: string;
  description?: string;
  computedValue: number;
  formType: string;
  overrides: TaxFilingOverride[];
  onOverrideSave: PreFillReviewPanelProps["onOverrideSave"];
  transactions?: Record<string, unknown>[];
  missingNote?: string;
}

function LineRow({
  lineKey,
  label,
  description,
  computedValue,
  formType,
  overrides,
  onOverrideSave,
  transactions,
  missingNote,
}: LineRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(0);

  const override = overrides.find(
    (o) => o.form_type === formType && o.line_key === lineKey
  );
  const displayValue = override ? override.override_value : computedValue;
  const isOverridden = override != null;
  const isEmpty = computedValue === 0 && !override;
  const matchingTx = transactions?.filter((t) => {
    if (formType === "schedule_c") {
      return (String(t.schedule_c_line ?? "27")) === lineKey;
    }
    return false;
  });
  const hasTx = matchingTx && matchingTx.length > 0;

  function handleStartEdit() {
    setEditValue(displayValue);
    setEditing(true);
  }

  function handleSave() {
    onOverrideSave(formType, lineKey, computedValue || null, editValue);
    setEditing(false);
  }

  function handleCancel() {
    setEditing(false);
  }

  return (
    <div
      className={`border-b border-bg-tertiary/30 last:border-b-0 ${
        isOverridden ? "bg-warm-stock/30" : ""
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-mono-light font-medium tabular-nums w-12 shrink-0">
              {lineKey.startsWith("se_") || lineKey.startsWith("8829_") || lineKey.startsWith("4562_")
                ? ""
                : `Line ${lineKey}`}
            </span>
            <span className="text-sm text-mono-dark font-medium truncate">{label}</span>
            {isOverridden && (
              <span className="text-[10px] font-semibold text-accent-warm bg-accent-warm/10 px-1.5 py-0.5 rounded-sm">
                OVERRIDE
              </span>
            )}
            {isEmpty && missingNote && (
              <span className="text-[10px] text-mono-light italic">{missingNote}</span>
            )}
          </div>
          {description && (
            <p className="text-[11px] text-mono-light ml-14 mt-0.5">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <div className="w-28">
                <CurrencyInput
                  value={editValue}
                  onChange={setEditValue}
                  placeholder="0.00"
                  aria-label={`Override value for ${label}`}
                  className={isOverridden ? "border-accent-warm" : ""}
                />
              </div>
              <button
                onClick={handleSave}
                className="text-xs font-medium text-accent-sage hover:text-accent-sage/80 px-2 py-1.5"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="text-xs text-mono-light hover:text-mono-medium px-2 py-1.5"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <span
                className={`text-sm font-medium tabular-nums ${
                  isEmpty ? "text-mono-light" : "text-mono-dark"
                }`}
              >
                {isEmpty ? "—" : formatCurrency(displayValue)}
              </span>
              <button
                onClick={handleStartEdit}
                className="text-[11px] text-sovereign-blue hover:text-sovereign-blue/80 font-medium px-1.5"
                title="Override this value"
              >
                Override
              </button>
            </>
          )}

          {hasTx && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-mono-light hover:text-mono-medium ml-1"
              aria-label={expanded ? "Collapse transactions" : "Expand transactions"}
            >
              <span
                className="material-symbols-rounded text-[18px]"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
              >
                {expanded ? "expand_less" : "expand_more"}
              </span>
            </button>
          )}
        </div>
      </div>

      {expanded && hasTx && (
        <div className="px-4 pb-3 ml-14">
          <div className="bg-cool-stock/50 border border-bg-tertiary/20 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-mono-light">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Vendor</th>
                  <th className="px-3 py-2 font-medium text-right">Amount</th>
                  <th className="px-3 py-2 font-medium text-right">Deduction %</th>
                </tr>
              </thead>
              <tbody>
                {matchingTx!.slice(0, 20).map((tx: Record<string, unknown>, i: number) => (
                  <tr
                    key={String(tx.id ?? i)}
                    className="border-t border-bg-tertiary/20"
                  >
                    <td className="px-3 py-1.5 text-mono-medium tabular-nums">
                      {String(tx.date ?? "")}
                    </td>
                    <td className="px-3 py-1.5 text-mono-dark truncate max-w-[180px]">
                      {String(tx.vendor ?? "")}
                    </td>
                    <td className="px-3 py-1.5 text-mono-dark text-right tabular-nums">
                      {formatCurrency(Math.abs(Number(tx.amount)))}
                    </td>
                    <td className="px-3 py-1.5 text-mono-medium text-right">
                      {(tx.deduction_percent as number) ?? 100}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {matchingTx!.length > 20 && (
              <p className="px-3 py-2 text-[11px] text-mono-light border-t border-bg-tertiary/20">
                Showing 20 of {matchingTx!.length} transactions
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function PreFillReviewPanel({
  data,
  se,
  overrides,
  onOverrideSave,
}: PreFillReviewPanelProps) {
  const transactions = data.deductibleTransactions ?? data.transactions ?? [];

  function scrollToFiling() {
    document.getElementById("filing-path-selector")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <div>
        <div
          role="heading"
          aria-level={2}
          className="text-xl font-sans font-medium text-mono-dark"
        >
          Pre-Fill Review
        </div>
        <p className="text-sm text-mono-medium mt-1">
          Review each line below. Override any value that needs correction — overrides are
          tracked separately and won&apos;t change your original data.
        </p>
      </div>

      {/* Schedule C */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 bg-cool-stock/30 border-b border-bg-tertiary/20">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-rounded text-[20px] text-sovereign-blue"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
            >
              description
            </span>
            <span className="text-sm font-medium text-mono-dark">
              Schedule C — Profit or Loss From Business
            </span>
          </div>
        </div>

        {/* Gross receipts (Line 1) */}
        <LineRow
          lineKey="1"
          label="Gross receipts or sales"
          computedValue={data.grossIncome}
          formType="schedule_c"
          overrides={overrides}
          onOverrideSave={onOverrideSave}
          transactions={data.transactions?.filter(
            (t: Record<string, unknown>) => t.transaction_type === "income"
          )}
        />

        {/* Expense lines */}
        {SCHEDULE_C_LINES.map((line) => {
          const amt = data.lineBreakdown[line.line] ?? 0;
          return (
            <LineRow
              key={line.line}
              lineKey={line.line}
              label={line.label}
              description={line.description}
              computedValue={amt}
              formType="schedule_c"
              overrides={overrides}
              onOverrideSave={onOverrideSave}
              transactions={transactions}
              missingNote={
                amt === 0 ? "No transactions mapped to this line" : undefined
              }
            />
          );
        })}

        {/* Totals */}
        <div className="border-t-2 border-bg-tertiary/40">
          <LineRow
            lineKey="28"
            label="Total expenses"
            computedValue={data.totalExpenses}
            formType="schedule_c"
            overrides={overrides}
            onOverrideSave={onOverrideSave}
          />
          <LineRow
            lineKey="31"
            label="Net profit (or loss)"
            computedValue={data.netProfit}
            formType="schedule_c"
            overrides={overrides}
            onOverrideSave={onOverrideSave}
          />
        </div>
      </div>

      {/* Schedule SE */}
      {se && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 bg-cool-stock/30 border-b border-bg-tertiary/20">
            <div className="flex items-center gap-2">
              <span
                className="material-symbols-rounded text-[20px] text-sovereign-blue"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
              >
                calculate
              </span>
              <span className="text-sm font-medium text-mono-dark">
                Schedule SE — Self-Employment Tax
              </span>
            </div>
          </div>
          <LineRow
            lineKey="se_net_profit"
            label="Net profit from Schedule C"
            computedValue={data.netProfit}
            formType="schedule_se"
            overrides={overrides}
            onOverrideSave={onOverrideSave}
          />
          <LineRow
            lineKey="se_92_35"
            label="92.35% of net earnings"
            computedValue={se.netEarnings}
            formType="schedule_se"
            overrides={overrides}
            onOverrideSave={onOverrideSave}
          />
          <LineRow
            lineKey="se_ss_tax"
            label="Social Security tax (12.4%)"
            computedValue={se.socialSecurityTax}
            formType="schedule_se"
            overrides={overrides}
            onOverrideSave={onOverrideSave}
          />
          <LineRow
            lineKey="se_medicare_tax"
            label="Medicare tax (2.9%)"
            computedValue={se.medicareTax}
            formType="schedule_se"
            overrides={overrides}
            onOverrideSave={onOverrideSave}
          />
          <div className="border-t-2 border-bg-tertiary/40">
            <LineRow
              lineKey="se_total"
              label="Total self-employment tax"
              computedValue={se.totalSETax}
              formType="schedule_se"
              overrides={overrides}
              onOverrideSave={onOverrideSave}
            />
            <LineRow
              lineKey="se_deductible_half"
              label="Deductible half of SE tax"
              computedValue={se.deductibleHalf}
              formType="schedule_se"
              overrides={overrides}
              onOverrideSave={onOverrideSave}
            />
          </div>
        </div>
      )}

      {/* Form 8829 — Home Office */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 bg-cool-stock/30 border-b border-bg-tertiary/20">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-rounded text-[20px] text-sovereign-blue"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
            >
              home_work
            </span>
            <span className="text-sm font-medium text-mono-dark">
              Form 8829 — Business Use of Home
            </span>
          </div>
        </div>
        {(() => {
          const homeOfficeAmt =
            data.categoryBreakdown["home_office"] ?? data.categoryBreakdown["Home Office"] ?? 0;
          if (homeOfficeAmt <= 0) {
            return (
              <div className="px-4 py-4">
                <p className="text-xs text-mono-light italic">
                  No home office deduction found. If you use part of your home for
                  business, add a home office deduction from the{" "}
                  <a href="/deductions/home-office" className="text-sovereign-blue hover:underline">
                    Home Office calculator
                  </a>
                  .
                </p>
              </div>
            );
          }
          return (
            <>
              <LineRow
                lineKey="8829_deduction"
                label="Home office deduction"
                computedValue={homeOfficeAmt}
                formType="form_8829"
                overrides={overrides}
                onOverrideSave={onOverrideSave}
                missingNote="Enter square footage details on the Home Office calculator"
              />
              <LineRow
                lineKey="8829_sqft_business"
                label="Business square footage"
                computedValue={0}
                formType="form_8829"
                overrides={overrides}
                onOverrideSave={onOverrideSave}
                missingNote="Supply from your home office setup"
              />
              <LineRow
                lineKey="8829_sqft_total"
                label="Total home area (sq ft)"
                computedValue={0}
                formType="form_8829"
                overrides={overrides}
                onOverrideSave={onOverrideSave}
                missingNote="Supply from your home office setup"
              />
              <LineRow
                lineKey="8829_pct"
                label="Business use percentage"
                computedValue={0}
                formType="form_8829"
                overrides={overrides}
                onOverrideSave={onOverrideSave}
                missingNote="Calculated from square footage"
              />
            </>
          );
        })()}
      </div>

      {/* Form 4562 — Vehicle */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 bg-cool-stock/30 border-b border-bg-tertiary/20">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-rounded text-[20px] text-sovereign-blue"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
            >
              directions_car
            </span>
            <span className="text-sm font-medium text-mono-dark">
              Form 4562 — Vehicle Deduction
            </span>
          </div>
        </div>
        {(() => {
          const vehicleAmt =
            data.categoryBreakdown["mileage"] ??
            data.categoryBreakdown["vehicle_expenses"] ??
            data.categoryBreakdown["Mileage"] ??
            0;
          const lineAmt = data.lineBreakdown["9"] ?? 0;
          const totalAmt = vehicleAmt + lineAmt;

          if (totalAmt <= 0) {
            return (
              <div className="px-4 py-4">
                <p className="text-xs text-mono-light italic">
                  No vehicle deduction found. If you drive for business, add a mileage
                  deduction from the{" "}
                  <a href="/deductions/mileage" className="text-sovereign-blue hover:underline">
                    Mileage calculator
                  </a>
                  .
                </p>
              </div>
            );
          }
          return (
            <>
              <LineRow
                lineKey="4562_deduction"
                label="Vehicle deduction"
                computedValue={totalAmt}
                formType="form_4562"
                overrides={overrides}
                onOverrideSave={onOverrideSave}
              />
              <LineRow
                lineKey="4562_total_miles"
                label="Total miles driven"
                computedValue={0}
                formType="form_4562"
                overrides={overrides}
                onOverrideSave={onOverrideSave}
                missingNote="Supply from your mileage log"
              />
              <LineRow
                lineKey="4562_business_miles"
                label="Business miles"
                computedValue={0}
                formType="form_4562"
                overrides={overrides}
                onOverrideSave={onOverrideSave}
                missingNote="Supply from your mileage log"
              />
              <LineRow
                lineKey="4562_business_pct"
                label="Business use percentage"
                computedValue={0}
                formType="form_4562"
                overrides={overrides}
                onOverrideSave={onOverrideSave}
                missingNote="Calculated from miles"
              />
            </>
          );
        })()}
      </div>

      {/* CTA to scroll to filing options */}
      <div className="flex justify-center">
        <button onClick={scrollToFiling} className="btn-primary gap-2">
          Looks good — choose how to file
          <span
            className="material-symbols-rounded text-[18px]"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
          >
            arrow_downward
          </span>
        </button>
      </div>
    </div>
  );
}
