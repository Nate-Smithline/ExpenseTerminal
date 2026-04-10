"use client";

import { useState, useEffect, useCallback } from "react";

const overlayClass =
  "fixed inset-0 z-[60] flex min-h-[100dvh] items-center justify-center bg-black/40 px-4 backdrop-blur-md";
const panelClass =
  "relative w-full max-w-md overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.18)]";
const headClass = "px-5 pt-5 pb-1";
const bodyClass = "px-5 py-3";
const footerClass = "flex justify-end gap-2 border-t border-black/[0.06] bg-[#fafafa]/80 px-5 py-4";
const btnPrimary =
  "rounded-full bg-[#0071e3] px-5 py-2.5 text-[15px] font-medium text-white transition hover:bg-[#0077ed] disabled:opacity-40";
const btnSecondary =
  "rounded-full bg-[#e5e5ea] px-5 py-2.5 text-[15px] font-medium text-[#1d1d1f] transition hover:bg-[#d8d8dc] disabled:opacity-40";
const choiceClass =
  "w-full rounded-xl border border-black/[0.10] px-4 py-3 text-left transition hover:bg-[#f5f5f7]";

type Visibility = "org" | "restricted";

export function AccountsShareModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>("org");
  const [canEdit, setCanEdit] = useState(false);
  const [draft, setDraft] = useState<Visibility>("org");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/orgs/accounts-page-visibility");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not load settings");
        return;
      }
      const v = data.visibility === "restricted" ? "restricted" : "org";
      setVisibility(v);
      setDraft(v);
      setCanEdit(Boolean(data.canEdit));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [open, onClose]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/orgs/accounts-page-visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save");
        return;
      }
      const v = data.visibility === "restricted" ? "restricted" : "org";
      setVisibility(v);
      setDraft(v);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className={overlayClass} role="dialog" aria-modal="true" aria-labelledby="accounts-share-title">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className={`${panelClass} z-10`}>
        <div className={headClass}>
          <h2 id="accounts-share-title" className="text-lg font-semibold text-[#1d1d1f]">
            Share Accounts page
          </h2>
        </div>
        <div className={bodyClass}>
          <p className="text-sm text-mono-medium leading-relaxed">
            Choose who in your workspace can open the Accounts page (bank feeds, balances, and uploads).
          </p>
          {loading ? (
            <p className="mt-4 text-sm text-mono-light">Loading…</p>
          ) : (
            <>
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              {canEdit ? (
                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    className={`${choiceClass} ${draft === "org" ? "border-[#0071e3] bg-[#f0f7ff]" : ""}`}
                    onClick={() => setDraft("org")}
                  >
                    <div className="text-[15px] font-medium text-[#1d1d1f]">All workspace members</div>
                    <div className="mt-1 text-xs text-mono-medium">
                      Everyone in the org can view and manage accounts.
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`${choiceClass} ${draft === "restricted" ? "border-[#0071e3] bg-[#f0f7ff]" : ""}`}
                    onClick={() => setDraft("restricted")}
                  >
                    <div className="text-[15px] font-medium text-[#1d1d1f]">Owners only</div>
                    <div className="mt-1 text-xs text-mono-medium">
                      Only workspace owners can open Accounts; other members are redirected to Home.
                    </div>
                  </button>
                </div>
              ) : (
                <p className="mt-4 text-sm text-mono-medium">
                  {visibility === "restricted"
                    ? "This page is limited to workspace owners. Ask an owner if you need access."
                    : "All workspace members can use this page. Only owners can change this setting."}
                </p>
              )}
            </>
          )}
        </div>
        <div className={footerClass}>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={saving}>
            {canEdit && draft !== visibility ? "Cancel" : "Close"}
          </button>
          {canEdit && !loading && (
            <button
              type="button"
              className={btnPrimary}
              onClick={save}
              disabled={saving || draft === visibility}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
