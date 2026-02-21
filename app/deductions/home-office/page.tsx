"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getStickyTaxYearClient } from "@/lib/tax-year-cookie";

const RATE_PER_SQ_FT = 5;
const MAX_SQ_FT = 300;
const DEFAULT_TAX_RATE = 0.24;

const STANDARD_DEDUCTION = {
  single: 14_600,
  married_joint: 29_200,
  married_separate: 14_600,
  head_of_household: 21_900,
};

type FilingStatus = keyof typeof STANDARD_DEDUCTION;

const INPUT_CLS =
  "w-full border border-bg-tertiary rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-1 focus:ring-accent-sage/30 outline-none tabular-nums";

export default function HomeOfficePage() {
  const router = useRouter();
  const [deductionType, setDeductionType] = useState<"standard" | "itemized">("itemized");
  const [filingStatus, setFilingStatus] = useState<FilingStatus>("single");
  const [method, setMethod] = useState<"simplified" | "regular">("simplified");
  const [squareFeet, setSquareFeet] = useState(150);
  const [saving, setSaving] = useState(false);

  // Regular method inputs
  const [homeValue, setHomeValue] = useState("");
  const [businessPct, setBusinessPct] = useState("15");
  const [utilities, setUtilities] = useState("");
  const [insurance, setInsurance] = useState("");
  const [repairs, setRepairs] = useState("");

  const simplifiedDeduction = Math.min(squareFeet, MAX_SQ_FT) * RATE_PER_SQ_FT;

  const pct = (parseFloat(businessPct) || 0) / 100;
  const regularHomeDeduction = (parseFloat(homeValue) || 0) * pct;
  const regularUtilities = (parseFloat(utilities) || 0) * pct;
  const regularInsurance = (parseFloat(insurance) || 0) * pct;
  const regularRepairs = parseFloat(repairs) || 0;
  const regularDeduction = regularHomeDeduction + regularUtilities + regularInsurance + regularRepairs;

  const activeDeduction = method === "simplified" ? simplifiedDeduction : regularDeduction;
  const taxSavings = activeDeduction * DEFAULT_TAX_RATE;

  async function handleAdd() {
    const amount =
      deductionType === "standard" ? STANDARD_DEDUCTION[filingStatus] : activeDeduction;
    if (amount <= 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/deductions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "home_office",
          tax_year: getStickyTaxYearClient(),
          amount,
          tax_savings: amount * DEFAULT_TAX_RATE,
          metadata: {
            deduction_type: deductionType,
            ...(deductionType === "standard"
              ? { filing_status: filingStatus }
              : method === "simplified"
              ? { method, square_feet: squareFeet }
              : {
                  method,
                  home_value: parseFloat(homeValue) || 0,
                  business_pct: parseFloat(businessPct) || 0,
                  utilities: parseFloat(utilities) || 0,
                  insurance: parseFloat(insurance) || 0,
                  repairs: parseFloat(repairs) || 0,
                }),
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      router.push("/dashboard");
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h1 className="text-3xl text-mono-dark mb-2">Home Office Deduction</h1>
        <p className="text-mono-medium text-sm">
          Choose between the standard deduction or itemized home office deduction
        </p>
      </div>

      <div className="card p-6 space-y-6">
        <div>
          <p className="text-sm font-medium text-mono-dark mb-3">Deduction Type</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDeductionType("standard")}
              className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                deductionType === "standard"
                  ? "border-accent-sage bg-accent-sage/5 text-accent-sage"
                  : "border-bg-tertiary bg-white text-mono-medium hover:border-accent-sage/40"
              }`}
            >
              Standard Deduction
            </button>
            <button
              type="button"
              onClick={() => setDeductionType("itemized")}
              className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                deductionType === "itemized"
                  ? "border-accent-sage bg-accent-sage/5 text-accent-sage"
                  : "border-bg-tertiary bg-white text-mono-medium hover:border-accent-sage/40"
              }`}
            >
              Itemized Deduction
            </button>
          </div>
        </div>

        {/* Standard Deduction */}
        {deductionType === "standard" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-bg-secondary border border-bg-tertiary/40 px-4 py-3">
              <p className="text-xs text-mono-medium">
                The standard deduction is a fixed amount that reduces your taxable income.
                You cannot claim the home office deduction if you take the standard deduction.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-mono-dark mb-2">Filing Status</label>
              <select
                value={filingStatus}
                onChange={(e) => setFilingStatus(e.target.value as FilingStatus)}
                className={INPUT_CLS}
              >
                <option value="single">Single</option>
                <option value="married_joint">Married Filing Jointly</option>
                <option value="married_separate">Married Filing Separately</option>
                <option value="head_of_household">Head of Household</option>
              </select>
            </div>

            <div className="bg-bg-secondary rounded-lg p-4">
              <p className="text-sm font-medium text-mono-dark">
                Standard Deduction: ${STANDARD_DEDUCTION[filingStatus].toLocaleString()}
              </p>
              <p className="text-sm text-mono-medium mt-1">
                Tax Savings at {(DEFAULT_TAX_RATE * 100).toFixed(0)}%: $
                {(STANDARD_DEDUCTION[filingStatus] * DEFAULT_TAX_RATE).toLocaleString()}
              </p>
            </div>

            <button onClick={handleAdd} disabled={saving} className="btn-primary">
              {saving ? "Saving..." : "Add to My Deductions"}
            </button>
          </div>
        )}

        {/* Itemized Deduction */}
        {deductionType === "itemized" && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-mono-dark mb-3">Home Office Method</p>
              <label className="flex items-start gap-3 mb-3 cursor-pointer">
                <input
                  type="radio"
                  name="method"
                  checked={method === "simplified"}
                  onChange={() => setMethod("simplified")}
                  className="mt-1"
                />
                <div>
                  <span className="font-medium text-mono-dark">
                    Simplified Method ($5/sq ft, max 300 sq ft)
                  </span>
                  <p className="text-sm text-mono-medium mt-0.5">
                    Easiest option -- no receipts needed
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="method"
                  checked={method === "regular"}
                  onChange={() => setMethod("regular")}
                  className="mt-1"
                />
                <div>
                  <span className="font-medium text-mono-dark">
                    Regular Method (actual expenses)
                  </span>
                  <p className="text-sm text-mono-medium mt-0.5">
                    Better for larger spaces or high expenses
                  </p>
                </div>
              </label>
            </div>

            {method === "simplified" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-mono-dark mb-2">
                    Square Footage of Home Office
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={MAX_SQ_FT}
                    value={squareFeet}
                    onChange={(e) =>
                      setSquareFeet(Math.min(MAX_SQ_FT, parseInt(e.target.value, 10) || 0))
                    }
                    className={INPUT_CLS}
                  />
                  <p className="text-xs text-mono-light mt-1">Max: {MAX_SQ_FT} sq ft</p>
                </div>

                <div className="bg-bg-secondary rounded-lg p-4">
                  <p className="text-sm font-medium text-mono-dark">
                    Your Deduction: ${simplifiedDeduction.toFixed(2)}
                  </p>
                  <p className="text-sm text-mono-medium mt-1">
                    Tax Savings at {(DEFAULT_TAX_RATE * 100).toFixed(0)}%: $
                    {(simplifiedDeduction * DEFAULT_TAX_RATE).toFixed(2)}
                  </p>
                </div>

                <button
                  onClick={handleAdd}
                  disabled={saving || simplifiedDeduction <= 0}
                  className="btn-primary"
                >
                  {saving ? "Saving..." : "Add to My Deductions"}
                </button>
              </>
            )}

            {method === "regular" && (
              <div className="space-y-5">
                <div className="rounded-lg bg-bg-secondary border border-bg-tertiary/40 px-4 py-3">
                  <p className="text-xs text-mono-medium">
                    Calculate your deduction based on your home value (or annual rent) and
                    the percentage used exclusively for business.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-mono-medium mb-1">
                      Annual Home Value / Rent
                    </label>
                    <input
                      type="number"
                      value={homeValue}
                      onChange={(e) => setHomeValue(e.target.value)}
                      placeholder="e.g. 24000 (annual rent) or home value"
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-mono-medium mb-1">
                      Business Use %
                    </label>
                    <input
                      type="number"
                      value={businessPct}
                      onChange={(e) => setBusinessPct(e.target.value)}
                      min={0}
                      max={100}
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-mono-medium mb-1">
                      Annual Utilities
                    </label>
                    <input
                      type="number"
                      value={utilities}
                      onChange={(e) => setUtilities(e.target.value)}
                      placeholder="e.g. 3600"
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-mono-medium mb-1">
                      Annual Insurance
                    </label>
                    <input
                      type="number"
                      value={insurance}
                      onChange={(e) => setInsurance(e.target.value)}
                      placeholder="e.g. 1200"
                      className={INPUT_CLS}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-mono-medium mb-1">
                      Office Repairs (100% deductible)
                    </label>
                    <input
                      type="number"
                      value={repairs}
                      onChange={(e) => setRepairs(e.target.value)}
                      placeholder="e.g. 500"
                      className={INPUT_CLS}
                    />
                  </div>
                </div>

                {regularDeduction > 0 && (
                  <div className="bg-bg-secondary rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-xs text-mono-medium">
                      <span>Home/Rent x {businessPct}%</span>
                      <span className="tabular-nums">${regularHomeDeduction.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-mono-medium">
                      <span>Utilities x {businessPct}%</span>
                      <span className="tabular-nums">${regularUtilities.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-mono-medium">
                      <span>Insurance x {businessPct}%</span>
                      <span className="tabular-nums">${regularInsurance.toFixed(2)}</span>
                    </div>
                    {regularRepairs > 0 && (
                      <div className="flex justify-between text-xs text-mono-medium">
                        <span>Repairs (100%)</span>
                        <span className="tabular-nums">${regularRepairs.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-medium text-mono-dark border-t border-bg-tertiary/30 pt-2 mt-2">
                      <span>Total Deduction</span>
                      <span className="tabular-nums">${regularDeduction.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-mono-light">
                      Saves ~${(regularDeduction * DEFAULT_TAX_RATE).toFixed(2)} at {(DEFAULT_TAX_RATE * 100).toFixed(0)}%
                    </p>
                  </div>
                )}

                <button
                  onClick={handleAdd}
                  disabled={saving || regularDeduction <= 0}
                  className="btn-primary"
                >
                  {saving ? "Saving..." : "Add to My Deductions"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
