"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { validatePassword, getPasswordStrength } from "@/lib/validation/password";
import { formatUSPhone, parseUSPhone, displayUSPhone } from "@/lib/format-us-phone";

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
}

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
  const [saved, setSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
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
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Passwords do not match." });
      return;
    }
    const check = validatePassword(newPassword);
    if (!check.valid) {
      setPasswordMsg({ type: "error", text: check.message ?? "Password does not meet requirements." });
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
      setPasswordMsg({ type: "success", text: "Password updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
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
    newPassword.length >= 12 ||
    (newPassword.length >= 8 &&
      /[a-z]/.test(newPassword) &&
      /[A-Z]/.test(newPassword) &&
      /\d/.test(newPassword) &&
      /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword));

  const displayName = [profile?.name_prefix, profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || "Not set";

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl text-mono-dark">My Account</h1>
        <p className="text-sm text-mono-medium mt-1">Manage your profile and password</p>
      </div>

      {/* My Profile card */}
      <div className="card p-6 space-y-6">
        <h2 className="text-lg font-semibold text-mono-dark">My Profile</h2>

        {/* Profile info — view only; Edit opens modal */}
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-mono-dark">Name</p>
                <p className="text-sm text-mono-medium">{displayName}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-mono-dark">Email</p>
                <p className="text-sm text-mono-medium">{userEmail || profile?.email || "Not set"}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-mono-dark">Mobile Number</p>
                <p className="text-sm text-mono-medium">
                  {profile?.phone ? displayUSPhone(profile.phone) : "Not set"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setEditModalOpen(true)}
              className="btn-secondary text-sm px-5 py-2 inline-flex items-center gap-2"
            >
              <kbd className="kbd-hint">e</kbd>
              Edit
            </button>
          </div>
          {saved && <p className="text-xs text-accent-sage font-medium">Profile saved!</p>}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-title"
        >
          <div className="rounded-xl bg-white shadow-[0_8px_30px_-6px_rgba(0,0,0,0.14)] max-w-[500px] w-full mx-4 overflow-hidden">
            <div className="rounded-t-xl bg-[#2d3748] px-6 pt-6 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="edit-profile-title" className="text-xl font-bold text-white tracking-tight">
                    Edit Profile
                  </h2>
                  <p className="text-sm text-white/80 mt-1.5">
                    Update your name and mobile number.
                  </p>
                </div>
                <button
                  onClick={() => setEditModalOpen(false)}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition shrink-0"
                  aria-label="Close"
                >
                  <span className="material-symbols-rounded text-[18px]">close</span>
                </button>
              </div>
            </div>
            <div className="px-6 py-6 space-y-5">
              <div>
                <label className="text-sm font-medium text-mono-dark block mb-2">Prefix</label>
                <select
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="w-full border border-bg-tertiary rounded-md px-3.5 py-2.5 text-sm text-mono-dark bg-white focus:ring-2 focus:ring-accent-sage/20 focus:border-accent-sage/40 outline-none transition"
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
                  <label className="text-sm font-medium text-mono-dark block mb-2">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    className="w-full border border-bg-tertiary rounded-md px-3.5 py-2.5 text-sm text-mono-dark bg-white placeholder:text-mono-light focus:ring-2 focus:ring-accent-sage/20 focus:border-accent-sage/40 outline-none transition"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-mono-dark block mb-2">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last name"
                    className="w-full border border-bg-tertiary rounded-md px-3.5 py-2.5 text-sm text-mono-dark bg-white placeholder:text-mono-light focus:ring-2 focus:ring-accent-sage/20 focus:border-accent-sage/40 outline-none transition"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-mono-dark block mb-2">Email</label>
                <input
                  type="email"
                  value={userEmail || profile?.email || ""}
                  disabled
                  className="w-full border border-bg-tertiary/40 rounded-md px-3.5 py-2.5 text-sm bg-bg-secondary text-mono-light"
                />
                <p className="text-xs text-accent-terracotta mt-1">
                  Contact expenseterminal@outlook.com to change your email
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-mono-dark block mb-2">Mobile Number</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phoneDisplay}
                  onChange={handlePhoneChange}
                  placeholder="(123) 456-7890"
                  maxLength={14}
                  className="w-full border border-bg-tertiary rounded-md px-3.5 py-2.5 text-sm text-mono-dark bg-white placeholder:text-mono-light focus:ring-2 focus:ring-accent-sage/20 focus:border-accent-sage/40 outline-none transition"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-bg-tertiary/40">
              <button
                onClick={() => setEditModalOpen(false)}
                disabled={saving}
                className="rounded-md border border-bg-tertiary bg-white px-4 py-2.5 text-sm font-semibold text-mono-dark hover:bg-bg-secondary transition disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="rounded-md bg-mono-dark px-4 py-2.5 text-sm font-semibold text-white hover:bg-mono-dark/90 transition disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password */}
      <div className="card p-6 space-y-5">
        <h2 className="text-lg font-semibold text-mono-dark">Change Password</h2>

        <div>
          <label className="text-sm font-medium text-mono-dark block mb-2">Current Password</label>
          <input
            type="password"
            placeholder="Enter current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full border border-bg-tertiary/60 rounded-xl px-4 py-3 text-sm bg-white focus:border-accent-sage/40 outline-none transition-all"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-mono-dark block mb-2">New Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-bg-tertiary/60 rounded-xl px-4 py-3 text-sm bg-white focus:border-accent-sage/40 outline-none transition-all pr-12"
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
          {newPassword && (
            <div className="mt-2 p-3 rounded-lg border border-bg-tertiary bg-bg-secondary">
              <div className="space-y-1.5 text-xs">
                <div
                  className={`flex items-center gap-2 ${
                    passwordStrong ? "text-green-600" : "text-mono-medium"
                  }`}
                >
                  <span className="material-symbols-rounded text-[16px]">
                    {passwordStrong ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <span>
                    {newPassword.length >= 12
                      ? "12+ characters"
                      : "8+ characters with uppercase, lowercase, number, and special character"}
                  </span>
                </div>
                <div
                  className={`flex items-center gap-2 ${
                    /[a-z]/.test(newPassword) ? "text-green-600" : "text-mono-medium"
                  }`}
                >
                  <span className="material-symbols-rounded text-[16px]">
                    {/[a-z]/.test(newPassword) ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <span>Lowercase letter</span>
                </div>
                <div
                  className={`flex items-center gap-2 ${
                    /[A-Z]/.test(newPassword) ? "text-green-600" : "text-mono-medium"
                  }`}
                >
                  <span className="material-symbols-rounded text-[16px]">
                    {/[A-Z]/.test(newPassword) ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <span>Uppercase letter</span>
                </div>
                <div
                  className={`flex items-center gap-2 ${
                    /\d/.test(newPassword) ? "text-green-600" : "text-mono-medium"
                  }`}
                >
                  <span className="material-symbols-rounded text-[16px]">
                    {/\d/.test(newPassword) ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  <span>Number</span>
                </div>
                <div
                  className={`flex items-center gap-2 ${
                    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword)
                      ? "text-green-600"
                      : "text-mono-medium"
                  }`}
                >
                  <span className="material-symbols-rounded text-[16px]">
                    {/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword)
                      ? "check_circle"
                      : "radio_button_unchecked"}
                  </span>
                  <span>Special character</span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-bg-tertiary">
                <p
                  className={`text-xs font-medium ${
                    getPasswordStrength(newPassword) === "weak"
                      ? "text-red-600"
                      : getPasswordStrength(newPassword) === "fair"
                        ? "text-amber-600"
                        : "text-green-600"
                  }`}
                >
                  Strength: {getPasswordStrength(newPassword)}
                </p>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-mono-dark block mb-2">Confirm New Password</label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-bg-tertiary/60 rounded-xl px-4 py-3 text-sm bg-white focus:border-accent-sage/40 outline-none transition-all pr-12"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-mono-light hover:text-mono-medium transition-colors"
              tabIndex={-1}
            >
              <span className="material-symbols-rounded text-[20px]">
                {showConfirm ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
        </div>

        {passwordMsg && (
          <p
            className={`text-sm p-3 rounded-lg ${
              passwordMsg.type === "success"
                ? "text-accent-sage bg-accent-sage/5 border border-accent-sage/20"
                : "text-danger bg-bg-secondary border border-bg-tertiary"
            }`}
          >
            {passwordMsg.text}
          </p>
        )}

        <div className="flex justify-end">
          <button
            onClick={handlePasswordChange}
            disabled={
              passwordSaving ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword ||
              !passwordStrong
            }
            className="btn-warm px-8 disabled:opacity-40"
          >
            {passwordSaving ? "Updating…" : "Update Password"}
          </button>
        </div>
      </div>

      {/* Log out */}
      <div className="pt-4">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-mono-medium hover:text-mono-dark hover:bg-bg-secondary/60 transition-colors rounded-lg"
        >
          <span className="material-symbols-rounded text-[18px]">logout</span>
          Log out
        </button>
      </div>
    </div>
  );
}
