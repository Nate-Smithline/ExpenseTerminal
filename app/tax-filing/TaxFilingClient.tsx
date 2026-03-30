"use client";

import { useState, useEffect, useCallback } from "react";
import { TaxYearSelector } from "@/components/TaxYearSelector";
import { persistTaxYear } from "@/lib/tax-year-cookie";
import { calculateScheduleSE } from "@/lib/tax/form-calculations";
import { getFilingTypeConfig } from "@/lib/tax/schedule-c-lines";
import { PreFillReviewPanel } from "./PreFillReviewPanel";
import { FilingPathSelector } from "./FilingPathSelector";
import { VendorList } from "./VendorList";
import { DisclaimerModal } from "./DisclaimerModal";

export interface TaxFilingOverride {
  form_type: string;
  line_key: string;
  original_value: number | null;
  override_value: number;
}

export interface TaxSummaryData {
  grossIncome: number;
  totalExpenses: number;
  netProfit: number;
  selfEmploymentTax: number;
  deductibleSETax: number;
  estimatedQuarterlyPayment: number;
  effectiveTaxRate: number;
  lineBreakdown: Record<string, number>;
  categoryBreakdown: Record<string, number>;
  transactions: Record<string, unknown>[];
  deductibleTransactions: Record<string, unknown>[];
  filingType: string | null;
}

interface TaxFilingClientProps {
  defaultYear: number;
  filingType: string | null;
  personalFilingStatus: string | null;
  businessName: string | null;
  businessIndustry: string | null;
  userName: string | null;
}

export function TaxFilingClient(props: TaxFilingClientProps) {
  const { defaultYear, filingType, personalFilingStatus } = props;
  const [year, setYear] = useState(defaultYear);
  const [data, setData] = useState<TaxSummaryData | null>(null);
  
  const [overrides, setOverrides] = useState<TaxFilingOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [disclaimerExportType, setDisclaimerExportType] = useState<"self_file" | "cpa_packet">(
    "self_file"
  );

  const filingConfig = getFilingTypeConfig(filingType);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tax_year: String(year) });
      const [summaryRes, overridesRes, deductionsRes] = await Promise.all([
        fetch(`/api/tax-details/summary?${params}`),
        fetch(`/api/tax-filing/overrides?${params}`),
        fetch(`/api/reports/export?format=csv&tax_year=${year}`).catch(() => null),
      ]);

      const summaryJson = await summaryRes.json();
      setData(summaryJson);

      const overridesJson = await overridesRes.json();
      setOverrides(
        (overridesJson.overrides ?? []).map((o: any) => ({
          form_type: o.form_type,
          line_key: o.line_key,
          original_value: o.original_value != null ? Number(o.original_value) : null,
          override_value: Number(o.override_value),
        }))
      );

      // Fetch deductions separately for home office / mileage metadata
      const dedParams = new URLSearchParams({ tax_year: String(year) });
      const dedRes = await fetch(`/api/tax-details/summary?${dedParams}`);
      if (dedRes.ok) {
        const dedJson = await dedRes.json();
        // Deductions aren't exposed by the summary endpoint directly,
        // so we rely on the categoryBreakdown for display
      }
    } catch (err) {
      console.error("Failed to fetch tax filing data:", err);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleYearChange(y: number) {
    setYear(y);
    persistTaxYear(y);
  }

  async function handleOverrideSave(
    formType: string,
    lineKey: string,
    originalValue: number | null,
    overrideValue: number
  ) {
    try {
      const res = await fetch("/api/tax-filing/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tax_year: year,
          form_type: formType,
          line_key: lineKey,
          original_value: originalValue,
          override_value: overrideValue,
        }),
      });
      if (res.ok) {
        setOverrides((prev) => {
          const existing = prev.findIndex(
            (o) => o.form_type === formType && o.line_key === lineKey
          );
          const newOverride: TaxFilingOverride = {
            form_type: formType,
            line_key: lineKey,
            original_value: originalValue,
            override_value: overrideValue,
          };
          if (existing >= 0) {
            const next = [...prev];
            next[existing] = newOverride;
            return next;
          }
          return [...prev, newOverride];
        });
      }
    } catch (err) {
      console.error("Failed to save override:", err);
    }
  }

  function handleDownloadRequest(type: "self_file" | "cpa_packet") {
    setDisclaimerExportType(type);
    setDisclaimerOpen(true);
  }

  function handleDisclaimerConfirm() {
    setDisclaimerOpen(false);
    const params = new URLSearchParams({
      type: disclaimerExportType,
      tax_year: String(year),
    });
    window.open(`/api/tax-filing/export?${params}`, "_blank");
  }

  const se = data ? calculateScheduleSE(data.netProfit ?? 0) : null;

  return (
    <div className="space-y-10">
      {/* Section 1 — Page Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div
              role="heading"
              aria-level={1}
              className="text-[32px] leading-tight font-sans font-normal text-mono-dark"
            >
              Tax Filing Center
            </div>
            <p className="text-base text-mono-medium mt-1 font-sans">
              Review your pre-filled forms, then choose how you want to file.
            </p>
            <p className="text-xs text-mono-light mt-1">
              {filingConfig.label} &middot; {filingConfig.forms.join(", ")}
            </p>
          </div>
          <TaxYearSelector value={year} onChange={handleYearChange} label="Tax year" compact />
        </div>
      </div>

      {/* Persistent disclaimer banner */}
      <div
        className="bg-warm-stock border border-accent-warm/30 px-5 py-4"
        role="alert"
      >
        <p className="text-xs text-mono-dark leading-relaxed">
          The numbers on this page are generated from your synced transaction data and
          categorization choices. You are fully responsible for reviewing, verifying, and
          approving all values before filing. This is not tax advice. When in doubt, consult
          a licensed tax professional.
        </p>
      </div>

      {/* Section 2 — Pre-Fill Review Panel */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-bg-tertiary/40 rounded w-48 mb-4" />
              <div className="space-y-3">
                <div className="h-3 bg-bg-tertiary/40 rounded w-full" />
                <div className="h-3 bg-bg-tertiary/40 rounded w-3/4" />
                <div className="h-3 bg-bg-tertiary/40 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : data ? (
        <>
          <PreFillReviewPanel
            data={data}
            se={se}
            overrides={overrides}
            onOverrideSave={handleOverrideSave}
          />

          {/* Section 3 — Filing Path Selector */}
          <FilingPathSelector
            data={data}
            se={se}
            overrides={overrides}
            taxYear={year}
            filingType={filingType}
            personalFilingStatus={personalFilingStatus}
            onDownloadRequest={handleDownloadRequest}
          />

          {/* Section 4 — E-Filing Vendor List */}
          <VendorList />
        </>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-mono-light">Could not load tax data. Please try again.</p>
        </div>
      )}

      {/* Disclaimer Modal */}
      <DisclaimerModal
        open={disclaimerOpen}
        onClose={() => setDisclaimerOpen(false)}
        onConfirm={handleDisclaimerConfirm}
        exportType={disclaimerExportType}
        taxYear={year}
        hasOverrides={overrides.length > 0}
      />
    </div>
  );
}
