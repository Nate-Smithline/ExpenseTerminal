"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";

type OrgRow = { id: string; name: string; role: string };
type PendingRow = { id: string; org_id: string; name: string };

type OrgsPayload = {
  orgs: OrgRow[];
  active_org_id: string | null;
  pending_invites: PendingRow[];
};

const PREFS_ORG = "/preferences/org";

function roleLabel(role: string): string {
  if (role === "owner") return "Owner";
  if (role === "member") return "Member";
  return role;
}

export function WorkspaceSwitcher({
  layout = "desktop",
  onNavigate,
}: {
  layout?: "desktop" | "mobile";
  /** Close parent sheet (e.g. mobile menu) after navigation */
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingRow[]>([]);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrgs = useCallback(async () => {
    try {
      const res = await fetch("/api/orgs");
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = (await res.json()) as OrgsPayload;
      setOrgs(Array.isArray(data.orgs) ? data.orgs : []);
      setActiveOrgId(data.active_org_id ?? null);
      setPendingInvites(Array.isArray(data.pending_invites) ? data.pending_invites : []);
      setError(null);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrgs();
  }, [loadOrgs]);

  useEffect(() => {
    if (open) void loadOrgs();
  }, [open, loadOrgs]);

  useEffect(() => {
    const onBranding = () => {
      void loadOrgs();
    };
    window.addEventListener("org-branding-updated", onBranding);
    return () => window.removeEventListener("org-branding-updated", onBranding);
  }, [loadOrgs]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [open]);

  const activeOrg = orgs.find((o) => o.id === activeOrgId) ?? orgs[0];
  const triggerLabel = activeOrg?.name ?? "Expense Terminal";

  async function switchOrg(orgId: string, name: string) {
    if (orgId === activeOrgId) {
      setOpen(false);
      return;
    }
    setSwitchingId(orgId);
    setError(null);
    try {
      const res = await fetch("/api/orgs/active", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(typeof j.error === "string" ? j.error : "Could not switch workspace");
        return;
      }
      setActiveOrgId(orgId);
      window.dispatchEvent(new CustomEvent("org-branding-updated", { detail: { name } }));
      setOpen(false);
      if (layout === "mobile") onNavigate?.();
      window.location.reload();
    } catch {
      setError("Could not switch workspace");
    } finally {
      setSwitchingId(null);
    }
  }

  async function createWorkspace() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/orgs/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof j.error === "string" ? j.error : "Could not create workspace");
        return;
      }
      const name = typeof j.name === "string" ? j.name : "My workspace";
      window.dispatchEvent(new CustomEvent("org-branding-updated", { detail: { name } }));
      setOpen(false);
      onNavigate?.();
      window.location.reload();
    } catch {
      setError("Could not create workspace");
    } finally {
      setCreating(false);
    }
  }

  async function handleLogout() {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    setOpen(false);
    onNavigate?.();
    router.push("/");
    router.refresh();
  }

  function badgeClass(kind: "owner" | "member" | "pending") {
    if (kind === "owner") return "bg-violet-100 text-violet-900";
    if (kind === "member") return "bg-[#E8EEF5] text-mono-dark";
    return "bg-amber-100 text-amber-900";
  }

  const panel = open ? (
    <div
      className={`absolute z-[120] mt-1.5 w-[min(100vw-2rem,320px)] rounded-xl border border-bg-tertiary/80 bg-white py-3 shadow-lg ${
        layout === "mobile" ? "left-0" : "left-0"
      }`}
      role="dialog"
      aria-label="Workspace menu"
    >
      <div className="px-4 pb-3 border-b border-bg-tertiary/60">
        <p className="text-[15px] font-semibold text-mono-dark truncate">{triggerLabel}</p>
        {activeOrg ? (
          <p className="text-xs text-mono-light mt-0.5">{roleLabel(activeOrg.role)}</p>
        ) : null}
        <div className="flex gap-2 mt-3">
          <Link
            href={PREFS_ORG}
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-bg-tertiary/80 px-2.5 py-2 text-xs font-medium text-mono-dark hover:bg-mono-dark/[0.04]"
          >
            <span
              className="material-symbols-rounded text-[16px] text-mono-medium"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
            >
              settings
            </span>
            Settings
          </Link>
          <Link
            href={PREFS_ORG}
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-bg-tertiary/80 px-2.5 py-2 text-xs font-medium text-mono-dark hover:bg-mono-dark/[0.04]"
          >
            <span
              className="material-symbols-rounded text-[16px] text-mono-medium"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
            >
              person_add
            </span>
            Invite
          </Link>
        </div>
      </div>

      <div className="px-2 py-2 max-h-[min(50vh,280px)] overflow-y-auto">
        <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-mono-light">
          Workspaces
        </p>
        {loading ? (
          <p className="px-2 py-2 text-sm text-mono-light">Loading…</p>
        ) : (
          <>
            {orgs.map((o) => {
              const isActive = o.id === activeOrgId;
              const kind = o.role === "owner" ? "owner" : "member";
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={!!switchingId}
                  onClick={() => void switchOrg(o.id, o.name)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                    isActive ? "bg-mono-dark/[0.06]" : "hover:bg-mono-dark/[0.04]"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate font-medium text-mono-dark">{o.name}</span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${badgeClass(kind)}`}
                  >
                    {roleLabel(o.role)}
                  </span>
                  {isActive ? (
                    <span
                      className="material-symbols-rounded shrink-0 text-[18px] text-sovereign-blue"
                      aria-label="Current workspace"
                    >
                      check
                    </span>
                  ) : switchingId === o.id ? (
                    <span className="text-[10px] text-mono-light shrink-0">…</span>
                  ) : (
                    <span className="w-[18px] shrink-0" />
                  )}
                </button>
              );
            })}
            {pendingInvites.length > 0 ? (
              <p className="px-2 pb-1 text-[11px] text-mono-light leading-snug">
                Pending workspaces: accept via your invite email.
              </p>
            ) : null}
            {pendingInvites.map((p) => (
              <div
                key={p.id}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-mono-medium"
              >
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${badgeClass("pending")}`}>
                  Pending
                </span>
              </div>
            ))}
            {orgs.length === 0 && pendingInvites.length === 0 ? (
              <p className="px-2 py-2 text-sm text-mono-light">No workspaces yet.</p>
            ) : null}
          </>
        )}
      </div>

      <div className="px-2 border-t border-bg-tertiary/60 pt-2">
        <button
          type="button"
          disabled={creating}
          onClick={() => void createWorkspace()}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-sovereign-blue hover:bg-sovereign-blue/8 disabled:opacity-50"
        >
          <span
            className="material-symbols-rounded text-[18px]"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
          >
            add
          </span>
          {creating ? "Creating…" : "New workspace"}
        </button>
      </div>

      <div className="px-2 pt-1 border-t border-bg-tertiary/60 mt-1">
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="w-full text-left rounded-lg px-2 py-2 text-sm text-mono-medium hover:bg-mono-dark/[0.04]"
        >
          Log out
        </button>
      </div>

      {error ? <p className="px-4 pt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  ) : null;

  return (
    <div ref={rootRef} className={`relative min-w-0 ${layout === "mobile" ? "w-full" : "max-w-full"}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Workspace: ${triggerLabel}. Open menu.`}
        className="inline-flex min-w-0 max-w-full items-center gap-1 text-left rounded-md -mx-1 px-1 py-0.5 hover:bg-mono-dark/[0.04] focus:outline-none focus:ring-2 focus:ring-sovereign-blue/25"
      >
        <span className="truncate text-[15px] font-semibold text-mono-dark">{triggerLabel}</span>
        <span
          className={`material-symbols-rounded shrink-0 text-[20px] text-mono-medium transition-transform ${
            open ? "rotate-180" : ""
          }`}
          style={{ fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
          aria-hidden
        >
          expand_more
        </span>
      </button>
      {panel}
    </div>
  );
}
