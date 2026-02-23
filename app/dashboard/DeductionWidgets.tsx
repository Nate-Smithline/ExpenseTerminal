"use client";

import { useState } from "react";
import { CurrencyInput } from "@/components/CurrencyInput";

interface DeductionWidgetsProps {
  currentYear: number;
  taxRate: number;
}

const INPUT_CLS =
  "w-full border border-bg-tertiary rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-1 focus:ring-accent-sage/30 outline-none tabular-nums";

export function DeductionWidgets({ currentYear, taxRate }: DeductionWidgetsProps) {
  const [qbiIncome, setQbiIncome] = useState(0);
  const [qbiSaving, setQbiSaving] = useState(false);
  const [qbiSaved, setQbiSaved] = useState(false);

  const [miles, setMiles] = useState("");
  const [mileageSaving, setMileageSaving] = useState(false);
  const [mileageSaved, setMileageSaved] = useState(false);

  const [sqFt, setSqFt] = useState("150");
  const [officeSaving, setOfficeSaving] = useState(false);
  const [officeSaved, setOfficeSaved] = useState(false);

  const [healthPremium, setHealthPremium] = useState(0);
  const [healthSaving, setHealthSaving] = useState(false);
  const [healthSaved, setHealthSaved] = useState(false);

  const [retirementContrib, setRetirementContrib] = useState(0);
  const [retirementSaving, setRetirementSaving] = useState(false);
  const [retirementSaved, setRetirementSaved] = useState(false);

  const [eduExpense, setEduExpense] = useState(0);
  const [eduSaving, setEduSaving] = useState(false);
  const [eduSaved, setEduSaved] = useState(false);

  const [phoneBill, setPhoneBill] = useState(0);
  const [phonePct, setPhonePct] = useState("50");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);

  const [vehicleExpense, setVehicleExpense] = useState(0);
  const [vehiclePct, setVehiclePct] = useState("50");
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [vehicleSaved, setVehicleSaved] = useState(false);

  const qbiAmount = qbiIncome > 0 ? qbiIncome * 0.2 : 0;
  const mileageRate = 0.7;
  const mileageAmount = parseFloat(miles) > 0 ? parseFloat(miles) * mileageRate : 0;
  const officeAmount = Math.min(parseFloat(sqFt) || 0, 300) * 5;
  const healthAmount = healthPremium > 0 ? healthPremium : 0;
  const retirementAmount = retirementContrib > 0 ? retirementContrib : 0;
  const eduAmount = eduExpense > 0 ? eduExpense : 0;
  const phoneAmount = phoneBill > 0 ? (phoneBill * (parseFloat(phonePct) || 0)) / 100 : 0;
  const vehicleAmount = vehicleExpense > 0 ? (vehicleExpense * (parseFloat(vehiclePct) || 0)) / 100 : 0;

  async function saveDeduction(
    type: string,
    amount: number,
    setSavingFn: (v: boolean) => void,
    setSavedFn: (v: boolean) => void
  ) {
    if (amount <= 0) return;
    setSavingFn(true);
    const taxSavings = amount * taxRate;

    await fetch("/api/deductions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        tax_year: currentYear,
        amount: amount.toFixed(2),
        tax_savings: taxSavings.toFixed(2),
      }),
    });

    setSavingFn(false);
    setSavedFn(true);
    setTimeout(() => setSavedFn(false), 3000);
  }

  function ResultBox({ amount }: { amount: number }) {
    if (amount <= 0) return null;
    return (
      <div className="bg-bg-secondary rounded-lg p-3">
        <p className="text-sm font-medium text-mono-dark tabular-nums">
          ${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} deduction
        </p>
        <p className="text-xs text-mono-light">
          Saves ~${(amount * taxRate).toFixed(2)} at {(taxRate * 100).toFixed(0)}%
        </p>
      </div>
    );
  }

  function SaveBtn({
    onClick,
    disabled,
    saving,
    saved,
    label,
  }: {
    onClick: () => void;
    disabled: boolean;
    saving: boolean;
    saved: boolean;
    label: string;
  }) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className="btn-primary w-full disabled:opacity-40 text-sm"
      >
        {saving ? "Saving..." : saved ? "Saved!" : label}
      </button>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-mono-dark">Deduction Calculators</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* QBI */}
        <div className="card p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-mono-dark">QBI Deduction</h3>
            <p className="text-xs text-mono-light mt-0.5">20% of qualified business income</p>
          </div>
          <div>
            <label className="text-xs font-medium text-mono-medium block mb-1">Net Business Income</label>
            <CurrencyInput value={qbiIncome} onChange={setQbiIncome} min={0} placeholder="e.g. 80,000" className={INPUT_CLS} />
          </div>
          <ResultBox amount={qbiAmount} />
          <SaveBtn onClick={() => saveDeduction("qbi", qbiAmount, setQbiSaving, setQbiSaved)} disabled={qbiSaving || qbiAmount <= 0} saving={qbiSaving} saved={qbiSaved} label="Save QBI Deduction" />
        </div>

        {/* Mileage */}
        <div className="card p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-mono-dark">Mileage</h3>
            <p className="text-xs text-mono-light mt-0.5">${mileageRate.toFixed(2)}/mile (2026 IRS rate)</p>
          </div>
          <div>
            <label className="text-xs font-medium text-mono-medium block mb-1">Business Miles</label>
            <input type="number" value={miles} onChange={(e) => setMiles(e.target.value)} placeholder="e.g. 5000" className={INPUT_CLS} />
          </div>
          <ResultBox amount={mileageAmount} />
          <SaveBtn onClick={() => saveDeduction("mileage", mileageAmount, setMileageSaving, setMileageSaved)} disabled={mileageSaving || mileageAmount <= 0} saving={mileageSaving} saved={mileageSaved} label="Save Mileage Deduction" />
        </div>

        {/* Home Office */}
        <div className="card p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-mono-dark">Home Office</h3>
            <p className="text-xs text-mono-light mt-0.5">$5/sq ft, max 300 sq ft (simplified)</p>
          </div>
          <div>
            <label className="text-xs font-medium text-mono-medium block mb-1">Square Feet</label>
            <input type="number" value={sqFt} onChange={(e) => setSqFt(e.target.value)} placeholder="150" max={300} className={INPUT_CLS} />
          </div>
          <ResultBox amount={officeAmount} />
          <SaveBtn onClick={() => saveDeduction("home_office", officeAmount, setOfficeSaving, setOfficeSaved)} disabled={officeSaving || officeAmount <= 0} saving={officeSaving} saved={officeSaved} label="Save Home Office Deduction" />
        </div>

        {/* Health Insurance */}
        <div className="card p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-mono-dark">Health Insurance</h3>
            <p className="text-xs text-mono-light mt-0.5">Self-employed health insurance premiums</p>
          </div>
          <div>
            <label className="text-xs font-medium text-mono-medium block mb-1">Annual Premiums Paid</label>
            <CurrencyInput value={healthPremium} onChange={setHealthPremium} min={0} placeholder="e.g. 6,000" className={INPUT_CLS} />
          </div>
          <ResultBox amount={healthAmount} />
          <SaveBtn onClick={() => saveDeduction("health_insurance", healthAmount, setHealthSaving, setHealthSaved)} disabled={healthSaving || healthAmount <= 0} saving={healthSaving} saved={healthSaved} label="Save Health Insurance" />
        </div>

        {/* Retirement */}
        <div className="card p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-mono-dark">Retirement</h3>
            <p className="text-xs text-mono-light mt-0.5">Solo 401k, SEP-IRA, SIMPLE IRA</p>
          </div>
          <div>
            <label className="text-xs font-medium text-mono-medium block mb-1">Annual Contribution</label>
            <CurrencyInput value={retirementContrib} onChange={setRetirementContrib} min={0} placeholder="e.g. 20,000" className={INPUT_CLS} />
          </div>
          <ResultBox amount={retirementAmount} />
          <SaveBtn onClick={() => saveDeduction("retirement", retirementAmount, setRetirementSaving, setRetirementSaved)} disabled={retirementSaving || retirementAmount <= 0} saving={retirementSaving} saved={retirementSaved} label="Save Retirement Deduction" />
        </div>

        {/* Education */}
        <div className="card p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-mono-dark">Education</h3>
            <p className="text-xs text-mono-light mt-0.5">Business-related courses & training</p>
          </div>
          <div>
            <label className="text-xs font-medium text-mono-medium block mb-1">Education Expenses</label>
            <CurrencyInput value={eduExpense} onChange={setEduExpense} min={0} placeholder="e.g. 2,000" className={INPUT_CLS} />
          </div>
          <ResultBox amount={eduAmount} />
          <SaveBtn onClick={() => saveDeduction("education", eduAmount, setEduSaving, setEduSaved)} disabled={eduSaving || eduAmount <= 0} saving={eduSaving} saved={eduSaved} label="Save Education Deduction" />
        </div>

        {/* Phone & Internet */}
        <div className="card p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-mono-dark">Phone & Internet</h3>
            <p className="text-xs text-mono-light mt-0.5">Business-use percentage of bills</p>
          </div>
          <div>
            <label className="text-xs font-medium text-mono-medium block mb-1">Annual Bill Total</label>
            <CurrencyInput value={phoneBill} onChange={setPhoneBill} min={0} placeholder="e.g. 2,400" className={INPUT_CLS} />
          </div>
          <div>
            <label className="text-xs font-medium text-mono-medium block mb-1">Business Use %</label>
            <input type="number" value={phonePct} onChange={(e) => setPhonePct(e.target.value)} min={0} max={100} className={INPUT_CLS} />
          </div>
          <ResultBox amount={phoneAmount} />
          <SaveBtn onClick={() => saveDeduction("phone_internet", phoneAmount, setPhoneSaving, setPhoneSaved)} disabled={phoneSaving || phoneAmount <= 0} saving={phoneSaving} saved={phoneSaved} label="Save Phone & Internet" />
        </div>

        {/* Vehicle Expenses */}
        <div className="card p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-mono-dark">Vehicle Expenses</h3>
            <p className="text-xs text-mono-light mt-0.5">Actual expenses method (gas, repairs, insurance)</p>
          </div>
          <div>
            <label className="text-xs font-medium text-mono-medium block mb-1">Total Vehicle Costs</label>
            <CurrencyInput value={vehicleExpense} onChange={setVehicleExpense} min={0} placeholder="e.g. 8,000" className={INPUT_CLS} />
          </div>
          <div>
            <label className="text-xs font-medium text-mono-medium block mb-1">Business Use %</label>
            <input type="number" value={vehiclePct} onChange={(e) => setVehiclePct(e.target.value)} min={0} max={100} className={INPUT_CLS} />
          </div>
          <ResultBox amount={vehicleAmount} />
          <SaveBtn onClick={() => saveDeduction("vehicle_expenses", vehicleAmount, setVehicleSaving, setVehicleSaved)} disabled={vehicleSaving || vehicleAmount <= 0} saving={vehicleSaving} saved={vehicleSaved} label="Save Vehicle Expenses" />
        </div>
      </div>
    </div>
  );
}
