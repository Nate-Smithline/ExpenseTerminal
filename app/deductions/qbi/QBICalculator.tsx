"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CurrencyInput } from "@/components/CurrencyInput";
import {
  calculateQbiDeduction,
  type FilingStatus,
} from "@/lib/tax/qbi";

const INPUT_CLS =
  "w-full border border-bg-tertiary rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-1 focus:ring-accent-sage/30 outline-none tabular-nums";

const FILING_OPTIONS: { value: FilingStatus; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "married_filing_joint", label: "Married filing jointly" },
  { value: "married_filing_separate", label: "Married filing separately" },
  { value: "head_of_household", label: "Head of household" },
];

type Props = {
  totalIncome: number;
  currentYear: number;
  taxRate: number;
};

export function QBICalculator({ totalIncome, currentYear, taxRate }: Props) {
  const router = useRouter();
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [incomeSaving, setIncomeSaving] = useState(false);
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const [incomeSuccess, setIncomeSuccess] = useState<string | null>(null);
  const [deductionSaving, setDeductionSaving] = useState(false);
  const [deductionSaved, setDeductionSaved] = useState(false);
  const [deductionError, setDeductionError] = useState<string | null>(null);
  const [deductionClearing, setDeductionClearing] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);

  // QBI calculation inputs (QBI from total income; taxable income defaults to totalIncome when 0)
  const [filingStatus, setFilingStatus] = useState<FilingStatus>("single");
  const [taxableIncomePreQbi, setTaxableIncomePreQbi] = useState(0);
  const [w2Wages, setW2Wages] = useState(0);
  const [qualifiedPropertyUbia, setQualifiedPropertyUbia] = useState(0);
  const [isSstb, setIsSstb] = useState(false);

  // Prefill from saved deduction metadata when present
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/deductions?tax_year=${currentYear}`);
      if (!res.ok || cancelled) return;
      const json = await res.json().catch(() => ({}));
      const list = json.data ?? [];
      const existing = list.find((d: { type: string }) => d.type === "qbi");
      const meta = (existing?.metadata ?? null) as Record<string, unknown> | null;
      if (!meta || cancelled) return;
      if (typeof meta.filing_status === "string" && FILING_OPTIONS.some((o) => o.value === meta.filing_status)) {
        setFilingStatus(meta.filing_status as FilingStatus);
      }
      if (typeof meta.taxable_income_pre_qbi === "number" && meta.taxable_income_pre_qbi >= 0) {
        setTaxableIncomePreQbi(meta.taxable_income_pre_qbi);
      }
      if (typeof meta.w2_wages === "number" && meta.w2_wages >= 0) setW2Wages(meta.w2_wages);
      if (typeof meta.qualified_property_ubia === "number" && meta.qualified_property_ubia >= 0) {
        setQualifiedPropertyUbia(meta.qualified_property_ubia);
      }
      if (typeof meta.is_sstb === "boolean") setIsSstb(meta.is_sstb);
    })();
    return () => { cancelled = true; };
  }, [currentYear]);

  // Effective taxable income: user entry or total income
  const qbiAmount = totalIncome > 0 ? totalIncome : 0;
  const effectiveTaxable =
    taxableIncomePreQbi > 0 ? taxableIncomePreQbi : (totalIncome > 0 ? totalIncome : 0);

  const result = useMemo(
    () =>
      calculateQbiDeduction({
        taxYear: currentYear,
        filingStatus,
        qbiAmount,
        taxableIncomePreQbi: effectiveTaxable,
        w2Wages,
        qualifiedPropertyUbia,
        isSstb,
      }),
    [
      currentYear,
      filingStatus,
      qbiAmount,
      effectiveTaxable,
      w2Wages,
      qualifiedPropertyUbia,
      isSstb,
    ]
  );

  const taxSavings = result.deduction * taxRate;

  async function handleAddIncome(e: React.FormEvent) {
    e.preventDefault();
    setIncomeSaving(true);
    setIncomeError(null);
    setIncomeSuccess(null);
    if (!amount || amount <= 0) {
      setIncomeError("Please enter a valid amount greater than 0");
      setIncomeSaving(false);
      return;
    }
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          vendor: vendor.trim(),
          amount,
          description: description.trim() || undefined,
          transaction_type: "income",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }
      setIncomeSuccess(`$${amount.toFixed(2)} income added. Updating total…`);
      setVendor("");
      setAmount(0);
      setDescription("");
      setShowAddIncome(false);
      router.refresh();
      setTimeout(() => setIncomeSuccess(null), 4000);
    } catch (err) {
      setIncomeError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIncomeSaving(false);
    }
  }

  async function handleSaveDeduction() {
    if (result.deduction <= 0) return;
    setDeductionSaving(true);
    setDeductionError(null);
    try {
      const res = await fetch("/api/deductions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "qbi",
          tax_year: currentYear,
          amount: Math.round(result.deduction * 100) / 100,
          tax_savings: Math.round(taxSavings * 100) / 100,
          metadata: {
            filing_status: filingStatus,
            taxable_income_pre_qbi: effectiveTaxable,
            w2_wages: w2Wages,
            qualified_property_ubia: qualifiedPropertyUbia,
            is_sstb: isSstb,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to save deduction");
      }
      setDeductionSaved(true);
      setTimeout(() => setDeductionSaved(false), 3000);
      setToast({ message: `QBI deduction added for ${currentYear}`, kind: "success" });
      setTimeout(() => setToast(null), 4000);
      router.refresh();
    } catch (err) {
      setDeductionError(err instanceof Error ? err.message : "Something went wrong");
      setToast({ message: "Failed to save deduction", kind: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setDeductionSaving(false);
    }
  }

  async function handleClearDeduction() {
    if (!confirm(`Remove QBI deduction for ${currentYear}? This cannot be undone.`)) return;
    setDeductionClearing(true);
    setToast(null);
    try {
      const res = await fetch("/api/deductions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "qbi", tax_year: currentYear }),
      });
      if (!res.ok) throw new Error("Failed to clear");
      setToast({ message: `QBI deduction cleared for ${currentYear}`, kind: "success" });
      setTimeout(() => setToast(null), 4000);
      router.refresh();
    } catch {
      setToast({ message: "Failed to clear deduction", kind: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setDeductionClearing(false);
    }
  }

  return (
    <div className="card p-6 space-y-6">
      {/* Income from database */}
      <div>
        <p className="text-sm font-medium text-mono-dark mb-1">
          Qualified business income ({currentYear}, from your records)
        </p>
        <p className="text-2xl font-bold text-mono-dark tabular-nums">
          $
          {totalIncome.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        {totalIncome === 0 ? (
          <p className="text-sm text-mono-medium mt-1">
            No income logged yet. Add income below to calculate your QBI deduction.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddIncome((v) => !v)}
            className="text-sm text-accent-sage hover:underline mt-2"
          >
            {showAddIncome ? "Cancel" : "Add or update income"}
          </button>
        )}
      </div>

      {/* Add income form */}
      {(showAddIncome || totalIncome === 0) && (
        <form
          onSubmit={handleAddIncome}
          className="space-y-4 border-t border-bg-tertiary/40 pt-3"
        >
          <p className="text-sm font-medium text-mono-dark">
            Log income (saves to your income records)
          </p>
          <div>
            <label className="block text-xs font-medium text-mono-medium mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-mono-medium mb-1">
              Source (e.g. client, payment)
            </label>
            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="e.g. Acme Corp"
              className={INPUT_CLS}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-mono-medium mb-1">Amount ($)</label>
            <CurrencyInput
              value={amount}
              onChange={setAmount}
              min={0}
              placeholder="0.00"
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-mono-medium mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Project payment Q1"
              className={INPUT_CLS}
            />
          </div>
          {incomeError && <p className="text-sm text-danger">{incomeError}</p>}
          {incomeSuccess && (
            <p className="text-sm text-accent-sage font-medium">{incomeSuccess}</p>
          )}
          <button
            type="submit"
            disabled={incomeSaving || !vendor.trim() || amount <= 0}
            className="btn-primary text-sm"
          >
            {incomeSaving ? "Saving…" : "Add income"}
          </button>
        </form>
      )}

      {/* QBI inputs: filing status, taxable income, W-2, UBIA, SSTB */}
      {(totalIncome > 0 || taxableIncomePreQbi > 0) && (
        <div className="space-y-4 border-t border-bg-tertiary/40 pt-3">
          <p className="text-sm font-medium text-mono-dark">
            Income limits &amp; W-2 / property
          </p>
          <div>
            <label className="block text-xs font-medium text-mono-medium mb-1">
              Filing status
            </label>
            <select
              value={filingStatus}
              onChange={(e) => setFilingStatus(e.target.value as FilingStatus)}
              className={INPUT_CLS}
            >
              {FILING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-mono-medium mb-1">
              Taxable income before QBI deduction ($)
            </label>
            <CurrencyInput
              value={taxableIncomePreQbi}
              onChange={setTaxableIncomePreQbi}
              min={0}
              placeholder={totalIncome > 0 ? String(totalIncome) : "0"}
              className={INPUT_CLS}
            />
            <p className="text-xs text-mono-light mt-1">
              Total income (including from other sources). If this goes up, your QBI deduction may
              be reduced or phased out.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-mono-medium mb-1">
              W-2 wages (from this business, $)
            </label>
            <CurrencyInput
              value={w2Wages}
              onChange={setW2Wages}
              min={0}
              placeholder="0"
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-mono-medium mb-1">
              Qualified property UBIA ($)
            </label>
            <CurrencyInput
              value={qualifiedPropertyUbia}
              onChange={setQualifiedPropertyUbia}
              min={0}
              placeholder="0"
              className={INPUT_CLS}
            />
            <p className="text-xs text-mono-light mt-1">
              Unadjusted basis immediately after acquisition of qualified property used in the
              business.
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isSstb}
              onChange={(e) => setIsSstb(e.target.checked)}
              className="rounded border-bg-tertiary"
            />
            <span className="text-sm text-mono-dark">
              Specified service trade or business (e.g. health, law, accounting, consulting)
            </span>
          </label>
        </div>
      )}

      {/* QBI result */}
      <div className="border-t border-bg-tertiary/40 pt-3 space-y-3">
        <p className="text-sm font-medium text-mono-dark">QBI deduction (Section 199A)</p>
        <p className="text-2xl font-bold text-accent-sage tabular-nums">
          $
          {result.deduction.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        {result.deduction > 0 && (
          <p className="text-sm text-mono-medium">
            Est. tax savings at {(taxRate * 100).toFixed(0)}%: $
            {taxSavings.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        )}
        {result.explanation && (
          <p className="text-sm text-mono-medium">{result.explanation}</p>
        )}
        {(result.cappedByTaxable ||
          result.cappedByW2Limit ||
          result.phaseoutApplied ||
          result.fullyDisallowed) && (
          <p className="text-xs text-mono-light">
            {result.fullyDisallowed
              ? "Deduction not allowed above the income limit for this business type."
              : "Limits applied. Add W-2 wages or qualified property, or lower taxable income, to potentially increase the deduction."}
          </p>
        )}
        {deductionError && <p className="text-sm text-danger">{deductionError}</p>}
        <div className="flex flex-wrap gap-3 pt-1">
          <button
            type="button"
            onClick={handleSaveDeduction}
            disabled={deductionSaving || result.deduction <= 0}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {deductionSaving ? "Saving…" : deductionSaved ? "Saved" : "Save QBI deduction"}
          </button>
          <button
            type="button"
            onClick={handleClearDeduction}
            disabled={deductionClearing}
            className="rounded-full border border-bg-tertiary/60 px-4 py-2 text-sm font-medium text-mono-medium hover:bg-bg-tertiary/40 transition disabled:opacity-50"
          >
            {deductionClearing ? "Clearing…" : "Clear deduction"}
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-lg px-4 py-2.5 text-sm shadow-lg ${
            toast.kind === "success" ? "bg-accent-sage text-white" : "bg-accent-red/90 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
