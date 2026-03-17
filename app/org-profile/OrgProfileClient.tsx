"use client";

import { useState } from "react";
import type { Database } from "@/lib/types/database";
import { PreferencesTabs } from "@/app/preferences/PreferencesTabs";

type OrgSettings = Database["public"]["Tables"]["org_settings"]["Row"];
type TaxYearSetting = Database["public"]["Tables"]["tax_year_settings"]["Row"];

const FILING_TYPES = [
  { value: "sole_prop", label: "Sole Proprietorship" },
  { value: "llc", label: "LLC (Single Member)" },
  { value: "llc_multi", label: "LLC (Multi Member)" },
  { value: "s_corp", label: "S-Corporation" },
  { value: "c_corp", label: "C-Corporation" },
  { value: "partnership", label: "Partnership" },
];

function filingLabel(value: string | null | undefined): string {
  return FILING_TYPES.find((t) => t.value === value)?.label ?? "Not set";
}

const PREF_TABS = [
  { href: "/preferences/automations", label: "Automations" },
  { href: "/preferences/profile", label: "Profile" },
  { href: "/preferences/billing", label: "Billing" },
  { href: "/preferences/org", label: "Org" },
] as const;

export function OrgProfileClient({
  initialOrg,
  initialTaxSettings,
  userEmail,
}: {
  initialOrg: OrgSettings | null;
  initialTaxSettings: TaxYearSetting[];
  userEmail: string | null;
}) {
  const [org, setOrg] = useState(initialOrg);
  const [editing, setEditing] = useState(false);
  const [businessName, setBusinessName] = useState(org?.business_name ?? "");
  const [businessAddress, setBusinessAddress] = useState(org?.business_address ?? "");
  const [filingType, setFilingType] = useState(org?.filing_type ?? "sole_prop");
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgSaved, setOrgSaved] = useState(false);

  const [taxSettings, setTaxSettings] = useState<TaxYearSetting[]>(initialTaxSettings);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newRate, setNewRate] = useState("24");
  const [savingTax, setSavingTax] = useState(false);

  async function handleSaveOrg() {
    setSavingOrg(true);
    const res = await fetch("/api/org-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business_name: businessName,
        business_address: businessAddress,
        filing_type: filingType,
      }),
    });
    if (res.ok) {
      const { data } = await res.json();
      setOrg(data);
      setEditing(false);
      setOrgSaved(true);
      setTimeout(() => setOrgSaved(false), 3000);
    }
    setSavingOrg(false);
  }

  async function handleAddTaxYear() {
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate < 0 || rate > 100) return;
    setSavingTax(true);

    const res = await fetch("/api/tax-year-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tax_year: newYear, tax_rate: rate / 100 }),
    });

    if (res.ok) {
      const { data } = await res.json();
      setTaxSettings((prev) => {
        const filtered = prev.filter((s) => s.tax_year !== newYear);
        return [data, ...filtered].sort((a, b) => b.tax_year - a.tax_year);
      });
    }
    setSavingTax(false);
  }

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl text-mono-dark">Org Profile</h1>
          <p className="text-sm text-mono-medium mt-1">
            Business information and tax settings
          </p>
        </div>
        <PreferencesTabs tabs={PREF_TABS} />
      </div>

      {/* Business Information — view / edit */}
      <div className="card p-6 space-y-6">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold text-mono-dark">Business Information</h2>
          {!editing && (
            <button onClick={() => setEditing(true)} className="btn-secondary text-sm px-5 py-2">
              Edit
            </button>
          )}
        </div>

        {!editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-semibold text-mono-dark">Business Name</p>
                <p className="text-sm text-mono-medium">{org?.business_name || "Not set"}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-mono-dark">Filing Type</p>
                <p className="text-sm text-mono-medium">{filingLabel(org?.filing_type)}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm font-semibold text-mono-dark">Business Address</p>
                <p className="text-sm text-mono-medium">{org?.business_address || "Not set"}</p>
              </div>
            </div>

            {orgSaved && <p className="text-xs text-accent-sage font-medium">Saved!</p>}

            {/* Tax Rates inline */}
            <div className="border-t border-bg-tertiary/30 pt-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-mono-dark">Tax Rates</p>
                <p className="text-xs text-mono-light mt-0.5">
                  Custom rate per year overrides the default 24%.
                </p>
              </div>

              {taxSettings.length > 0 && (
                <div className="border border-bg-tertiary/60 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-bg-secondary text-mono-light">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Tax Year</th>
                        <th className="text-right px-4 py-2 font-medium">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taxSettings.map((s) => (
                        <tr key={s.id} className="border-t border-bg-tertiary/40">
                          <td className="px-4 py-2.5 font-medium">{s.tax_year}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {(Number(s.tax_rate) * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-end gap-3">
                <div>
                  <label className="text-xs font-medium text-mono-medium block mb-1">Year</label>
                  <select
                    value={newYear}
                    onChange={(e) => setNewYear(parseInt(e.target.value, 10))}
                    className="border border-bg-tertiary rounded-full px-3 py-2 text-sm bg-white focus:ring-1 focus:ring-accent-sage/30 outline-none"
                  >
                    {[0, 1, 2].map((offset) => {
                      const y = new Date().getFullYear() - offset;
                      return <option key={y} value={y}>{y}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-mono-medium block mb-1">Rate (%)</label>
                  <input
                    type="number"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    min={0}
                    max={100}
                    step={0.1}
                    className="w-24 border border-bg-tertiary rounded-full px-3 py-2 text-sm bg-white focus:ring-1 focus:ring-accent-sage/30 outline-none tabular-nums"
                  />
                </div>
                <button onClick={handleAddTaxYear} disabled={savingTax} className="btn-primary disabled:opacity-40">
                  {savingTax ? "Saving..." : "Set Rate"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-mono-medium block mb-1">Business Name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Your business name"
                  className="w-full border border-bg-tertiary/60 rounded-xl px-4 py-3 text-sm bg-white focus:border-accent-sage/40 outline-none transition-all"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-mono-medium block mb-1">Business Address</label>
                <input
                  type="text"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  placeholder="123 Main St, City, State ZIP"
                  className="w-full border border-bg-tertiary/60 rounded-xl px-4 py-3 text-sm bg-white focus:border-accent-sage/40 outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-mono-medium block mb-1">Filing Type</label>
                <select
                  value={filingType}
                  onChange={(e) => setFilingType(e.target.value)}
                  className="w-full border border-bg-tertiary/60 rounded-xl px-4 py-3 text-sm bg-white focus:border-accent-sage/40 outline-none transition-all"
                >
                  {FILING_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleSaveOrg} disabled={savingOrg} className="btn-warm">
                {savingOrg ? "Saving..." : "Save changes"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setBusinessName(org?.business_name ?? "");
                  setBusinessAddress(org?.business_address ?? "");
                  setFilingType(org?.filing_type ?? "sole_prop");
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
