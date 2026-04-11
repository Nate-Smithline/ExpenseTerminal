"use client";

import { useState, useCallback, useEffect } from "react";
import { PreferencesTabs } from "@/app/preferences/PreferencesTabs";
import type { OrgMemberRow, OrgPendingInviteRow } from "@/lib/orgs/enrich-org-members";
import { brandColorHex } from "@/lib/brand-palette";

export type { OrgMemberRow, OrgPendingInviteRow };

const PREF_TABS = [
  { href: "/preferences/org", label: "Org" },
  { href: "/preferences/profile", label: "Profile" },
] as const;

export function OrgPreferencesClient({
  currentUserId,
  initialOrg,
  initialMembers,
  initialPendingInvites,
}: {
  currentUserId: string;
  initialOrg: {
    id: string;
    name: string;
    role: string;
  };
  initialMembers: OrgMemberRow[];
  initialPendingInvites: OrgPendingInviteRow[];
}) {
  const isOwner = initialOrg.role === "owner";
  const [orgName, setOrgName] = useState(initialOrg.name);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [members, setMembers] = useState<OrgMemberRow[]>(initialMembers);
  const [pendingInvites, setPendingInvites] = useState<OrgPendingInviteRow[]>(initialPendingInvites);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [resendingPendingId, setResendingPendingId] = useState<string | null>(null);

  const refreshMembers = useCallback(async () => {
    const res = await fetch("/api/orgs/members");
    if (!res.ok) return;
    const data = await res.json();
    setMembers(data.members ?? []);
    setPendingInvites(data.pendingInvites ?? []);
  }, []);

  useEffect(() => {
    setOrgName(initialOrg.name);
  }, [initialOrg]);

  useEffect(() => {
    setPendingInvites(initialPendingInvites);
  }, [initialPendingInvites]);

  async function saveWorkspaceName() {
    setNameError(null);
    setSavingName(true);
    const res = await fetch(`/api/orgs/${initialOrg.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: orgName.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingName(false);
    if (!res.ok) {
      setNameError(typeof data.error === "string" ? data.error : "Could not save");
      return;
    }
    if (data.org && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("org-branding-updated", {
          detail: {
            id: data.org.id,
            name: data.org.name,
          },
        }),
      );
    }
  }

  async function sendInvites() {
    setInviteMsg(null);
    setInviteBusy(true);
    const res = await fetch("/api/orgs/members/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: inviteEmails, role: "member" }),
    });
    const data = await res.json().catch(() => ({}));
    setInviteBusy(false);
    const results = data.results as Array<{ email: string; ok: boolean; error?: string }> | undefined;

    if (Array.isArray(results) && results.length > 0) {
      const failed = results.filter((r) => !r.ok);
      const succeeded = results.filter((r) => r.ok);
      const anyPending = succeeded.some((r) => (r as { pending?: boolean }).pending);
      if (succeeded.length > 0 && failed.length === 0) {
        setInviteMsg(
          anyPending
            ? `Sent ${data.invited ?? succeeded.length} invite(s). Pending recipients appear in the list below until they join.`
            : `Sent ${data.invited ?? succeeded.length} invite(s).`,
        );
        setInviteEmails("");
        setInviteOpen(false);
        await refreshMembers();
      } else if (failed.length > 0 && succeeded.length === 0) {
        setInviteMsg(
          failed.map((f) => `${f.email}: ${f.error ?? "failed"}`).join("\n"),
        );
      } else if (failed.length > 0 && succeeded.length > 0) {
        setInviteMsg(
          [
            anyPending
              ? `Processed ${succeeded.length} (check the list for pending). Failed:`
              : `Added ${succeeded.length}. Failed:`,
            ...failed.map((f) => `${f.email}: ${f.error ?? "failed"}`),
          ].join("\n"),
        );
        setInviteEmails("");
        await refreshMembers();
      }
      return;
    }

    if (!res.ok) {
      setInviteMsg(typeof data.error === "string" ? data.error : "Invite failed");
    }
  }

  async function updateMemberRole(targetId: string, role: "owner" | "member") {
    const res = await fetch(`/api/orgs/members/${targetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(typeof data.error === "string" ? data.error : "Could not update role");
      return;
    }
    await refreshMembers();
  }

  async function removeMember(targetId: string) {
    if (!confirm("Remove this person from the workspace?")) return;
    const res = await fetch(`/api/orgs/members/${targetId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(typeof data.error === "string" ? data.error : "Could not remove");
      return;
    }
    await refreshMembers();
  }

  async function resendPendingInvite(pendingId: string) {
    setResendingPendingId(pendingId);
    const res = await fetch("/api/orgs/members/pending-invites/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pendingId }),
    });
    const data = await res.json().catch(() => ({}));
    setResendingPendingId(null);
    if (!res.ok) {
      alert(typeof data.error === "string" ? data.error : "Could not resend");
      await refreshMembers();
      return;
    }
    if (data.resolved === "already_member" || data.resolved === "added_existing_account") {
      await refreshMembers();
      return;
    }
    await refreshMembers();
  }

  async function cancelPendingInvite(pendingId: string, emailLabel: string) {
    if (!confirm(`Cancel the invitation for ${emailLabel}?`)) return;
    const res = await fetch(`/api/orgs/members/pending-invites/${pendingId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(typeof data.error === "string" ? data.error : "Could not cancel invite");
      return;
    }
    await refreshMembers();
  }

  function memberPrimaryLine(m: OrgMemberRow): string {
    return (
      m.display_name?.trim() ||
      m.email ||
      (m.id === currentUserId ? "You" : "Invited member")
    );
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
            Workspace
          </div>
          <p className="text-base text-mono-medium mt-1 font-sans">
            Manage your workspace name and people.
          </p>
        </div>
        <PreferencesTabs tabs={PREF_TABS} />
      </div>

      <section className="space-y-6 border-t border-[#F0F1F7] pt-8">
        <div>
          <h2 className="text-lg font-normal font-sans text-mono-dark">General</h2>
          <p className="text-sm text-mono-medium mt-1 font-sans">
            Your workspace name appears in the sidebar for everyone in this workspace.
          </p>
        </div>

        <div className="space-y-4 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-mono-dark mb-1">Workspace name</label>
            <p className="text-xs text-mono-medium mb-2">Your workspace name can be up to 65 characters.</p>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              maxLength={65}
              className="w-full border border-bg-tertiary/60 rounded-lg px-4 py-3 text-sm text-mono-dark bg-white focus:border-black outline-none"
            />
          </div>

          {nameError && <p className="text-sm text-red-600">{nameError}</p>}
          <button
            type="button"
            onClick={saveWorkspaceName}
            disabled={savingName}
            className="rounded-none bg-black px-4 py-2.5 text-sm font-medium font-sans text-white hover:bg-black/85 disabled:opacity-50"
          >
            {savingName ? "Saving…" : "Save changes"}
          </button>
        </div>
      </section>

      <section className="space-y-4 border-t border-[#F0F1F7] pt-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-normal font-sans text-mono-dark">People</h2>
            <p className="text-sm text-mono-medium mt-1 font-sans max-w-xl">
              Anyone in the workspace can change its display name. Owners can invite people and manage branding.
            </p>
          </div>
          {isOwner && (
            <button
              type="button"
              onClick={() => {
                setInviteMsg(null);
                setInviteOpen(true);
              }}
              className="rounded-none bg-[#E8EEF5] px-4 py-2 text-sm font-medium font-sans text-mono-dark hover:opacity-80 shrink-0"
            >
              Add members
            </button>
          )}
        </div>

        <div className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7]">
          {members.length === 0 && pendingInvites.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-mono-medium">No members yet.</div>
          ) : (
            <>
              {members.map((m) => {
                const primary = memberPrimaryLine(m);
                const showEmailSub =
                  Boolean(m.email) &&
                  Boolean(m.display_name?.trim()) &&
                  m.email !== m.display_name?.trim();
                return (
                  <div key={m.id} className="px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-mono-dark truncate">{primary}</div>
                      {showEmailSub && (
                        <div className="text-xs text-mono-medium truncate">{m.email}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isOwner && m.id !== currentUserId ? (
                        <>
                          <select
                            value={m.role}
                            onChange={(e) =>
                              updateMemberRole(m.id, e.target.value as "owner" | "member")
                            }
                            className="border border-bg-tertiary/60 text-sm px-2 py-1.5 bg-white rounded-none"
                          >
                            <option value="member">Member</option>
                            <option value="owner">Owner</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => removeMember(m.id)}
                            className="p-1.5 text-mono-light hover:text-red-600"
                            aria-label="Remove member"
                          >
                            <span className="material-symbols-rounded text-[18px]">person_remove</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-mono-medium capitalize">{m.role}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {pendingInvites.map((p) => {
                const blue = brandColorHex("blue");
                return (
                  <div
                    key={p.id}
                    className="px-4 py-3 flex flex-wrap items-center gap-3 justify-between bg-[#FAFBFD]"
                  >
                    <div className="min-w-0 flex-1 flex flex-wrap items-center gap-2">
                      <div className="text-sm font-medium text-mono-dark truncate">{p.email}</div>
                      <span
                        className="text-[11px] font-medium font-sans uppercase tracking-wide px-2 py-0.5 rounded shrink-0"
                        style={{
                          color: blue,
                          backgroundColor: `${blue}1A`,
                        }}
                      >
                        Pending
                      </span>
                    </div>
                    {isOwner ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => resendPendingInvite(p.id)}
                          disabled={resendingPendingId === p.id}
                          className="rounded-none border border-bg-tertiary/60 px-3 py-1.5 text-xs font-medium font-sans text-mono-dark hover:bg-white disabled:opacity-50"
                        >
                          {resendingPendingId === p.id ? "Sending…" : "Resend"}
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelPendingInvite(p.id, p.email)}
                          className="p-1.5 text-mono-light hover:text-red-600"
                          aria-label="Cancel invitation"
                        >
                          <span className="material-symbols-rounded text-[18px]">close</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </section>

      {inviteOpen && (
        <div
          className="fixed inset-0 min-h-[100dvh] z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="rounded-none bg-white shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-xl text-mono-dark font-medium" style={{ fontFamily: "var(--font-sans)" }}>
                Add members
              </h2>
              <p className="text-xs text-mono-medium mt-2">
                Type or paste emails below, separated by commas. New addresses get an invite link and appear as{" "}
                <span className="font-medium" style={{ color: brandColorHex("blue") }}>
                  Pending
                </span>{" "}
                in the list until they open the email link and sign in. Existing accounts get a sign-in link instead of an invite.
              </p>
            </div>
            <div className="px-6 py-3 space-y-3">
              <textarea
                value={inviteEmails}
                onChange={(e) => setInviteEmails(e.target.value)}
                placeholder="colleague@company.com, another@…"
                rows={4}
                className="w-full border border-bg-tertiary/60 px-3 py-2 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none resize-y"
              />
              <div>
                <label className="block text-xs text-mono-medium mb-1">Role</label>
                <div className="text-sm text-mono-dark border border-[#F0F1F7] bg-[#F8F9FB] px-3 py-2">
                  <span className="font-medium">Member</span>
                  <p className="text-xs text-mono-medium mt-1">
                    Can use the workspace. Cannot change workspace settings or invite others.
                  </p>
                </div>
              </div>
              {inviteMsg && (
                <pre className="text-xs text-mono-dark whitespace-pre-wrap bg-[#F8F9FB] p-2 border border-[#F0F1F7] max-h-32 overflow-y-auto">
                  {inviteMsg}
                </pre>
              )}
            </div>
            <div className="px-6 pt-2 pb-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="px-4 py-2.5 text-sm font-medium font-sans bg-[#F0F1F7] text-mono-dark rounded-none hover:bg-[#E4E7F0]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={sendInvites}
                disabled={inviteBusy || !inviteEmails.trim()}
                className="px-4 py-2.5 text-sm font-medium font-sans bg-black text-white rounded-none hover:bg-black/85 disabled:opacity-50"
              >
                {inviteBusy ? "Sending…" : "Send invites"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
