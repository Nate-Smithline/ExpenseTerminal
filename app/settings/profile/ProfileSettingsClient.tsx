"use client";

import { useEffect, useState } from "react";
import type { Database } from "@/lib/types/database";
import {
  BUSINESS_ENTITY_TYPES,
  FILING_STATUS_OPTIONS,
  INCOME_BRACKETS,
  parseFilingStatus,
  type FilingStatus,
} from "@/lib/tax/filing-status";

type OrgSettings = Database["public"]["Tables"]["org_settings"]["Row"];

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name_prefix: string | null;
  email: string | null;
  phone: string | null;
}

interface TaxYearSettings {
  tax_year: number;
  tax_rate: string;
  expected_income_range: string | null;
}

export function ProfileSettingsClient({
  initialProfile,
  userEmail,
  initialOrg,
  initialTaxSettings,
  taxYear,
}: {
  initialProfile: Profile | null;
  userEmail: string | null;
  initialOrg: OrgSettings | null;
  initialTaxSettings: TaxYearSettings | null;
  taxYear: number;
}) {
  const [firstName, setFirstName] = useState(initialProfile?.first_name ?? "");
  const [lastName, setLastName] = useState(initialProfile?.last_name ?? "");
  const [phone, setPhone] = useState(initialProfile?.phone ?? "");
  const [emailInput, setEmailInput] = useState(userEmail ?? "");
  const [businessName, setBusinessName] = useState(initialOrg?.business_name ?? "");
  const [businessIndustry, setBusinessIndustry] = useState(initialOrg?.business_industry ?? "");
  const [entityType, setEntityType] = useState(initialOrg?.filing_type ?? "sole_prop");
  const [filingStatus, setFilingStatus] = useState<FilingStatus | null>(
    parseFilingStatus(initialOrg?.personal_filing_status),
  );
  const [incomeRange, setIncomeRange] = useState<string | null>(
    initialTaxSettings?.expected_income_range ?? null,
  );

  const [saving, setSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [emailMessage, setEmailMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    setFirstName(initialProfile?.first_name ?? "");
    setLastName(initialProfile?.last_name ?? "");
    setPhone(initialProfile?.phone ?? "");
    setEmailInput(userEmail ?? "");
    setBusinessName(initialOrg?.business_name ?? "");
    setBusinessIndustry(initialOrg?.business_industry ?? "");
    setEntityType(initialOrg?.filing_type ?? "sole_prop");
    setFilingStatus(parseFilingStatus(initialOrg?.personal_filing_status));
    setIncomeRange(initialTaxSettings?.expected_income_range ?? null);
  }, [initialProfile, initialOrg, initialTaxSettings, userEmail]);

  const incomeOptions = filingStatus ? INCOME_BRACKETS[filingStatus] : [];
  const emailDirty =
    emailInput.trim().toLowerCase() !== (userEmail ?? "").trim().toLowerCase();

  async function handleEmailUpdate() {
    const next = emailInput.trim();
    if (!next || !emailDirty) return;
    setEmailSaving(true);
    setEmailMessage(null);
    try {
      const res = await fetch("/api/profile/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEmailMessage({ type: "err", text: body?.error ?? "Could not update email" });
        return;
      }
      setEmailMessage({
        type: "ok",
        text: body?.message ?? "Check your inbox to confirm the new address.",
      });
    } catch {
      setEmailMessage({ type: "err", text: "Could not update email. Check your connection." });
    } finally {
      setEmailSaving(false);
    }
  }

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const profileRes = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          phone: phone.trim() || null,
        }),
      });

      if (!profileRes.ok) {
        const body = await profileRes.json().catch(() => ({}));
        setMessage({ type: "err", text: body?.error ?? "Failed to save profile" });
        return;
      }

      const orgPayload: Record<string, unknown> = {
        business_name: businessName.trim() || null,
        business_industry: businessIndustry.trim() || null,
        filing_type: entityType || null,
      };
      if (filingStatus) orgPayload.personal_filing_status = filingStatus;

      const orgRes = await fetch("/api/org-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orgPayload),
      });

      if (!orgRes.ok) {
        const body = await orgRes.json().catch(() => ({}));
        setMessage({ type: "err", text: body?.error ?? "Failed to save settings" });
        return;
      }

      if (filingStatus && incomeRange) {
        const bracket = INCOME_BRACKETS[filingStatus]?.find((b) => b.id === incomeRange);
        if (bracket) {
          const taxRes = await fetch("/api/tax-year-settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tax_year: taxYear,
              tax_rate: bracket.taxRate,
              expected_income_range: bracket.id,
            }),
          });
          if (!taxRes.ok) {
            const body = await taxRes.json().catch(() => ({}));
            setMessage({ type: "err", text: body?.error ?? "Failed to save tax bracket" });
            return;
          }
        }
      }

      setMessage({ type: "ok", text: "Settings saved." });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("profile-updated"));
      }
    } catch {
      setMessage({ type: "err", text: "Save failed. Check your connection." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-panel" onSubmit={handleSave}>
      <div className="setting-section">
        <div className="setting-section__head">
          <h2 className="setting-section__title">Account &amp; tax profile</h2>
          <p className="setting-section__sub">
            Personal details, business info, and tax filing settings in one place.
          </p>
        </div>

        <div className="setting-section__body settings-form">
          <fieldset className="settings-form__group">
            <legend className="settings-form__legend">Personal</legend>
            <div className="settings__field-grid">
              <div className="settings__field">
                <label className="settings-form__label" htmlFor="first-name">First name</label>
                <input
                  id="first-name"
                  className="settings__input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div className="settings__field">
                <label className="settings-form__label" htmlFor="last-name">Last name</label>
                <input
                  id="last-name"
                  className="settings__input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
              <div className="settings__field">
                <label className="settings-form__label" htmlFor="phone">Phone</label>
                <input
                  id="phone"
                  className="settings__input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Optional"
                  autoComplete="tel"
                />
              </div>
              <div className="settings__field settings__field--full">
                <label className="settings-form__label" htmlFor="email">Email</label>
                <div className="settings-email-row">
                  <input
                    id="email"
                    type="email"
                    className="settings__input"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      setEmailMessage(null);
                    }}
                    autoComplete="email"
                  />
                  <button
                    type="button"
                    className="btn btn--ghost btn--mini"
                    disabled={!emailDirty || emailSaving}
                    onClick={handleEmailUpdate}
                  >
                    {emailSaving ? "Sending…" : "Update email"}
                  </button>
                </div>
                {emailMessage && (
                  <p
                    className="settings-form__hint"
                    style={{ color: emailMessage.type === "ok" ? "var(--forest-deep)" : "var(--ember)" }}
                  >
                    {emailMessage.text}
                  </p>
                )}
                {!emailMessage && emailDirty && (
                  <p className="settings-form__hint">
                    We&apos;ll send a confirmation link to the new address.
                  </p>
                )}
              </div>
            </div>
          </fieldset>

          <fieldset className="settings-form__group">
            <legend className="settings-form__legend">Business</legend>
            <div className="settings__field-grid">
              <div className="settings__field">
                <label className="settings-form__label" htmlFor="business-name">Business name</label>
                <input
                  id="business-name"
                  className="settings__input"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Smith Studio"
                />
              </div>
              <div className="settings__field">
                <label className="settings-form__label" htmlFor="industry">Industry</label>
                <input
                  id="industry"
                  className="settings__input"
                  value={businessIndustry}
                  onChange={(e) => setBusinessIndustry(e.target.value)}
                  placeholder="Consulting, design, etc."
                />
              </div>
              <div className="settings__field settings__field--full">
                <label className="settings-form__label" htmlFor="entity-type">Business entity</label>
                <select
                  id="entity-type"
                  className="settings__input"
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                >
                  {BUSINESS_ENTITY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset className="settings-form__group">
            <legend className="settings-form__legend">Tax filing</legend>
            <p className="settings-form__hint" style={{ marginTop: 0, marginBottom: 12 }}>
              Used for federal bracket estimates on the Tax page ({taxYear}).
            </p>
            <div className="settings__field-grid">
              <div className="settings__field">
                <label className="settings-form__label" htmlFor="filing-status">Filing status</label>
                <select
                  id="filing-status"
                  className="settings__input"
                  value={filingStatus ?? ""}
                  onChange={(e) => {
                    const next = parseFilingStatus(e.target.value);
                    setFilingStatus(next);
                    setIncomeRange(null);
                  }}
                >
                  <option value="">Select…</option>
                  {FILING_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="settings__field">
                <label className="settings-form__label" htmlFor="tax-bracket">Federal tax bracket</label>
                <select
                  id="tax-bracket"
                  className="settings__input"
                  value={incomeRange ?? ""}
                  disabled={!filingStatus}
                  onChange={(e) => setIncomeRange(e.target.value || null)}
                >
                  <option value="">Select bracket…</option>
                  {incomeOptions.map((b) => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>
        </div>

        <div className="setting-section__foot">
          {message && (
            <p
              className="settings-form__status"
              style={{ color: message.type === "ok" ? "var(--forest-deep)" : "var(--ember)" }}
            >
              {message.text}
            </p>
          )}
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
