"use client";

import { useState, useEffect } from "react";
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

  const [taxSettings] = useState<TaxYearSetting[]>(initialTaxSettings);

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

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div>
          <div
            role="heading"
            aria-level={1}
            className="text-[32px] leading-tight font-sans font-normal text-mono-dark"
          >
            Org Profile
          </div>
          <p className="text-base text-mono-medium mt-1 font-sans">
            Tax settings and history
          </p>
        </div>
        <PreferencesTabs tabs={PREF_TABS} />
      </div>

      {/* Tax Rates have moved to Automations → Notifications */}
    </div>
  );
}
