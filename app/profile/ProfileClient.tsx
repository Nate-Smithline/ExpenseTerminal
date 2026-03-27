"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { formatUSPhone, parseUSPhone, displayUSPhone } from "@/lib/format-us-phone";
import { PreferencesTabs } from "@/app/preferences/PreferencesTabs";
import type { Database } from "@/lib/types/database";

const NAME_PREFIXES = [
  { value: "", label: "" },
  { value: "Mr.", label: "Mr." },
  { value: "Mrs.", label: "Mrs." },
  { value: "Ms.", label: "Ms." },
  { value: "Dr.", label: "Dr." },
  { value: "Prof.", label: "Prof." },
];

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name_prefix: string | null;
  email: string | null;
  phone: string | null;
  password_changed_at?: string | null;
}

type OrgSettings = Database["public"]["Tables"]["org_settings"]["Row"];

const FILING_TYPES = [
  { value: "sole_prop", label: "Sole Proprietorship" },
  { value: "llc", label: "LLC (Single Member)" },
  { value: "llc_multi", label: "LLC (Multi Member)" },
  { value: "s_corp", label: "S-Corporation" },
  { value: "c_corp", label: "C-Corporation" },
  { value: "partnership", label: "Partnership" },
] as const;

type FilingStatus = "single" | "married_filing_jointly";

const INCOME_BRACKETS: Record<FilingStatus, Array<{ id: string; label: string; taxRate: number }>> = {
  single: [
    { id: "single:0-11925", label: "$0 – $11,925 (10%)", taxRate: 0.1 },
    { id: "single:11926-48475", label: "$11,926 – $48,475 (12%)", taxRate: 0.12 },
    { id: "single:48476-103350", label: "$48,476 – $103,350 (22%)", taxRate: 0.22 },
    { id: "single:103351-197300", label: "$103,351 – $197,300 (24%)", taxRate: 0.24 },
    { id: "single:197301-250525", label: "$197,301 – $250,525 (32%)", taxRate: 0.32 },
    { id: "single:250526-626350", label: "$250,526 – $626,350 (35%)", taxRate: 0.35 },
    { id: "single:626351-plus", label: "$626,351+ (37%)", taxRate: 0.37 },
  ],
  married_filing_jointly: [
    { id: "joint:0-23850", label: "$0 – $23,850 (10%)", taxRate: 0.1 },
    { id: "joint:23851-96950", label: "$23,851 – $96,950 (12%)", taxRate: 0.12 },
    { id: "joint:96951-206700", label: "$96,951 – $206,700 (22%)", taxRate: 0.22 },
    { id: "joint:206701-394600", label: "$206,701 – $394,600 (24%)", taxRate: 0.24 },
    { id: "joint:394601-501050", label: "$394,601 – $501,050 (32%)", taxRate: 0.32 },
    { id: "joint:501051-752800", label: "$501,051 – $752,800 (35%)", taxRate: 0.35 },
    { id: "joint:752801-plus", label: "$752,801+ (37%)", taxRate: 0.37 },
  ],
};

const INDUSTRY_PRESETS = [
  "Consulting", "Acting", "Fitness", "Creator", "Rideshare",
  "Real Estate", "Delivery", "Freelance Dev", "Photography", "Music",
];

function filingLabel(value: string | null | undefined): string {
  return FILING_TYPES.find((t) => t.value === value)?.label ?? "Not set";
}

const PREF_TABS = [
  { href: "/preferences/automations", label: "Automations" },
  { href: "/preferences/profile", label: "Profile" },
] as const;

interface TaxYearSettings {
  id?: string;
  tax_year: number;
  tax_rate: string;
  expected_income_range: string | null;
}

