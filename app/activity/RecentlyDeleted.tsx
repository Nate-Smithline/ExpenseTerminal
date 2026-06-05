"use client";

import { useCallback, useEffect, useState } from "react";

interface DeletedTxn {
  id: string;
  vendor: string | null;
  amount: number | string | null;
  date: string | null;
  budget_line_id: string | null;
  deleted_at: string;
}

function fmtAmount(n: number | string | null): string {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  return Math.abs(v).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface RecentlyDeletedProps {
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
}

export function RecentlyDeleted({ open, onClose, onRestored }: RecentlyDeletedProps) {
  const [items, setItems] = useState<DeletedTxn[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions/deleted");
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Failed to load deleted transactions");
        setItems([]);
        return;
      }
      setItems(body?.transactions ?? []);
    } catch {
      setError("Failed to load deleted transactions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const restore = useCallback(
    async (id: string) => {
      setBusyId(id);
      setError(null);
      try {
        const res = await fetch("/api/transactions/deleted", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setError(body?.error ?? "Failed to restore transaction");
          return;
        }
        setItems((prev) => prev.filter((t) => t.id !== id));
        onRestored();
      } finally {
        setBusyId(null);
      }
    },
    [onRestored]
  );

  const purge = useCallback(async (id: string) => {
    if (!window.confirm("Permanently delete this transaction? This cannot be undone.")) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/transactions/deleted", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Failed to remove transaction");
        return;
      }
      setItems((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setBusyId(null);
    }
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recently deleted transactions"
      className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh]"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl p-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-bg-tertiary/60 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Recently deleted</h2>
            <p className="text-xs text-mono-medium mt-0.5">
              Restore a transaction or remove it permanently.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-mono-medium hover:text-mono-dark text-xl leading-none px-2"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="px-5 py-3 text-sm text-red-600 border-b border-bg-tertiary/60">{error}</div>
        )}

        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <p className="px-5 py-8 text-sm text-mono-medium text-center">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-5 py-10 text-sm text-mono-medium text-center">
              No deleted transactions. Anything you delete will appear here so you can recover it.
            </p>
          ) : (
            <ul>
              {items.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-4 px-5 py-3 border-b border-bg-tertiary/40 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{t.vendor || "—"}</div>
                    <div className="text-xs text-mono-medium mt-0.5">
                      {t.date ? fmtWhen(t.date) : "—"} · deleted {fmtWhen(t.deleted_at)}
                    </div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums whitespace-nowrap">
                    {fmtAmount(t.amount)}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => restore(t.id)}
                      disabled={busyId === t.id}
                      className="inline-flex items-center rounded-none border border-bg-tertiary/60 px-3 py-1.5 text-xs font-medium hover:bg-bg-secondary/60 transition disabled:opacity-50"
                    >
                      {busyId === t.id ? "…" : "Restore"}
                    </button>
                    <button
                      type="button"
                      onClick={() => purge(t.id)}
                      disabled={busyId === t.id}
                      className="inline-flex items-center rounded-none border border-transparent px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
