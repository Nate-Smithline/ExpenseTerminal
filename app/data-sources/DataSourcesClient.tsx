"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import type { Database } from "@/lib/types/database";
import type { DataSourceStats } from "./page";

type DataSource = Database["public"]["Tables"]["data_sources"]["Row"];

const ACCOUNT_TYPES = [
  { value: "checking", label: "Business Checking" },
  { value: "credit", label: "Business Credit Card" },
  { value: "savings", label: "Business Savings" },
  { value: "other", label: "Other" },
];

function accountTypeLabel(type: string): string {
  return ACCOUNT_TYPES.find((a) => a.value === type)?.label ?? type;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function sourceTypeLabel(sourceType: string): string {
  return sourceType === "stripe" || sourceType === "plaid" ? "Direct Feed" : "Manual";
}

function isDirectFeed(sourceType: string): boolean {
  return sourceType === "stripe" || sourceType === "plaid";
}

function formatLastPulled(source: DataSource): string | null {
  if (isDirectFeed(source.source_type)) {
    const t = source.last_successful_sync_at;
    if (!t) return "Never";
    try {
      return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "Never";
    }
  }
  return null;
}

/** Payload from POST /api/data-sources/sync (matches server diagnostics). */
type SyncDiag = {
  transactionCountForDataSource: number;
  rawTransactionsFromStripe?: number;
  postedIncludedInSync?: number;
  upsertCallsSucceeded?: number;
  statusBreakdown?: Record<string, number>;
  apiListPages?: number;
  startDateExceedsFcLookback?: boolean;
  earliestTransactionDateReturned?: string | null;
  addedCount?: number;
  modifiedCount?: number;
  removedCount?: number;
  upsertedCount?: number;
  updatedCount?: number;
  deletedCount?: number;
  syncPages?: number;
};

function logSyncDiagnostics(d: SyncDiag | undefined) {
  if (!d) return;
  console.info("[ExpenseTerminal] Sync diagnostics", d);
}

function syncStatusMessage(d: SyncDiag | undefined): string {
  if (!d) return "Sync complete";
  if (d.addedCount != null) {
    return `Sync complete · ${d.addedCount} new, ${d.updatedCount ?? 0} updated, ${d.deletedCount ?? 0} removed · ${d.transactionCountForDataSource} total in app`;
  }
  const pages = d.apiListPages ?? 0;
  let msg = `Sync complete · ${pages} request(s) · ${d.rawTransactionsFromStripe ?? 0} rows → ${d.upsertCallsSucceeded ?? 0} saved · ${d.transactionCountForDataSource} total in app`;
  if (d.startDateExceedsFcLookback) {
    const earliest = d.earliestTransactionDateReturned ?? "unknown";
    msg += ` · Start date is >180 days ago — only returned data from ${earliest}.`;
  }
  return msg;
}


function formatMonthDayOrdinal(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Unknown";
  const day = d.getDate();
  const dayPadded = String(day).padStart(2, "0");
  const mod10 = day % 10;
  const mod100 = day % 100;
  const suffix =
    mod10 === 1 && mod100 !== 11
      ? "st"
      : mod10 === 2 && mod100 !== 12
        ? "nd"
        : mod10 === 3 && mod100 !== 13
          ? "rd"
          : "th";
  const month = d.toLocaleDateString("en-US", { month: "short" });
  return `${month} ${dayPadded}${suffix}`;
}

export function DataSourcesClient({
  initialSources,
  initialStats = {},
}: {
  initialSources: DataSource[];
  initialStats?: Record<string, DataSourceStats>;
}) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const searchParams = useSearchParams();
  const debugCallouts = searchParams.get("debug_callouts") === "1";
  const [sources, setSources] = useState<DataSource[]>(initialSources);
  const [stats, setStats] = useState<Record<string, DataSourceStats>>(initialStats);

  useEffect(() => {
    setSources(initialSources);
    setStats(initialStats);
  }, [initialSources, initialStats]);

  const err = searchParams.get("error");
  const openAdd = searchParams.get("add");
  const prevParamsRef = useRef<string>("");
  const [showPostConnectDateModal, setShowPostConnectDateModal] = useState(false);
  const [loadingNewAccounts, setLoadingNewAccounts] = useState(false);

  useEffect(() => {
    const key = `${err ?? ""}`;
    if (key === prevParamsRef.current) return;
    prevParamsRef.current = key;
    if (err) {
      setToast(decodeURIComponent(err));
      setTimeout(() => setToast(null), 6000);
      router.replace("/data-sources", { scroll: false });
    }
  }, [err, router]);

  // ?add=1 deep-link → kick off Plaid directly (handled after hook is set up below)
  const [autoOpenPending, setAutoOpenPending] = useState(openAdd === "1");

  const [toast, setToast] = useState<string | null>(null);
  const [editSource, setEditSource] = useState<DataSource | null>(null);
  const [editName, setEditName] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Plaid state
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);
  const [plaidInitLoading, setPlaidInitLoading] = useState(false);   // fetching token / waiting for Plaid to open
  const [plaidExchangeLoading, setPlaidExchangeLoading] = useState(false); // after Plaid closes, saving account
  const [plaidConnectError, setPlaidConnectError] = useState<string | null>(null);
  const [pendingPlaidOpen, setPendingPlaidOpen] = useState(false);

  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, "good" | "login_required" | "error" | "disconnected" | "inactive" | null>>({});
  const [deleteConfirmSource, setDeleteConfirmSource] = useState<DataSource | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pullDatesBySource, setPullDatesBySource] = useState<Record<string, { start: string; end: string }>>({});
  const [pullModalSource, setPullModalSource] = useState<DataSource | null>(null);
  type SyncStatusBar = { message: string; type: "syncing" | "success" | "error" } | null;
  const [syncStatusBar, setSyncStatusBar] = useState<SyncStatusBar>(null);
  const [postConnectPulling, setPostConnectPulling] = useState(false);
  const [postConnectError, setPostConnectError] = useState<string | null>(null);
  const [postConnectStep, setPostConnectStep] = useState<"years" | "pulling" | "categorizing">("years");
  const [postConnectSelectedYears, setPostConnectSelectedYears] = useState<number[]>([]);
  // Error modal — shown only when Plaid fails and we need to display the error
  const [showErrorModal, setShowErrorModal] = useState(false);

  const hasPlaid = sources.some((s) => s.source_type === "plaid");
  const hasStripeLegacy = sources.some((s) => s.source_type === "stripe");
  const hasDirectFeed = sources.some((s) => isDirectFeed(s.source_type));

  useEffect(() => {
    if (showPostConnectDateModal) setPostConnectError(null);
  }, [showPostConnectDateModal]);

  // ── Plaid Link (mounted at top level — no modal required to trigger it) ──

  async function reloadSources() {
    const res = await fetch("/api/data-sources", { cache: "no-store" });
    if (res.ok) {
      const { data } = await res.json();
      setSources(data ?? []);
    }
    router.refresh();
  }

  const { open: openPlaid, ready: plaidReady } = usePlaidLink({
    token: plaidLinkToken,
    onSuccess: async (publicToken: string, metadata: any) => {
      // Plaid UI closed — show exchange loading overlay
      setPlaidInitLoading(false);
      setPlaidExchangeLoading(true);
      setPlaidConnectError(null);
      try {
        const res = await fetch("/api/data-sources/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token: publicToken, metadata }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          setPlaidConnectError(null);
          setPlaidLinkToken(null);
          setToast("Bank account(s) connected.");
          setTimeout(() => setToast(null), 5000);
          await reloadSources();
          // Determine default year selection: if today is past Dec 31 of taxYear,
          // the year is complete — offer only that year. Otherwise also offer the prior year.
          const now = new Date();
          const yearIsPast = now > new Date(currentYear, 11, 31);
          setPostConnectSelectedYears(yearIsPast ? [currentYear] : [currentYear, currentYear - 1]);
          setPostConnectStep("years");
          setShowPostConnectDateModal(true);
        } else {
          setPlaidConnectError(data.error ?? "Could not save account.");
          setShowErrorModal(true);
        }
      } catch (e) {
        setPlaidConnectError(e instanceof Error ? e.message : "Exchange failed");
        setShowErrorModal(true);
      } finally {
        setPlaidExchangeLoading(false);
      }
    },
    onExit: () => {
      // User closed Plaid without completing — just clear loading
      setPlaidInitLoading(false);
      setPendingPlaidOpen(false);
    },
  });

  // Auto-open Plaid as soon as we have a token and the hook is ready
  useEffect(() => {
    if (!pendingPlaidOpen || !plaidLinkToken || !plaidReady) return;
    setPendingPlaidOpen(false);
    setPlaidInitLoading(false);
    openPlaid();
  }, [pendingPlaidOpen, plaidLinkToken, plaidReady, openPlaid]);

  /** Fetch a link token and immediately open Plaid Link — no modal. */
  async function handleAddAccount() {
    setPlaidConnectError(null);
    setShowErrorModal(false);
    setPlaidInitLoading(true);
    setPendingPlaidOpen(true);
    // If we already have a token and Plaid is ready, open immediately
    if (plaidLinkToken && plaidReady) {
      setPendingPlaidOpen(false);
      setPlaidInitLoading(false);
      openPlaid();
      return;
    }
    try {
      const res = await fetch("/api/data-sources/plaid/create-link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.link_token) {
        setPlaidLinkToken(data.link_token);
        // pendingPlaidOpen=true → effect auto-opens when plaidReady fires
      } else {
        setPlaidConnectError(data.error ?? "Could not create link token");
        setPlaidInitLoading(false);
        setPendingPlaidOpen(false);
        setShowErrorModal(true);
      }
    } catch (e) {
      setPlaidConnectError(e instanceof Error ? e.message : "Connection failed");
      setPlaidInitLoading(false);
      setPendingPlaidOpen(false);
      setShowErrorModal(true);
    }
  }

  // Handle ?add=1 deep-link
  useEffect(() => {
    if (!autoOpenPending) return;
    setAutoOpenPending(false);
    router.replace("/data-sources", { scroll: false });
    handleAddAccount();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenPending]);

  // ── Connection status polling ─────────────────────────────────────────────

  const directFeedIdsRef = useRef<string>("");
  useEffect(() => {
    const directFeedSources = sources.filter((s) => isDirectFeed(s.source_type));
    const ids = directFeedSources.map((s) => s.id);
    const key = ids.sort().join(",");
    if (ids.length === 0 || key === directFeedIdsRef.current) return;
    directFeedIdsRef.current = key;
    const updates: Record<string, "good" | "login_required" | "error" | "disconnected" | "inactive"> = {};
    let pending = ids.length;
    directFeedSources.forEach((s) => {
      const statusUrl = `/api/data-sources/plaid/status?data_source_id=${encodeURIComponent(s.id)}`;
      fetch(statusUrl)
        .then((r) => r.json())
        .then((body) => {
          if (body.status && body.status !== "n/a") updates[s.id] = body.status;
        })
        .catch(() => {})
        .finally(() => {
          pending--;
          if (pending === 0 && Object.keys(updates).length > 0) {
            setConnectionStatuses((prev) => ({ ...prev, ...updates }));
          }
        });
    });
  }, [sources]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  const closeEdit = useCallback(() => setEditSource(null), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showErrorModal) { setShowErrorModal(false); setPlaidConnectError(null); }
        if (editSource) closeEdit();
        if (pullModalSource) setPullModalSource(null);
        if (deleteConfirmSource) setDeleteConfirmSource(null);
        if (showPostConnectDateModal) {
          setShowPostConnectDateModal(false);
          setPostConnectError(null);
        }
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "a" && !showErrorModal && !editSource) {
        e.preventDefault();
        handleAddAccount();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [
    showErrorModal,
    editSource,
    pullModalSource,
    deleteConfirmSource,
    showPostConnectDateModal,
    closeEdit,
  ]);

  // ── Sync helpers ──────────────────────────────────────────────────────────

  async function handleRetrySync(sourceId: string) {
    const source = sources.find((s) => s.id === sourceId);
    setSyncingId(sourceId);
    setSyncStatusBar({ message: `Syncing transactions for ${source?.name ?? "account"}…`, type: "syncing" });
    try {
      const res = await fetch("/api/data-sources/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data_source_id: sourceId }),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { diagnostics?: SyncDiag; plaidDiagnostics?: SyncDiag };
        const diag = data.plaidDiagnostics ?? data.diagnostics;
        logSyncDiagnostics(diag);
        await reloadSources();
        window.dispatchEvent(new CustomEvent("inbox-count-changed"));
        setSyncStatusBar({ message: syncStatusMessage(diag), type: "success" });
        setTimeout(() => setSyncStatusBar(null), 8000);
      } else {
        const data = await res.json().catch(() => ({}));
        setSyncStatusBar({ message: data.error ?? "Sync failed", type: "error" });
        setToast(data.error ?? "Sync failed");
        setTimeout(() => setToast(null), 4000);
        setTimeout(() => setSyncStatusBar(null), 5000);
      }
    } finally {
      setSyncingId(null);
    }
  }

  function openEdit(source: DataSource) {
    setEditSource(source);
    setEditName(source.name);
  }

  async function handleSaveEdit() {
    if (!editSource) return;
    const trimmedName = editName.trim();
    if (!trimmedName) return;
    setEditSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/data-sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editSource.id,
          name: trimmedName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.data) {
        setSources((prev) => prev.map((s) => (s.id === data.data.id ? { ...s, ...data.data } : s)));
        setEditSource(null);
        setToast("Account updated.");
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast(data?.error ?? "Failed to update account");
        setTimeout(() => setToast(null), 5000);
      }
    } finally {
      setEditSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div className="space-y-3">
          <div>
            <div
              role="heading"
              aria-level={1}
              className="text-[32px] leading-tight font-sans font-normal text-mono-dark"
            >
              Accounts
            </div>
            <p className="text-base text-mono-medium mt-1 font-sans">
              Connect your bank to automatically import transactions.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleAddAccount}
            disabled={plaidInitLoading}
            className="inline-flex items-center px-4 py-2.5 text-sm font-medium font-sans bg-black text-white rounded-none hover:bg-black/85 transition-colors disabled:opacity-60"
          >
            <kbd className="mr-2.5 inline-flex items-center justify-center border border-mono-medium bg-white/30 px-1.5 py-0.5 text-[11px] font-mono text-white">
              a
            </kbd>
            {plaidInitLoading ? "Connecting…" : "Add Account"}
          </button>
        </div>
      </div>

      {(syncStatusBar || debugCallouts) && (
        <div
          role="status"
          className={`flex items-center gap-3 rounded-none border px-4 py-3 text-sm ${
            (syncStatusBar ?? { type: "syncing" }).type === "syncing"
              ? "border-[#8A9BB0]/40 bg-[#E8EEF5] text-mono-dark"
              : (syncStatusBar ?? { type: "syncing" }).type === "success"
                ? "border-[#16A34A]/30 bg-[#DCFCE7] text-mono-dark"
                : "border-[#D97706]/30 bg-[#FEF3C7] text-mono-dark"
          }`}
        >
          {(syncStatusBar ?? { type: "syncing" }).type === "syncing" && (
            <span className="material-symbols-rounded animate-spin text-lg text-[#8A9BB0]">progress_activity</span>
          )}
          {(syncStatusBar ?? { type: "syncing" }).type === "success" && (
            <span className="material-symbols-rounded text-lg text-[#16A34A]">check_circle</span>
          )}
          {(syncStatusBar ?? { type: "syncing" }).type === "error" && (
            <span className="material-symbols-rounded text-lg text-[#D97706]">error</span>
          )}
          <span className="font-medium">
            {(syncStatusBar ?? { message: "Syncing transactions…", type: "syncing" }).message}
          </span>
        </div>
      )}

      {debugCallouts && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-none border px-4 py-3 text-sm border-[#16A34A]/30 bg-[#DCFCE7] text-mono-dark"
        >
          <span className="material-symbols-rounded text-lg text-[#16A34A]">check_circle</span>
          <span className="font-medium">Saved</span>
        </div>
      )}

      {/* ── Full-screen loading: fetching token / waiting for Plaid to open ── */}
      {plaidInitLoading && (
        <div className="fixed inset-0 min-h-[100dvh] z-[70] flex flex-col items-center justify-center bg-white/90 backdrop-blur-[2px] gap-5">
          <span className="material-symbols-rounded animate-spin text-4xl text-mono-medium">progress_activity</span>
          <div className="text-center space-y-1">
            <p className="text-base font-medium text-mono-dark">Opening your bank…</p>
            <p className="text-sm text-mono-medium">Select your bank and accounts in the window that opens.</p>
          </div>
        </div>
      )}

      {/* ── Full-screen loading: exchanging token / saving account ── */}
      {plaidExchangeLoading && (
        <div className="fixed inset-0 min-h-[100dvh] z-[70] flex flex-col items-center justify-center bg-white/90 backdrop-blur-[2px] gap-5">
          <span className="material-symbols-rounded animate-spin text-4xl text-mono-medium">progress_activity</span>
          <div className="text-center space-y-1">
            <p className="text-base font-medium text-mono-dark">Setting up your account…</p>
            <p className="text-sm text-mono-medium">This only takes a moment.</p>
          </div>
        </div>
      )}

      {/* ── Error modal — only shown when connection attempt fails ── */}
      {showErrorModal && plaidConnectError && (
        <div
          className="fixed inset-0 min-h-[100dvh] z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="connect-error-title"
        >
          <div className="rounded-none bg-white shadow-xl max-w-md w-full mx-4 overflow-hidden border-0">
            <div className="px-6 pt-6 pb-0 flex items-start justify-between">
              <h2
                id="connect-error-title"
                className="text-xl text-mono-dark font-medium"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                Connection failed
              </h2>
              <button
                type="button"
                onClick={() => { setShowErrorModal(false); setPlaidConnectError(null); }}
                className="p-1 -mr-1 text-mono-light hover:text-mono-dark"
                aria-label="Close"
              >
                <span className="material-symbols-rounded text-xl leading-none">close</span>
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-red-600">{plaidConnectError}</p>
            </div>
            <div className="px-6 pt-2 pb-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowErrorModal(false); setPlaidConnectError(null); }}
                className="px-4 py-2.5 text-sm font-medium font-sans bg-[#F0F1F7] text-mono-dark rounded-none hover:bg-[#E4E7F0] transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => { setShowErrorModal(false); handleAddAccount(); }}
                className="px-4 py-2.5 text-sm font-medium font-sans bg-[#2563EB] text-white rounded-none hover:bg-[#1D4ED8] transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit account modal ── */}
      {editSource && (
        <div
          className="fixed inset-0 min-h-[100dvh] z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-account-title"
        >
          <div className="rounded-none bg-white shadow-xl max-w-md w-full mx-4 overflow-hidden border-0">
            <div className="bg-white px-6 pt-6 pb-1 flex items-start">
              <h2
                id="edit-account-title"
                className="text-xl text-black font-medium"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                Edit account
              </h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editName.trim() && !editSaving) handleSaveEdit();
              }}
            >
              <div className="px-6 py-3 space-y-3">
                <div>
                  <label className="text-sm font-medium text-black block mb-2">Name *</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. Chase Business Checking"
                    className="w-full border px-4 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none border-bg-tertiary/60"
                  />
                </div>
              </div>
              <div className="px-6 pt-2 pb-6 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmSource(editSource)}
                  disabled={editSaving}
                  className="px-4 py-2.5 text-sm font-medium font-sans bg-[#FEE2E2] text-[#DC2626] rounded-none hover:bg-[#FECACA] transition-colors disabled:opacity-40"
                >
                  Delete
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditSource(null)}
                    disabled={editSaving}
                    className="px-4 py-2.5 text-sm font-medium font-sans bg-white text-mono-dark border border-black rounded-none hover:bg-bg-secondary/40 transition-colors disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSaving || !editName.trim()}
                    className="px-4 py-2.5 text-sm font-medium font-sans bg-black text-white rounded-none hover:bg-black/85 disabled:opacity-50 transition-colors"
                  >
                    {editSaving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Pull transactions (date range) modal ── */}
      {pullModalSource && (() => (
        <div
          className="fixed inset-0 min-h-[100dvh] z-[60] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pull-transactions-title"
        >
          <div className="rounded-none bg-white shadow-xl max-w-md w-full mx-4 overflow-hidden border-0">
            <div className="bg-white px-6 pt-6 pb-1 flex items-start">
              <h2 id="pull-transactions-title" className="text-xl text-black font-medium" style={{ fontFamily: "var(--font-sans)" }}>
                Pull transactions
              </h2>
            </div>
            <div className="px-6 py-3 space-y-3">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-black mb-1">From date</label>
                  <input
                    type="date"
                    value={pullDatesBySource[pullModalSource.id]?.start ?? ""}
                    onChange={(e) => setPullDatesBySource((prev) => ({ ...prev, [pullModalSource.id]: { ...(prev[pullModalSource.id] ?? { start: "", end: "" }), start: e.target.value } }))}
                    className="w-full border px-4 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none border-bg-tertiary/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-black mb-1">To date</label>
                  <input
                    type="date"
                    value={pullDatesBySource[pullModalSource.id]?.end ?? ""}
                    onChange={(e) => setPullDatesBySource((prev) => ({ ...prev, [pullModalSource.id]: { ...(prev[pullModalSource.id] ?? { start: "", end: "" }), end: e.target.value } }))}
                    className="w-full border px-4 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none border-bg-tertiary/60"
                  />
                </div>
              </div>
              <p className="text-xs text-black/70">Leave dates empty to use default range. Duplicates are not added.</p>
            </div>
            <div className="px-6 pt-2 pb-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPullModalSource(null)}
                disabled={syncingId === pullModalSource.id}
                className="px-4 py-2.5 text-sm font-medium font-sans bg-[#F0F1F7] text-mono-dark rounded-none hover:bg-[#E4E7F0] transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setSyncingId(pullModalSource.id);
                  setSyncStatusBar({ message: `Syncing transactions for ${pullModalSource.name}…`, type: "syncing" });
                  try {
                    const d = pullDatesBySource[pullModalSource.id];
                    const res = await fetch("/api/data-sources/sync", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        data_source_id: pullModalSource.id,
                        start_date: d?.start || undefined,
                        end_date: d?.end || undefined,
                      }),
                    });
                    if (res.ok) {
                      const data = (await res.json().catch(() => ({}))) as { message?: string; diagnostics?: SyncDiag; plaidDiagnostics?: SyncDiag };
                      const diag = data.plaidDiagnostics ?? data.diagnostics;
                      logSyncDiagnostics(diag);
                      setPullModalSource(null);
                      await reloadSources();
                      window.dispatchEvent(new CustomEvent("inbox-count-changed"));
                      setSyncStatusBar({ message: syncStatusMessage(diag), type: "success" });
                      setTimeout(() => setSyncStatusBar(null), 8000);
                      setToast(data.message ?? "Sync completed. Duplicates are skipped.");
                      setTimeout(() => setToast(null), 4000);
                    } else {
                      const data = await res.json().catch(() => ({}));
                      setSyncStatusBar({ message: data.error ?? "Sync failed", type: "error" });
                      setTimeout(() => setSyncStatusBar(null), 5000);
                      setToast(data.error ?? "Sync failed");
                      setTimeout(() => setToast(null), 4000);
                    }
                  } finally {
                    setSyncingId(null);
                  }
                }}
                disabled={syncingId === pullModalSource.id}
                className="px-4 py-2.5 text-sm font-medium font-sans bg-[#2563EB] text-white rounded-none hover:bg-[#1D4ED8] transition-colors disabled:opacity-40"
              >
                {syncingId === pullModalSource.id ? "Pulling…" : "Pull transactions"}
              </button>
            </div>
          </div>
        </div>
      ))()}

      {/* ── Delete account confirmation modal ── */}
      {deleteConfirmSource && (
        <div
          className="fixed inset-0 min-h-[100dvh] z-[60] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          <div className="rounded-none bg-white shadow-xl max-w-md w-full mx-4 overflow-hidden border-0">
            <div className="bg-white px-6 pt-6 pb-1 flex items-start">
              <h2 id="delete-confirm-title" className="text-xl text-black font-medium" style={{ fontFamily: "var(--font-sans)" }}>
                Delete account?
              </h2>
            </div>
            <div className="px-6 py-3 space-y-3">
              <p className="text-xs text-black">
                Are you sure you want to delete <strong>{deleteConfirmSource.name}</strong>? All transactions from this account will be permanently removed. This cannot be undone.
              </p>
            </div>
            <div className="px-6 pt-2 pb-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmSource(null)}
                disabled={deleteLoading}
                className="px-4 py-2.5 text-sm font-medium font-sans bg-[#F0F1F7] text-mono-dark rounded-none hover:bg-[#E4E7F0] transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setDeleteLoading(true);
                  try {
                    const res = await fetch("/api/data-sources", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: deleteConfirmSource.id }),
                    });
                    if (res.ok) {
                      const removedId = deleteConfirmSource.id;
                      setSources((prev) => prev.filter((s) => s.id !== removedId));
                      setDeleteConfirmSource(null);
                      setEditSource(null);
                      window.dispatchEvent(new CustomEvent("inbox-count-changed"));
                      setToast("Account deleted.");
                      setTimeout(() => setToast(null), 3000);
                    } else {
                      const data = await res.json().catch(() => ({}));
                      setToast(data.error ?? "Failed to delete");
                      setTimeout(() => setToast(null), 4000);
                    }
                  } finally {
                    setDeleteLoading(false);
                  }
                }}
                disabled={deleteLoading}
                className="px-4 py-2.5 text-sm font-medium font-sans bg-[#FEE2E2] text-[#DC2626] rounded-none hover:bg-[#FECACA] transition-colors disabled:opacity-40"
              >
                {deleteLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Post-connect: year selection → pull → auto-categorize ── */}
      {showPostConnectDateModal && (() => {
        const unsyncedSources = sources.filter(
          (s) => isDirectFeed(s.source_type) && s.last_successful_sync_at == null
        );
        if (unsyncedSources.length === 0) return null;

        // Available years: if taxYear is fully in the past, only that year;
        // otherwise also offer the prior year.
        const now = new Date();
        const yearIsPast = now > new Date(currentYear, 11, 31);
        const yearOptions = yearIsPast ? [currentYear] : [currentYear, currentYear - 1];

        const isLoading = postConnectStep === "pulling" || postConnectStep === "categorizing";

        async function handlePull() {
          setPostConnectStep("pulling");
          setPostConnectError(null);
          setPostConnectPulling(true);
          try {
            const failed: { name: string }[] = [];
            let lastDiag: SyncDiag | undefined;

            for (const year of postConnectSelectedYears.sort()) {
              const startDate = `${year}-01-01`;
              const endDate = `${year}-12-31`;
              for (const source of unsyncedSources) {
                const res = await fetch("/api/data-sources/sync", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ data_source_id: source.id, start_date: startDate, end_date: endDate }),
                });
                if (res.ok) {
                  const data = (await res.json().catch(() => ({}))) as { diagnostics?: SyncDiag; plaidDiagnostics?: SyncDiag };
                  const diag = data.plaidDiagnostics ?? data.diagnostics;
                  logSyncDiagnostics(diag);
                  lastDiag = diag ?? lastDiag;
                } else {
                  if (!failed.find((f) => f.name === source.name)) failed.push({ name: source.name });
                }
              }
            }

            await reloadSources();
            window.dispatchEvent(new CustomEvent("inbox-count-changed"));

            // ── Auto-categorize: fetch all new pending IDs then run AI ──
            setPostConnectStep("categorizing");
            try {
              const pendingRes = await fetch(
                `/api/transactions?status=pending&limit=1000&count_only=false`
              );
              const pendingBody = pendingRes.ok ? await pendingRes.json().catch(() => ({})) : {};
              const pendingIds: string[] = (pendingBody.data ?? []).map((t: { id: string }) => t.id);

              if (pendingIds.length > 0) {
                await fetch("/api/transactions/analyze", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ transactionIds: pendingIds.slice(0, 1000) }),
                });
                window.dispatchEvent(new CustomEvent("inbox-count-changed"));
              }
            } catch {
              // Non-fatal — transactions are pulled, AI categorization can be done from inbox
            }

            setShowPostConnectDateModal(false);
            const okCount = unsyncedSources.length - failed.length;
            if (okCount > 0) {
              setSyncStatusBar({
                message: failed.length > 0
                  ? `Loaded ${okCount} account${okCount === 1 ? "" : "s"}. ${failed.length} couldn't be loaded.`
                  : `Transactions loaded & categorized for ${okCount} account${okCount === 1 ? "" : "s"}.`,
                type: "success",
              });
              setToast(failed.length > 0
                ? `${failed.map((f) => f.name).join(", ")}: try again or use Repair connection.`
                : "Transactions loaded and sorted. Head to your Inbox to review.");
            } else if (failed.length > 0) {
              setSyncStatusBar({ message: "No accounts could be loaded. Try again or reconnect.", type: "error" });
            }
            setTimeout(() => setSyncStatusBar(null), 7000);
            setTimeout(() => setToast(null), 6000);
          } finally {
            setPostConnectPulling(false);
          }
        }

        return (
          <div
            className="fixed inset-0 min-h-[100dvh] z-[60] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="post-connect-date-title"
          >
            <div className="rounded-none bg-white shadow-xl max-w-md w-full mx-4 border-0 flex flex-col max-h-[90dvh]">
              {isLoading ? (
                <div className="px-6 py-12 flex flex-col items-center justify-center gap-4">
                  <span className="material-symbols-rounded animate-spin text-4xl text-black/40">progress_activity</span>
                  <h2 className="text-xl text-black font-medium text-center" style={{ fontFamily: "var(--font-sans)" }}>
                    {postConnectStep === "categorizing" ? "Categorizing transactions…" : "Importing transactions…"}
                  </h2>
                  <p className="text-xs text-black/70 text-center">
                    {postConnectStep === "categorizing"
                      ? "Applying rules and AI labels — this takes a moment."
                      : `Pulling ${postConnectSelectedYears.join(" & ")} data. This may take a minute.`}
                  </p>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="bg-white px-6 pt-6 pb-0 flex-none">
                    <h2 id="post-connect-date-title" className="text-xl text-black font-medium" style={{ fontFamily: "var(--font-sans)" }}>
                      Import transactions
                    </h2>
                    <p className="text-xs text-mono-medium mt-1">
                      Which tax years would you like to import?
                    </p>
                  </div>

                  {/* Body */}
                  <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
                    {/* Year picker */}
                    <div className="space-y-2">
                      {yearOptions.map((y) => {
                        const checked = postConnectSelectedYears.includes(y);
                        return (
                          <label
                            key={y}
                            className={`flex items-center gap-3 px-4 py-3 border cursor-pointer transition-colors ${
                              checked ? "border-black bg-[#F0F1F7]" : "border-[#F0F1F7] bg-white hover:bg-[#F8F8FB]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setPostConnectSelectedYears((prev) =>
                                  checked ? prev.filter((y2) => y2 !== y) : [...prev, y]
                                )
                              }
                              className="accent-black"
                            />
                            <div>
                              <span className="text-sm font-medium text-mono-dark">{y}</span>
                              {y === currentYear && !yearIsPast && (
                                <span className="ml-2 text-xs text-mono-light">current year</span>
                              )}
                              {y < currentYear || yearIsPast ? (
                                <span className="ml-2 text-xs text-mono-light">{y === currentYear ? "complete" : "prior year"}</span>
                              ) : null}
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    {/* Account list */}
                    <div>
                      <p className="text-xs text-mono-medium mb-2">Accounts to import</p>
                      <div className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7] max-h-[140px] overflow-y-auto">
                        {unsyncedSources.map((s) => (
                          <div key={s.id} className="px-4 py-2.5 text-sm text-mono-dark">{s.name}</div>
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-mono-light">
                      After importing, transactions will be automatically categorized using your rules and AI.
                    </p>

                    {postConnectError && (
                      <p className="text-xs text-[#B91C1C]">{postConnectError}</p>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-6 pt-2 pb-6 flex-none flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => { setShowPostConnectDateModal(false); setPostConnectError(null); }}
                      className="px-4 py-2.5 text-sm font-medium font-sans bg-[#F0F1F7] text-mono-dark rounded-none hover:bg-[#E4E7F0] transition-colors"
                    >
                      Skip for now
                    </button>
                    <button
                      type="button"
                      disabled={postConnectSelectedYears.length === 0}
                      onClick={handlePull}
                      className="px-4 py-2.5 text-sm font-medium font-sans bg-[#2563EB] text-white rounded-none hover:bg-[#1D4ED8] transition-colors disabled:opacity-40"
                    >
                      Import &amp; categorize
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {loadingNewAccounts && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <span className="material-symbols-rounded animate-spin text-3xl text-mono-medium">progress_activity</span>
          <p className="text-sm font-medium text-mono-dark">Loading your accounts…</p>
        </div>
      )}

      {sources.length === 0 && !loadingNewAccounts && (
        <div className="text-center py-20">
          <p className="text-base text-mono-medium mb-2">No accounts yet</p>
          <p className="text-sm text-mono-light">
            Connect a bank account to start importing transactions.
          </p>
        </div>
      )}

      {sources.length > 0 && !loadingNewAccounts && (
        <ul className="space-y-4">
          {sources.map((source) => {
            const s = stats[source.id] ?? {
              transactionCount: 0,
              totalIncome: 0,
              totalExpenses: 0,
              pctReviewed: 0,
              totalSavings: 0,
            };
            const totalTxCount = s.transactionCount ?? 0;
            const reviewedTxCount =
              totalTxCount > 0
                ? Math.round((Math.min(100, Math.max(0, s.pctReviewed ?? 0)) / 100) * totalTxCount)
                : 0;
            const hasSyncFailure = !!source.last_failed_sync_at;
            return (
              <li key={source.id} className="border border-[#F0F1F7] bg-white">
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium ${
                        isDirectFeed(source.source_type)
                          ? "bg-[#2563EB]/15 text-[#2563EB]"
                          : "bg-bg-tertiary text-mono-medium"
                      }`}
                    >
                      {sourceTypeLabel(source.source_type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-lg font-semibold text-mono-dark">{source.name}</p>
                    {source.is_mixed_account && (
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-[#F5F0E8] text-mono-medium uppercase tracking-wider">
                        Mixed
                      </span>
                    )}
                  </div>
                  {source.institution && (
                    <p className="text-sm text-mono-light">{source.institution}</p>
                  )}
                  {isDirectFeed(source.source_type) && (
                    <div className="text-xs text-mono-light mt-1 space-y-0.5">
                      {!source.last_successful_sync_at && totalTxCount === 0 && (
                        <p className="text-mono-medium">Pull transactions to load activity from your bank.</p>
                      )}
                      {source.source_type === "plaid" && (
                        <p className="text-mono-light">
                          Lookback: up to <span className="font-medium text-mono-dark">24 months</span> (varies by institution).
                        </p>
                      )}
                      {source.last_successful_sync_at && totalTxCount === 0 && (
                        <p className="text-mono-medium">Sync completed; no posted transactions in the selected date range.</p>
                      )}
                    </div>
                  )}
                  {isDirectFeed(source.source_type) && (
                    connectionStatuses[source.id] === "disconnected" ||
                    connectionStatuses[source.id] === "inactive" ||
                    connectionStatuses[source.id] === "login_required" ||
                    connectionStatuses[source.id] === "error" ||
                    !(source.financial_connections_account_id || source.plaid_item_id)
                  ) && (
                    <div className="mt-3 bg-[#F5F0E8] p-3">
                      <p className="text-sm font-medium text-mono-dark">
                        {!(source.financial_connections_account_id || source.plaid_item_id)
                          ? "This account isn't linked to a bank."
                          : "This connection is no longer active"}
                      </p>
                      <p className="text-xs text-mono-medium mt-1">Reconnect your bank to restore syncing</p>
                      <button
                        type="button"
                        onClick={handleAddAccount}
                        className="mt-2 bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-black/85"
                      >
                        Repair connection
                      </button>
                    </div>
                  )}
                  {hasSyncFailure && !(
                    isDirectFeed(source.source_type) && (
                      connectionStatuses[source.id] === "disconnected" ||
                      connectionStatuses[source.id] === "inactive" ||
                      connectionStatuses[source.id] === "login_required" ||
                      connectionStatuses[source.id] === "error" ||
                      !(source.financial_connections_account_id || source.plaid_item_id)
                    )
                  ) && (
                    <div className="mt-3 bg-[#F5F0E8] p-3">
                      <p className="text-sm font-medium text-mono-dark">We&apos;re having trouble syncing your account</p>
                      <p className="text-xs text-mono-medium mt-1">
                        {source.last_successful_sync_at
                          ? `Last synced ${formatMonthDayOrdinal(source.last_successful_sync_at)}`
                          : "Last synced Never"}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleRetrySync(source.id)}
                        disabled={syncingId === source.id}
                        className="mt-2 bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-black/85 disabled:opacity-50"
                      >
                        {syncingId === source.id ? "Syncing…" : "Retry sync"}
                      </button>
                    </div>
                  )}
                  {s.transactionCount > 0 && !hasSyncFailure && (
                    <>
                      <div className="mt-2">
                        <p className="text-xs text-mono-light mb-1.5">
                          <span className="tabular-nums font-medium text-mono-dark">{reviewedTxCount}</span>
                          <span className="tabular-nums"> / {totalTxCount}</span>
                          {" transactions"}
                          {isDirectFeed(source.source_type) && (
                            <>
                              <span className="mx-2">·</span>
                              <span className="tabular-nums">Synced: {formatLastPulled(source)}</span>
                            </>
                          )}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-none bg-[#F0F1F7] overflow-hidden">
                            <div
                              className="h-full rounded-none bg-[#8A9BB0] transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(0, s.pctReviewed))}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums font-medium text-mono-medium shrink-0">
                            {(s.pctReviewed ?? 0).toFixed(2)}% reviewed
                          </span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-xs text-mono-light">Est. savings</p>
                        <p className="text-base tabular-nums font-semibold text-accent-sage">
                          {formatCurrency(s.totalSavings)}
                        </p>
                      </div>
                    </>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/activity?data_source_id=${encodeURIComponent(source.id)}`}
                      className="inline-flex items-center gap-2 rounded-none border border-bg-tertiary/60 px-3 py-2 text-sm font-medium text-mono-medium hover:bg-bg-secondary/60 transition"
                    >
                      <span className="material-symbols-rounded leading-none" style={{ fontSize: 16 }}>list</span>
                      View transactions
                    </Link>
                    {isDirectFeed(source.source_type) &&
                      connectionStatuses[source.id] !== "disconnected" &&
                      connectionStatuses[source.id] !== "inactive" &&
                      connectionStatuses[source.id] !== "login_required" &&
                      connectionStatuses[source.id] !== "error" &&
                      (source.financial_connections_account_id || source.plaid_item_id) && (
                      <button
                        type="button"
                        onClick={() => setPullModalSource(source)}
                        className="inline-flex items-center gap-2 rounded-none bg-[#2563EB] px-3 py-2 text-sm font-medium text-white hover:opacity-90 transition"
                      >
                        <span className="material-symbols-rounded leading-none" style={{ fontSize: 16 }}>sync</span>
                        Pull Transactions
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(source)}
                      className="inline-flex items-center gap-2 rounded-none border border-bg-tertiary/60 px-3 py-2 text-sm font-medium text-mono-medium hover:bg-bg-secondary/60 transition"
                      aria-label="Edit account"
                    >
                      <span className="material-symbols-rounded leading-none" style={{ fontSize: 16 }}>edit</span>
                      Edit
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(toast || debugCallouts) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-none bg-[#5B82B4] text-black px-4 py-2.5 text-sm shadow-lg flex items-center gap-2">
          {toast ?? "Account deleted."}
          <Link href="/inbox" className="font-medium underline underline-offset-2 hover:no-underline">
            Open Inbox
          </Link>
        </div>
      )}
    </div>
  );
}