export function ProfileClient({
  initialProfile,
  userEmail,
  initialOrg,
  initialTaxSettings,
  taxYear,
}: {
  initialProfile: Profile | null;
  userEmail: string | null;
  initialOrg: OrgSettings | null;
  initialTaxSettings?: TaxYearSettings | null;
  taxYear?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [prefix, setPrefix] = useState(profile?.name_prefix ?? "");
  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [phoneDisplay, setPhoneDisplay] = useState(displayUSPhone(profile?.phone ?? ""));
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  const [org, setOrg] = useState<OrgSettings | null>(initialOrg);
  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [orgName, setOrgName] = useState(org?.business_name ?? "");
  const [orgAddress1, setOrgAddress1] = useState("");
  const [orgAddress2, setOrgAddress2] = useState("");
  const [orgCity, setOrgCity] = useState("");
  const [orgState, setOrgState] = useState("");
  const [orgZip, setOrgZip] = useState("");
  const [orgFilingType, setOrgFilingType] = useState(org?.filing_type ?? "sole_prop");
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgSaved, setOrgSaved] = useState(false);

  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [savedTaxSettings, setSavedTaxSettings] = useState(initialTaxSettings ?? null);
  const [taxFilingStatus, setTaxFilingStatus] = useState<FilingStatus | null>(
    (initialOrg?.personal_filing_status as FilingStatus) ?? null
  );
  const [taxIncomeRange, setTaxIncomeRange] = useState<string | null>(
    initialTaxSettings?.expected_income_range ?? null
  );
  const [taxIndustry, setTaxIndustry] = useState(initialOrg?.business_industry ?? "");
  const [taxIndustryInput, setTaxIndustryInput] = useState(initialOrg?.business_industry ?? "");
  const [savingTax, setSavingTax] = useState(false);
  const prevTaxModalOpen = useRef(false);

  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    if (editModalOpen && profile) {
      setPrefix(profile.name_prefix ?? "");
      setFirstName(profile.first_name ?? "");
      setLastName(profile.last_name ?? "");
      setPhoneDisplay(displayUSPhone(profile.phone ?? ""));
    }
  }, [editModalOpen, profile]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setEditModalOpen(false);
        return;
      }
      if (pathname !== "/profile") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        e.stopPropagation();
        setEditModalOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [pathname]);

  useEffect(() => {
    setOrg(initialOrg);
    setOrgName(initialOrg?.business_name ?? "");
    // Prefer structured fields; fall back to legacy single-line address
    setOrgAddress1(initialOrg?.business_address_line1 ?? initialOrg?.business_address ?? "");
    setOrgAddress2(initialOrg?.business_address_line2 ?? "");
    setOrgCity(initialOrg?.business_city ?? "");
    setOrgState(initialOrg?.business_state ?? "");
    setOrgZip(initialOrg?.business_zip ?? "");
    setOrgFilingType(initialOrg?.filing_type ?? "sole_prop");
  }, [initialOrg]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOrgModalOpen(false);
    }
    if (orgModalOpen) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [orgModalOpen]);

  async function handleSaveProfile() {
    setSaving(true);
    setPasswordMsg(null);
    const phoneDigits = parseUSPhone(phoneDisplay);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        name_prefix: prefix.trim() || null,
        phone: phoneDigits.length === 10 ? phoneDigits : null,
      }),
    });
    if (res.ok) {
      const { data } = await res.json();
      setProfile(data);
      setEditModalOpen(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("profile-updated", { detail: data }));
      }
    }
    setSaving(false);
  }

  async function handlePasswordChange() {
    setPasswordMsg(null);
    if (!currentPassword) {
      setPasswordMsg({ type: "error", text: "Enter your current password." });
      return;
    }

    setPasswordSaving(true);
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword,
        password: newPassword,
      }),
    });
    const body = await res.json().catch(() => ({}));

    if (res.ok) {
      setCurrentPassword("");
      setNewPassword("");
      // Optimistically update last changed timestamp in local profile state
      const nowIso = new Date().toISOString();
      setProfile((prev) =>
        prev ? { ...prev, password_changed_at: nowIso } : prev,
      );
      setPasswordModalOpen(false);
    } else {
      setPasswordMsg({
        type: "error",
        text: (body as { error?: string }).error ?? "Failed to update password.",
      });
    }
    setPasswordSaving(false);
  }

  async function handleSaveOrg() {
    setSavingOrg(true);
    setOrgSaved(false);
    const line1 = orgAddress1.trim();
    const line2 = orgAddress2.trim();
    const city = orgCity.trim();
    const state = orgState.trim();
    const zip = orgZip.trim();

    const parts = [
      line1,
      line2,
      [city, state].filter(Boolean).join(" "),
      zip,
    ].filter(Boolean);
    const combinedAddress = parts.join(", ") || null;

    const res = await fetch("/api/org-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        business_name: orgName || null,
        business_address: combinedAddress,
        business_address_line1: line1 || null,
        business_address_line2: line2 || null,
        business_city: city || null,
        business_state: state || null,
        business_zip: zip || null,
        filing_type: orgFilingType || null,
      }),
    });

    if (!res.ok) {
      // Best-effort surface of any server error
      const body = await res.json().catch(() => null);
      console.error("Failed to save org settings", body);
      setSavingOrg(false);
      return;
    }

    const { data } = await res.json();
    setOrg(data);
    setOrgModalOpen(false);
    setOrgSaved(true);
    setTimeout(() => setOrgSaved(false), 3000);
    setSavingOrg(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setTaxModalOpen(false);
    }
    if (taxModalOpen) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [taxModalOpen]);

  useEffect(() => {
    const justOpened = taxModalOpen && !prevTaxModalOpen.current;
    prevTaxModalOpen.current = taxModalOpen;
    if (!justOpened) return;
    setTaxFilingStatus((org?.personal_filing_status as FilingStatus) ?? null);
    setTaxIncomeRange(savedTaxSettings?.expected_income_range ?? null);
    const ind = org?.business_industry ?? "";
    setTaxIndustry(ind);
    setTaxIndustryInput(ind);
  }, [taxModalOpen, org, savedTaxSettings]);

  async function handleSaveTax() {
    setSavingTax(true);

    const filingToSave = taxFilingStatus;
    const incomeToSave = taxIncomeRange;
    const industryToSave = taxIndustry.trim();

    const orgChanges: Record<string, unknown> = {};
    if (filingToSave) orgChanges.personal_filing_status = filingToSave;
    if (industryToSave) orgChanges.business_industry = industryToSave;

    let orgOk = true;
    if (Object.keys(orgChanges).length > 0) {
      const orgRes = await fetch("/api/org-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orgChanges),
      });
      if (orgRes.ok) {
        const body = await orgRes.json().catch(() => null);
        if (body?.data) setOrg(body.data);
      } else {
        orgOk = false;
      }
    }

    let taxOk = true;
    if (filingToSave && incomeToSave) {
      const bracket = INCOME_BRACKETS[filingToSave]?.find((b) => b.id === incomeToSave);
      if (bracket && taxYear) {
        const taxRes = await fetch("/api/tax-year-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tax_year: taxYear,
            tax_rate: bracket.taxRate,
            expected_income_range: bracket.id,
          }),
        });
        if (taxRes.ok) {
          setSavedTaxSettings((prev) => ({
            ...prev,
            tax_year: taxYear!,
            tax_rate: String(bracket.taxRate),
            expected_income_range: bracket.id,
          }));
        } else {
          taxOk = false;
        }
      }
    }

    setSavingTax(false);
    if (orgOk && taxOk) setTaxModalOpen(false);
  }

  async function handleLogout() {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = formatUSPhone(e.target.value);
    setPhoneDisplay(next);
  }

  const passwordStrong =
    newPassword.length >= 1;

  const displayName = [profile?.name_prefix, profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || "Not set";

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <div
            role="heading"
            aria-level={1}
            className="text-[32px] leading-tight font-sans font-normal text-mono-dark"
          >
            Profile
          </div>
          <p className="text-base text-mono-medium mt-1 font-sans">
            Manage your profile and password
          </p>
        </div>
        <PreferencesTabs tabs={PREF_TABS} />
      </div>

      {/* My Profile L1 */}
      <section className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7]">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <div
              role="heading"
              aria-level={2}
              className="text-base md:text-lg font-normal font-sans text-mono-dark"
            >
              My Profile
            </div>
            <p className="mt-1 text-xs text-mono-medium font-sans">
              Basic contact details for your account.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditModalOpen(true)}
            className="rounded-none bg-[#E8EEF5] px-4 py-2 text-sm font-medium font-sans text-mono-dark hover:opacity-80"
          >
            Edit
          </button>
        </div>
        <div className="px-4 py-3 space-y-2 text-xs font-sans text-mono-medium">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-semibold text-mono-dark min-w-[110px]">Name</span>
            <span className="truncate">{displayName}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-semibold text-mono-dark min-w-[110px]">Email</span>
            <span className="truncate">{userEmail || profile?.email || "Not set"}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-semibold text-mono-dark min-w-[110px]">Phone</span>
            <span className="truncate">
              {profile?.phone ? displayUSPhone(profile.phone) : "Not set"}
            </span>
          </div>
        </div>
      </section>

      {/* Organization Information card */}
      <section className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7]">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <div
              role="heading"
              aria-level={2}
              className="text-base md:text-lg font-normal font-sans text-mono-dark"
            >
              Organization Information
            </div>
            <p className="mt-1 text-xs text-mono-medium font-sans">
              Details that drive deductions and filings.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOrgModalOpen(true)}
            className="rounded-none bg-[#E8EEF5] px-4 py-2 text-sm font-medium font-sans text-mono-dark hover:opacity-80"
          >
            Edit
          </button>
        </div>
        <div className="px-4 py-3 space-y-2 text-xs font-sans text-mono-medium">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-semibold text-mono-dark min-w-[110px]">Name</span>
            <span className="truncate">
              {org?.business_name || "Not set"}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-semibold text-mono-dark min-w-[110px]">Type</span>
            <span className="truncate">
              {filingLabel(org?.filing_type)}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-semibold text-mono-dark min-w-[110px]">Address</span>
            <span className="truncate">
              {(() => {
                if (!org) return "Not set";
                const line1 = org.business_address_line1 ?? "";
                const line2 = org.business_address_line2 ?? "";
                const city = org.business_city ?? "";
                const state = org.business_state ?? "";
                const zip = org.business_zip ?? "";
                const parts = [
                  line1,
                  line2,
                  [city, state].filter(Boolean).join(" "),
                  zip,
                ].filter(Boolean);
                const formatted = parts.join(", ");
                return formatted || org.business_address || "Not set";
              })()}
            </span>
          </div>
        </div>
      </section>

      {/* Tax Settings card */}
      <section className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7]">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <div
              role="heading"
              aria-level={2}
              className="text-base md:text-lg font-normal font-sans text-mono-dark"
            >
              Tax Settings
            </div>
            <p className="mt-1 text-xs text-mono-medium font-sans">
              Filing status, expected income, and business industry.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTaxModalOpen(true)}
            className="rounded-none bg-[#E8EEF5] px-4 py-2 text-sm font-medium font-sans text-mono-dark hover:opacity-80"
          >
            Edit
          </button>
        </div>
        <div className="px-4 py-3 space-y-2 text-xs font-sans text-mono-medium">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-semibold text-mono-dark min-w-[110px]">Filing status</span>
            <span className="truncate">
              {org?.personal_filing_status === "single" ? "Single" : org?.personal_filing_status === "married_filing_jointly" ? "Jointly" : "Not set"}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-semibold text-mono-dark min-w-[110px]">Expected income</span>
            <span className="truncate">
              {(() => {
                const fs = org?.personal_filing_status as FilingStatus | null;
                const range = savedTaxSettings?.expected_income_range;
                if (!fs || !range) return "Not set";
                return INCOME_BRACKETS[fs]?.find((b) => b.id === range)?.label ?? range;
              })()}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-semibold text-mono-dark min-w-[110px]">Industry</span>
            <span className="truncate">{org?.business_industry || "Not set"}</span>
          </div>
        </div>
      </section>

      {/* Edit Profile Modal (matches organization + notification preferences styling) */}
      {editModalOpen && (
        <div
          className="fixed inset-0 min-h-[100dvh] z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-title"
        >
          <div className="rounded-none bg-white shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-white px-6 pt-6 pb-1 flex items-start">
              <h2
                id="edit-profile-title"
                className="text-xl text-mono-dark font-medium"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                Edit Profile
              </h2>
            </div>
            <div
              className="px-6 py-3 space-y-3"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const target = e.target as HTMLElement | null;
                const tag = target?.tagName;
                if (tag === "TEXTAREA") return;
                e.preventDefault();
                if (!saving) {
                  handleSaveProfile();
                }
              }}
            >
              <p className="text-xs text-mono-medium">
                Update your contact details used across your account.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-mono-medium mb-1">Prefix</label>
                  <select
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    className="w-full border px-4 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none border-bg-tertiary/60"
                  >
                    {NAME_PREFIXES.map((p) => (
                      <option key={p.value || "none"} value={p.value}>
                        {p.label || "—"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-mono-medium mb-1">First name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                      className="w-full border px-4 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none border-bg-tertiary/60"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-mono-medium mb-1">Last name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last name"
                      className="w-full border px-4 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none border-bg-tertiary/60"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-mono-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={userEmail || profile?.email || ""}
                    disabled
                    className="w-full border px-4 py-3 text-sm bg-[#F3F4F6] text-[#6B7280] rounded-none border-bg-tertiary/60"
                  />
                  <p className="text-xs text-[#6B7280] mt-1">
                    Contact expenseterminal@outlook.com to change your email.
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-mono-medium mb-1">Mobile number</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phoneDisplay}
                    onChange={handlePhoneChange}
                    placeholder="(123) 456-7890"
                    maxLength={14}
                    className="w-full border px-4 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none border-bg-tertiary/60"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 pt-2 pb-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2.5 text-sm font-medium font-sans bg-[#F0F1F7] text-mono-dark rounded-none hover:bg-[#E4E7F0] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={saving}
                className="px-4 py-2.5 text-sm font-medium font-sans bg-black text-white rounded-none hover:bg-black/85 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password L1 */}
      <section className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7]">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <div
              role="heading"
              aria-level={2}
              className="text-base md:text-lg font-normal font-sans text-mono-dark"
            >
              Change Password
            </div>
            <p className="mt-1 text-xs text-mono-medium font-sans">
              Last changed information for your account password.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPasswordModalOpen(true)}
            className="rounded-none bg-[#E8EEF5] px-4 py-2 text-sm font-medium font-sans text-mono-dark hover:opacity-80"
          >
            Edit
          </button>
        </div>
        <div className="px-4 py-3 text-xs font-sans text-mono-medium">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-semibold text-mono-dark min-w-[110px]">Last changed</span>
            <span className="truncate">
              {profile?.password_changed_at
                ? (() => {
                    const d = new Date(profile.password_changed_at);
                    const datePart = d.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    });
                    const timePart = d.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    });
                    return `${datePart} at ${timePart}`;
                  })()
                : "Not recorded"}
            </span>
          </div>
        </div>
      </section>

      {/* Log out */}
      <div>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium font-sans bg-black text-white rounded-none hover:bg-black/85 transition-colors"
        >
          <span className="material-symbols-rounded text-[18px]">logout</span>
          Log out
        </button>
      </div>

      {/* Organization modal */}
      {orgModalOpen && (
        <div
          className="fixed inset-0 min-h-[100dvh] z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="rounded-none bg-white shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-white px-6 pt-6 pb-1 flex items-start">
              <h2
                className="text-xl text-mono-dark font-medium"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                Edit Organization
              </h2>
            </div>
            <div className="px-6 py-3 space-y-3">
              <p className="text-xs text-mono-medium">
                Update organization details used to determine deductions and tax treatment.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-mono-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Organization name"
                    className="w-full border px-4 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none border-bg-tertiary/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-mono-medium mb-1">Street address 1</label>
                  <input
                    type="text"
                    value={orgAddress1}
                    onChange={(e) => setOrgAddress1(e.target.value)}
                    placeholder="123 Main St"
                    className="w-full border px-4 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none border-bg-tertiary/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-mono-medium mb-1">Street address 2</label>
                  <input
                    type="text"
                    value={orgAddress2}
                    onChange={(e) => setOrgAddress2(e.target.value)}
                    placeholder="Apt, suite, unit (optional)"
                    className="w-full border px-4 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none border-bg-tertiary/60"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-mono-medium mb-1">City</label>
                    <input
                      type="text"
                      value={orgCity}
                      onChange={(e) => setOrgCity(e.target.value)}
                      placeholder="City"
                      className="w-full border px-4 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none border-bg-tertiary/60"
                    />
                  </div>
                  <div className="w-28">
                    <label className="block text-xs text-mono-medium mb-1">State</label>
                    <select
                      value={orgState}
                      onChange={(e) => setOrgState(e.target.value)}
                      className="w-full border px-3 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none border-bg-tertiary/60"
                    >
                      <option value="">—</option>
                      {["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"].map(
                        (code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <div className="w-28">
                    <label className="block text-xs text-mono-medium mb-1">ZIP</label>
                    <input
                      type="text"
                      value={orgZip}
                      onChange={(e) => setOrgZip(e.target.value)}
                      placeholder="ZIP"
                      className="w-full border px-3 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none border-bg-tertiary/60"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-mono-medium mb-1">Type</label>
                  <select
                    value={orgFilingType}
                    onChange={(e) => setOrgFilingType(e.target.value)}
                    className="w-full border px-4 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none border-bg-tertiary/60"
                  >
                    {FILING_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 pt-2 pb-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOrgModalOpen(false)}
                className="px-4 py-2.5 text-sm font-medium font-sans bg-[#F0F1F7] text-mono-dark rounded-none hover:bg-[#E4E7F0] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveOrg}
                disabled={savingOrg}
                className="px-4 py-2.5 text-sm font-medium font-sans bg-black text-white rounded-none hover:bg-black/85 disabled:opacity-50 transition-colors"
              >
                {savingOrg ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tax Settings modal */}
      {taxModalOpen && (
        <div
          className="fixed inset-0 min-h-[100dvh] z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="rounded-none bg-white shadow-xl max-w-md w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-white px-6 pt-6 pb-1 flex items-start shrink-0">
              <h2
                className="text-xl text-mono-dark font-medium"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                Edit Tax Settings
              </h2>
            </div>
            <div className="px-6 py-3 space-y-4 overflow-y-auto">
              <p className="text-xs text-mono-medium">
                Update your filing status, expected income range, and business industry.
              </p>

              {/* Filing status */}
              <div>
                <label className="block text-xs text-mono-medium mb-2">Filing status</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setTaxFilingStatus("single"); setTaxIncomeRange(null); }}
                    className={`px-3 py-2 text-xs font-medium rounded-none transition-colors ${
                      taxFilingStatus === "single" ? "bg-black text-white" : "bg-[#F0F1F7] text-mono-dark hover:bg-[#E4E7F0]"
                    }`}
                  >
                    Single
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTaxFilingStatus("married_filing_jointly"); setTaxIncomeRange(null); }}
                    className={`px-3 py-2 text-xs font-medium rounded-none transition-colors ${
                      taxFilingStatus === "married_filing_jointly" ? "bg-black text-white" : "bg-[#F0F1F7] text-mono-dark hover:bg-[#E4E7F0]"
                    }`}
                  >
                    Jointly
                  </button>
                </div>
              </div>

              {/* Expected income */}
              <div>
                <label className="block text-xs text-mono-medium mb-2">Expected income (business + personal)</label>
                {!taxFilingStatus ? (
                  <p className="text-xs text-mono-light">Select a filing status first.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {INCOME_BRACKETS[taxFilingStatus].map((bracket) => (
                      <button
                        key={bracket.id}
                        type="button"
                        onClick={() => setTaxIncomeRange(bracket.id)}
                        className={`px-3 py-2 text-xs font-medium rounded-none transition-colors ${
                          taxIncomeRange === bracket.id ? "bg-black text-white" : "bg-[#F0F1F7] text-mono-dark hover:bg-[#E4E7F0]"
                        }`}
                      >
                        {bracket.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Industry */}
              <div>
                <label className="block text-xs text-mono-medium mb-2">Business industry</label>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRY_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setTaxIndustry(preset);
                        setTaxIndustryInput(preset);
                      }}
                      className={`px-3 py-2 text-xs font-medium rounded-none transition-colors ${
                        taxIndustry === preset ? "bg-black text-white" : "bg-[#F0F1F7] text-mono-dark hover:bg-[#E4E7F0]"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={taxIndustryInput}
                  onChange={(e) => {
                    setTaxIndustryInput(e.target.value);
                    setTaxIndustry(e.target.value);
                  }}
                  placeholder="Or type your industry..."
                  className="mt-2 w-full border border-[#F0F1F7] px-4 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none"
                />
              </div>
            </div>
            <div className="px-6 pt-2 pb-6 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setTaxModalOpen(false)}
                className="px-4 py-2.5 text-sm font-medium font-sans bg-[#F0F1F7] text-mono-dark rounded-none hover:bg-[#E4E7F0] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTax}
                disabled={savingTax}
                className="px-4 py-2.5 text-sm font-medium font-sans bg-black text-white rounded-none hover:bg-black/85 disabled:opacity-50 transition-colors"
              >
                {savingTax ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password modal */}
      {passwordModalOpen && (
        <div
          className="fixed inset-0 min-h-[100dvh] z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="rounded-none bg-white shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-white px-6 pt-6 pb-1 flex items-start">
              <h2
                className="text-xl text-mono-dark font-medium"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                Change Password
              </h2>
            </div>
            <div className="px-6 py-3 space-y-3">
              {passwordMsg && (
                <p
                  className={`text-sm p-3 ${
                    passwordMsg.type === "success"
                      ? "text-accent-sage bg-accent-sage/5 border border-accent-sage/20 rounded-lg"
                      : "bg-[#FEE2E2] text-[#DC2626]"
                  }`}
                >
                  {passwordMsg.text}
                </p>
              )}
              <div>
                <label className="text-sm font-medium text-mono-dark block mb-2">Current password</label>
                <input
                  type="password"
                  name="current-password"
                  autoComplete="current-password"
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border border-bg-tertiary/60 px-4 py-3 text-sm bg-white rounded-none focus:border-black outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-mono-dark block mb-2">New password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="new-password"
                    autoComplete="new-password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border border-bg-tertiary/60 px-4 py-3 text-sm bg-white rounded-none focus:border-black outline-none pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-mono-light hover:text-mono-medium transition-colors"
                    tabIndex={-1}
                  >
                    <span className="material-symbols-rounded text-[20px]">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
            <div className="px-6 pt-2 pb-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPasswordModalOpen(false)}
                className="px-4 py-2.5 text-sm font-medium font-sans bg-[#F0F1F7] text-mono-dark rounded-none hover:bg-[#E4E7F0] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePasswordChange}
                disabled={
                  passwordSaving ||
                  !currentPassword ||
                  !newPassword ||
                  !passwordStrong
                }
                className="px-4 py-2.5 text-sm font-medium font-sans bg-black text-white rounded-none hover:bg-black/85 disabled:opacity-50 transition-colors"
              >
                {passwordSaving ? "Updating…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
