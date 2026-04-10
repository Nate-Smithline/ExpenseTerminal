"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { formatUSPhone, parseUSPhone, displayUSPhone } from "@/lib/format-us-phone";
import { PreferencesTabs } from "@/app/preferences/PreferencesTabs";

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

const PREF_TABS = [
  { href: "/preferences/org", label: "Org" },
  { href: "/preferences/profile", label: "Profile" },
] as const;

export function ProfileClient({
  initialProfile,
  userEmail,
}: {
  initialProfile: Profile | null;
  userEmail: string | null;
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
