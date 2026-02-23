"use client";

import { useState, useRef } from "react";
import { validatePassword } from "@/lib/validation/password";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  notification_email_updates: boolean;
  notification_group: boolean;
}

export function ProfileClient({
  initialProfile,
  userEmail,
}: {
  initialProfile: Profile | null;
  userEmail: string | null;
}) {
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [notifEmail, setNotifEmail] = useState(profile?.notification_email_updates ?? false);
  const [notifGroup, setNotifGroup] = useState(profile?.notification_group ?? false);
  const [savingNotif, setSavingNotif] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials = [
    (profile?.first_name || "")[0],
    (profile?.last_name || "")[0],
  ]
    .filter(Boolean)
    .join("")
    .toUpperCase() || "?";

  async function handleSaveProfile() {
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first_name: firstName, last_name: lastName, phone }),
    });
    if (res.ok) {
      const { data } = await res.json();
      setProfile(data);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  async function handleNotifToggle(field: "notification_email_updates" | "notification_group", value: boolean) {
    if (field === "notification_email_updates") setNotifEmail(value);
    else setNotifGroup(value);
    setSavingNotif(true);

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      const { data } = await res.json();
      setProfile(data);
    }
    setSavingNotif(false);
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

    if (res.ok) {
      setPasswordMsg({ type: "success", text: "Password updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      const body = await res.json().catch(() => ({}));
      setPasswordMsg({ type: "error", text: (body as { error?: string }).error ?? "Failed to update password." });
    }
    setPasswordSaving(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);

    const fd = new FormData();
    fd.append("avatar", file);
    const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
    if (res.ok) {
      const { data } = await res.json();
      setProfile((p) => p ? { ...p, avatar_url: data.avatar_url } : p);
    }
    setAvatarUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAvatarRemove() {
    setAvatarUploading(true);
    const res = await fetch("/api/profile/avatar", { method: "DELETE" });
    if (res.ok) {
      setProfile((p) => p ? { ...p, avatar_url: null } : p);
    }
    setAvatarUploading(false);
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl text-mono-dark">My Account</h1>
        <p className="text-sm text-mono-medium mt-1">Manage your profile, notifications, and password</p>
      </div>

      {/* My Profile */}
      <div className="card p-6 space-y-6">
        <h2 className="text-lg font-semibold text-mono-dark">My Profile</h2>

        {/* Avatar row */}
        <div className="flex items-center gap-4 border border-bg-tertiary/40 rounded-xl p-4">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="Avatar"
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-mono-medium flex items-center justify-center">
              <span className="text-sm font-semibold text-white">{initials}</span>
            </div>
          )}

          <div className="flex-1">
            {profile?.avatar_url ? (
              <button
                onClick={handleAvatarRemove}
                disabled={avatarUploading}
                className="text-sm text-accent-terracotta hover:underline"
              >
                Remove
              </button>
            ) : (
              <p className="text-sm text-mono-medium">
                Click <span className="font-semibold">upload</span> to change avatar
              </p>
            )}
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            className="text-sm text-accent-terracotta hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-rounded text-[16px]">upload</span>
            {avatarUploading ? "Uploading..." : "Upload Avatar"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarUpload}
            className="hidden"
          />
        </div>

        {/* Profile info — view or edit */}
        {!editing ? (
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-mono-dark">Name</p>
                  <p className="text-sm text-mono-medium">
                    {[profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-mono-dark">Email</p>
                  <p className="text-sm text-mono-medium">{userEmail || profile?.email || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-mono-dark">Mobile Number</p>
                  <p className="text-sm text-mono-medium">{profile?.phone || "Not set"}</p>
                </div>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="btn-secondary text-sm px-5 py-2"
              >
                Edit
              </button>
            </div>
            {saved && (
              <p className="text-xs text-accent-sage font-medium">Profile saved!</p>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-semibold text-mono-dark">Edit Profile</h3>
              <button
                onClick={() => {
                  setEditing(false);
                  setFirstName(profile?.first_name ?? "");
                  setLastName(profile?.last_name ?? "");
                  setPhone(profile?.phone ?? "");
                }}
                className="text-mono-light hover:text-mono-medium transition-colors"
              >
                <span className="material-symbols-rounded text-[20px]">close</span>
              </button>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-mono-medium block mb-1">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full border border-bg-tertiary/60 rounded-xl px-4 py-3 text-sm bg-white focus:border-accent-sage/40 outline-none transition-all"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-mono-medium block mb-1">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full border border-bg-tertiary/60 rounded-xl px-4 py-3 text-sm bg-white focus:border-accent-sage/40 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-mono-medium block mb-1">Email</label>
              <input
                type="email"
                value={userEmail || profile?.email || ""}
                disabled
                className="w-full border border-bg-tertiary/40 rounded-xl px-4 py-3 text-sm bg-bg-secondary text-mono-light"
              />
              <p className="text-xs text-accent-terracotta mt-1">
                Please reach out to expenseterminal@outlook.com if you&apos;d like to change your email
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-mono-medium block mb-1">Mobile Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="w-full border border-bg-tertiary/60 rounded-xl px-4 py-3 text-sm bg-white focus:border-accent-sage/40 outline-none transition-all"
              />
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="btn-warm w-full"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        )}
      </div>

      {/* Emails & Notifications */}
      <div className="card p-6 space-y-5">
        <h2 className="text-lg font-semibold text-mono-dark">Emails and Notifications</h2>

        <div className="flex items-center justify-between py-2 border-b border-bg-tertiary/20">
          <span className="text-sm text-mono-medium">
            I&apos;d like to receive occasional updates and emails from ExpenseTerminal
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={notifEmail}
            disabled={savingNotif}
            onClick={() => handleNotifToggle("notification_email_updates", !notifEmail)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
              notifEmail ? "bg-accent-sage" : "bg-bg-tertiary"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                notifEmail ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-mono-medium">
            I&apos;d like to receive group notifications
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={notifGroup}
            disabled={savingNotif}
            onClick={() => handleNotifToggle("notification_group", !notifGroup)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
              notifGroup ? "bg-accent-sage" : "bg-bg-tertiary"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                notifGroup ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="card p-6 space-y-5">
        <h2 className="text-lg font-semibold text-mono-dark">Change Password</h2>

        <div>
          <input
            type="password"
            placeholder="Current Password *"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full border border-bg-tertiary/60 rounded-xl px-4 py-3 text-sm bg-white focus:border-accent-sage/40 outline-none transition-all"
          />
        </div>

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="New Password *"
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

        <div className="relative">
          <input
            type={showConfirm ? "text" : "password"}
            placeholder="Confirm New Password *"
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
            disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
            className="btn-warm px-8 disabled:opacity-40"
          >
            {passwordSaving ? "Updating..." : "Update Password"}
          </button>
        </div>
      </div>
    </div>
  );
}
