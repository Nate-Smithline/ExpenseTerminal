"use client";

import { useCallback, useEffect, useState } from "react";

const appleOverlayClass =
  "fixed inset-0 z-[240] flex min-h-[100dvh] items-center justify-center bg-black/40 px-4 backdrop-blur-md";
const applePanelClass =
  "relative flex max-h-[min(90vh,520px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.18)]";
const appleModalHeadClass = "shrink-0 border-b border-black/[0.06] px-5 py-4";
const appleModalBodyClass = "min-h-0 flex-1 overflow-y-auto px-5 py-4";
const appleModalFooterClass = "flex shrink-0 justify-end gap-2 border-t border-black/[0.06] bg-[#fafafa]/80 px-5 py-4";
const appleBtnSecondary =
  "rounded-full bg-[#e5e5ea] px-5 py-2.5 text-[15px] font-medium text-[#1d1d1f] transition hover:bg-[#d8d8dc]";

/**
 * Org-level access for Accounts (mirrors page “Share” general access, without per-person invites).
 */
export function AccountsShareModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [visibility, setVisibility] = useState<"org" | "restricted">("org");
  const [canManage, setCanManage] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/data-sources/share");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to load");
      setVisibility((json as { visibility?: string }).visibility === "restricted" ? "restricted" : "org");
      setCanManage(Boolean((json as { can_manage?: boolean }).can_manage));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const setAccess = async (next: "org" | "restricted") => {
    if (!canManage) return;
    setError(null);
    try {
      const res = await fetch("/api/data-sources/share", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to update");
      setVisibility(next);
      setToast("Access updated");
      setTimeout(() => setToast(null), 2400);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update");
    }
  };

  if (!open) return null;

  return (
    <div className={appleOverlayClass} role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="accounts-share-title"
        className={applePanelClass}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={appleModalHeadClass}>
          <h2 id="accounts-share-title" className="text-[20px] font-semibold tracking-tight text-mono-dark">
            Share Accounts
          </h2>
          <p className="mt-1 text-sm text-mono-medium">Control who in your organization can open Accounts.</p>
        </div>

        <div className={appleModalBodyClass}>
          {loading ? (
            <div className="py-8 text-center text-sm text-mono-medium">Loading…</div>
          ) : (
            <>
              {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
              {!canManage && (
                <p className="mb-4 rounded-md bg-bg-secondary/60 px-3 py-2 text-sm text-mono-medium">
                  Only an organization owner can change this setting.
                </p>
              )}
              <div className="mb-2 text-xs font-medium text-mono-medium">General access</div>
              <div
                className="overflow-hidden rounded-xl border border-black/[0.08]"
                role="radiogroup"
                aria-label="Who can access Accounts"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={visibility === "org"}
                  disabled={!canManage}
                  onClick={() => setAccess("org")}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-[#f5f5f7] disabled:cursor-not-allowed disabled:opacity-60 ${
                    visibility === "org" ? "bg-[#f5f5f7]" : ""
                  }`}
                >
                  <span
                    className="material-symbols-rounded shrink-0 text-[20px] text-mono-medium"
                    style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}
                  >
                    groups
                  </span>
                  <span className="min-w-0 flex-1 font-medium text-mono-dark">Everyone in organization</span>
                  {visibility === "org" ? (
                    <span className="material-symbols-rounded shrink-0 text-[18px] text-mono-light">check</span>
                  ) : null}
                </button>
                <div className="h-px bg-black/[0.06]" />
                <button
                  type="button"
                  role="radio"
                  aria-checked={visibility === "restricted"}
                  disabled={!canManage}
                  onClick={() => setAccess("restricted")}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-[#f5f5f7] disabled:cursor-not-allowed disabled:opacity-60 ${
                    visibility === "restricted" ? "bg-[#f5f5f7]" : ""
                  }`}
                >
                  <span
                    className="material-symbols-rounded shrink-0 text-[20px] text-mono-medium"
                    style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}
                  >
                    lock_person
                  </span>
                  <span className="min-w-0 flex-1 font-medium text-mono-dark">Owners only</span>
                  {visibility === "restricted" ? (
                    <span className="material-symbols-rounded shrink-0 text-[18px] text-mono-light">check</span>
                  ) : null}
                </button>
              </div>
              <p className="mt-2 text-xs text-mono-light">
                {visibility === "org"
                  ? "All members of your active organization can open Accounts."
                  : "Only organization owners can open Accounts. Other members are redirected to Home."}
              </p>
            </>
          )}
        </div>

        <div className={appleModalFooterClass}>
          <button type="button" onClick={onClose} className={appleBtnSecondary}>
            Close
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[250] -translate-x-1/2 rounded-md bg-mono-dark px-4 py-2 text-[13px] text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
