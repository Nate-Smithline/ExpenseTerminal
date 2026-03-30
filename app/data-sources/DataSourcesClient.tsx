"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import type { Database } from "@/lib/types/database";
import { UploadModal } from "@/components/UploadModal";
import { TaxYearSelector } from "@/components/TaxYearSelector";
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
  // Stripe legacy fields
  rawTransactionsFromStripe?: number;
  postedIncludedInSync?: number;
  upsertCallsSucceeded?: number;
  statusBreakdown?: Record<string, number>;
  apiListPages?: number;
  startDateExceedsFcLookback?: boolean;
  earliestTransactionDateReturned?: string | null;
  // Plaid fields
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
  // Plaid diagnostics
  if (d.addedCount != null) {
    return `Sync complete · ${d.addedCount} new, ${d.updatedCount ?? 0} updated, ${d.deletedCount ?? 0} removed · ${d.transactionCountForDataSource} total in app`;
  }
  // Stripe legacy diagnostics
  const pages = d.apiListPages ?? 0;
  let msg = `Sync complete · ${pages} request(s) · ${d.rawTransactionsFromStripe ?? 0} rows → ${d.upsertCallsSucceeded ?? 0} saved · ${d.transactionCountForDataSource} total in app`;
  if (d.startDateExceedsFcLookback) {
    const earliest = d.earliestTransactionDateReturned ?? "unknown";
    msg += ` · Start date is >180 days ago — only returned data from ${earliest}. Upload a bank CSV for older transactions.`;
  }
  return msg;
}

/** Compact date for cards, e.g. "Mar 18, 2025". */
function formatEarliestCompact(iso: string): string {
  const parts = iso.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Oldest tx is already near the start of the calendar tax year — no need to surface “how far back” copy.
 * Uses Mar 1 as the cutoff (Jan–Feb = well covered from the year’s opening).
 */
function isEarliestNearStartOfTaxYear(iso: string, taxYear: number): boolean {
  const parts = iso.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return false;
  const earliest = new Date(y, m - 1, d);
  const marchFirst = new Date(taxYear, 2, 1);
  return earliest < marchFirst;
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

/** Wrapper that fetches a link token (if needed) and opens Plaid Link. */
function PlaidLinkButton({
  plaidLinkToken,
  loading,
  onClose,
  onBeforeOpen,
  onRequestToken,
  onSuccess,
  onExit,
}: {
  plaidLinkToken: string | null;
  loading: boolean;
  onClose: () => void;
  onBeforeOpen?: () => void;
  onRequestToken: () => void;
  onSuccess: (publicToken: string, metadata: any) => void;
  onExit: () => void;
}) {
  const [pendingOpen, setPendingOpen] = useState(false);
  const { open, ready } = usePlaidLink({
    token: plaidLinkToken,
    onSuccess,
    onExit,
  });

  // If the user clicked "Connect Bank" before we had a token, automatically open
  // Plaid Link as soon as the token is set and Link is ready.
  useEffect(() => {
    if (!pendingOpen) return;
    if (!plaidLinkToken) return;
    if (!ready) return;
    onBeforeOpen?.();
    open();
    setPendingOpen(false);
  }, [pendingOpen, plaidLinkToken, ready, open, onBeforeOpen]);

  return (
    <div className="px-6 pt-2 pb-6 flex justify-end gap-3">
      <button
        onClick={onClose}
        disabled={loading}
        className="px-4 py-2.5 text-sm font-medium font-sans bg-[#F0F1F7] text-mono-dark rounded-none hover:bg-[#E4E7F0] transition-colors disabled:opacity-40"
      >
        Close
      </button>
      <button
        onClick={() => {
          if (loading) return;
          setPendingOpen(true);
          if (plaidLinkToken && ready) {
            onBeforeOpen?.();
            open();
            setPendingOpen(false);
          } else {
            onRequestToken();
          }
        }}
        disabled={loading}
        className="px-4 py-2.5 text-sm font-medium font-sans bg-[#2563EB] text-white rounded-none hover:bg-[#1D4ED8] transition-colors disabled:opacity-40"
      >
        {loading ? "Connecting\u2026" : "Connect Bank"}
      </button>
    </div>
  );
}

export function DataSourcesClient({
  initialSources,
  initialStats = {},
  taxYear,
}: {
  initialSources: DataSource[];
  initialStats?: Record<string, DataSourceStats>;
  /** Tax year used for earliest-date-on-card and transaction queries (cookie / profile). */
  taxYear: number;
}) {
  const router = useRouter();
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

  useEffect(() => {
    if (openAdd !== "1") return;
    setShowAdd(true);
    router.replace("/data-sources", { scroll: false });
  }, [openAdd, router]);

  const [showAdd, setShowAdd] = useState(false);
  type AddStep = "1" | "2a" | "2b";
  const [addStep, setAddStep] = useState<AddStep>("1");
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState("checking");
  const [institution, setInstitution] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadSourceId, setUploadSourceId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editSource, setEditSource] = useState<DataSource | null>(null);
  const [editName, setEditName] = useState("");
  const [editInstitution, setEditInstitution] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  // Bank Pulling step 2b state (Plaid Link)
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);
  const [plaidConnectLoading, setPlaidConnectLoading] = useState(false);
  const [plaidConnectError, setPlaidConnectError] = useState<string | null>(null);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, "good" | "login_required" | "error" | "disconnected" | "inactive" | null>>({});
  const [addModalLoading, setAddModalLoading] = useState(false);
  const [deleteConfirmSource, setDeleteConfirmSource] = useState<DataSource | null>(null);
  const [deleteAlsoTransactions, setDeleteAlsoTransactions] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pullDatesBySource, setPullDatesBySource] = useState<Record<string, { start: string; end: string }>>({});
  const [pullModalSource, setPullModalSource] = useState<DataSource | null>(null);
  type SyncStatusBar = { message: string; type: "syncing" | "success" | "error" } | null;
  const [syncStatusBar, setSyncStatusBar] = useState<SyncStatusBar>(null);
  // Post-connect sync state
  const [postConnectPulling, setPostConnectPulling] = useState(false);
  const [postConnectError, setPostConnectError] = useState<string | null>(null);

  const hasPlaid = sources.some((s) => s.source_type === "plaid");
  const hasStripeLegacy = sources.some((s) => s.source_type === "stripe");
  const hasDirectFeed = sources.some((s) => isDirectFeed(s.source_type));

  const addAccountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showPostConnectDateModal) {
      setPostConnectError(null);
    }
  }, [showPostConnectDateModal]);

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

  useEffect(() => {
    if (showAdd) {
      setAddModalLoading(true);
      const t = setTimeout(() => setAddModalLoading(false), 350);
      return () => clearTimeout(t);
    }
    setAddModalLoading(false);
  }, [showAdd]);

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

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          account_type: "other",
          institution: institution.trim() || null,
          source_type: "manual",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.data) {
        setSources((prev) => [data.data, ...prev]);
        setStats((prev) => ({
          ...prev,
          [data.data.id]: {
            transactionCount: 0,
            totalIncome: 0,
            totalExpenses: 0,
            pctReviewed: 0,
            totalSavings: 0,
            earliestTransactionDateInTaxYear: null,
          },
        }));
        setName("");
        setInstitution("");
        setShowAdd(false);
        setAddStep("1");
        setToast("Account created.");
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast(data?.error ?? "Failed to create account");
        setTimeout(() => setToast(null), 5000);
      }
    } finally {
      setSaving(false);
    }
  }

  function openEdit(source: DataSource) {
    setEditSource(source);
    setEditName(source.name);
    setEditInstitution(source.institution ?? "");
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
          institution: editInstitution.trim() || null,
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

  async function reloadSources() {
    const res = await fetch("/api/data-sources");
    if (res.ok) {
      const { data } = await res.json();
      setSources(data ?? []);
    }
    router.refresh();
  }

  const closeAdd = useCallback(() => {
    setShowAdd(false);
    setAddStep("1");
    setPlaidConnectError(null);
    setPlaidLinkToken(null);
  }, []);
  const closeEdit = useCallback(() => setEditSource(null), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showAdd) {
          // In the Add Account flow, Esc goes "back" to step 1
          // (only closes the modal if already on step 1).
          if (addStep !== "1") {
            setAddStep("1");
            setPlaidConnectError(null);
          } else {
            closeAdd();
          }
        }
        if (editSource) closeEdit();
        if (pullModalSource) setPullModalSource(null);
        if (deleteConfirmSource) setDeleteConfirmSource(null);
        if (uploadSourceId) setUploadSourceId(null);
        if (showPostConnectDateModal) {
          setShowPostConnectDateModal(false);
          setPostConnectError(null);
        }
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "a" && !showAdd && !editSource) {
        e.preventDefault();
        setShowAdd(true);
      }
      // Add account step 1: m = Manual, d = Direct Feed
      if (showAdd && addStep === "1") {
        if (e.key === "m" || e.key === "M") {
          e.preventDefault();
          setAddStep("2a");
        } else if (e.key === "d" || e.key === "D") {
          e.preventDefault();
          setAddStep("2b");
        }
      }
    }
    if (showAdd || editSource) {
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [
    showAdd,
    editSource,
    pullModalSource,
    deleteConfirmSource,
    uploadSourceId,
    showPostConnectDateModal,
    addStep,
    closeAdd,
    closeEdit,
  ]);

  useEffect(() => {
    if (showAdd) {
      const t = setTimeout(() => addAccountInputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [showAdd]);

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
              Accounts &amp; Data
            </div>
            <p className="text-base text-mono-medium mt-1 font-sans">
              Link your accounts and upload transactions
            </p>
            {hasDirectFeed && (
              <div className="mt-3 border border-[#F0F1F7] bg-white px-4 py-3 text-sm text-mono-medium">
                <span className="font-medium text-mono-dark">Direct Feed lookback:</span>{" "}
                {hasPlaid && <span>Plaid can import up to 24 months of history (varies by institution).</span>}
                {!hasPlaid && <span>Direct Feed imports history based on your bank’s availability.</span>}
                {hasStripeLegacy && (
                  <span className="text-mono-light"> (Legacy Stripe feeds may be shorter.)</span>
                )}{" "}
                <span>
                  Need older transactions?{" "}
                  <button
                    type="button"
                    onClick={() => setShowAdd(true)}
                    className="font-medium text-mono-dark underline underline-offset-2 decoration-black/20 hover:decoration-mono-dark"
                  >
                    Upload a CSV
                  </button>
                  .
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TaxYearSelector value={taxYear} onChange={() => router.refresh()} compact />
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center px-4 py-2.5 text-sm font-medium font-sans bg-black text-white rounded-none hover:bg-black/85 transition-colors"
          >
            <kbd className="mr-2.5 inline-flex items-center justify-center border border-mono-medium bg-white/30 px-1.5 py-0.5 text-[11px] font-mono text-white">
              a
            </kbd>
            Add Account
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

      {/* Add account modal - multi-step (styled like notification preferences modal) */}
      {showAdd && (
        <div
          className="fixed inset-0 min-h-[100dvh] z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-account-title"
        >
          <div className="rounded-none bg-white shadow-xl max-w-md w-full mx-4 overflow-hidden relative border-0">
            {addModalLoading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                <span className="material-symbols-rounded animate-spin text-3xl text-mono-medium">progress_activity</span>
              </div>
            )}
            <div className="bg-white px-6 pt-6 pb-0 flex items-start">
              <h2
                id="add-account-title"
                className="text-xl text-mono-dark font-medium"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {addStep === "1" && "Add account"}
                {addStep === "2a" && "Manual account"}
                {addStep === "2b" && "Direct Feed"}
              </h2>
            </div>

            {addStep === "1" && (
              <div className="px-6 pt-1 pb-6 space-y-2">
                <p className="text-xs text-mono-medium">
                  Choose how you want to add accounts and transactions.
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setAddStep("2a")}
                    className="border border-bg-tertiary/60 px-4 py-3 text-left hover:bg-bg-secondary/60 transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-mono-dark">Manual</p>
                      <kbd className="inline-flex items-center justify-center bg-[#F5F0E8] px-2 py-0.5 text-[11px] font-mono text-mono-dark">
                        m
                      </kbd>
                    </div>
                    <p className="text-xs text-mono-light mt-1.5">
                      Add accounts manually; transactions come via CSV uploads or manual entry.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddStep("2b")}
                    className="border border-bg-tertiary/60 px-4 py-3 text-left transition hover:bg-[#635bff]/5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-mono-dark">Direct Feed</p>
                      <kbd className="inline-flex items-center justify-center bg-[#F5F0E8] px-2 py-0.5 text-[11px] font-mono text-mono-dark">
                        d
                      </kbd>
                    </div>
                    <p className="text-xs text-mono-light mt-1.5">
                      Connect a bank via Plaid. We’ll automatically import up to 24 months of transaction history.
                    </p>
                  </button>
                </div>
                <a
                  href="https://plaid.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center justify-center gap-2 w-full py-3 text-sm font-medium text-mono-medium hover:text-mono-dark transition"
                  style={{ color: "#2563EB" }}
                >
                  <span className="inline-flex items-center justify-center" style={{ color: "#2563EB", transform: "scale(0.75)", transformOrigin: "center" }}>
                    <span className="material-symbols-rounded text-[20px]">open_in_new</span>
                  </span>
                  Learn about Plaid
                </a>
              </div>
            )}

            {addStep === "2a" && (
              <>
                <div className="px-6 pt-3 pb-1">
                  <button
                    type="button"
                    onClick={closeAdd}
                    className="text-sm font-medium text-mono-medium hover:text-mono-dark inline-flex items-center gap-2"
                  >
                    <kbd className="inline-flex items-center justify-center bg-[#F5F0E8] px-2 py-0.5 text-[11px] font-mono text-mono-dark">
                      esc
                    </kbd>
                    Return
                  </button>
                </div>
                <div className="px-6 py-3 space-y-3">
                  <div>
                    <label className="text-sm font-medium text-mono-dark block mb-2">
                      Account Name *
                    </label>
                    <input
                      ref={addAccountInputRef}
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Chase Business Checking"
                      className="w-full border px-4 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none border-bg-tertiary/60"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-mono-dark block mb-2">
                      Institution
                    </label>
                    <input
                      type="text"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      placeholder="e.g. Chase, Amex"
                      className="w-full border px-4 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none border-bg-tertiary/60"
                    />
                  </div>
                </div>
                <div className="px-6 pt-2 pb-6 flex justify-end gap-3">
                  <button
                    onClick={closeAdd}
                    disabled={saving}
                    className="px-4 py-2.5 text-sm font-medium font-sans bg-[#F0F1F7] text-mono-dark rounded-none hover:bg-[#E4E7F0] transition-colors disabled:opacity-40"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={saving || !name.trim()}
                    className="px-4 py-2.5 text-sm font-medium font-sans bg-black text-white rounded-none hover:bg-black/85 transition-colors disabled:opacity-40"
                  >
                    {saving ? "Adding..." : "Add account"}
                  </button>
                </div>
              </>
            )}

            {addStep === "2b" && (
              <>
                <div className="px-6 pt-3 pb-1">
                  <button
                    type="button"
                    onClick={closeAdd}
                    disabled={plaidConnectLoading}
                    className="text-sm font-medium text-mono-medium hover:text-mono-dark inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    <kbd className="inline-flex items-center justify-center bg-[#F5F0E8] px-2 py-0.5 text-[11px] font-mono text-mono-dark">
                      esc
                    </kbd>
                    Return
                  </button>
                </div>
                {plaidConnectLoading ? (
                  <div className="px-6 py-16 flex flex-col items-center justify-center gap-4">
                    <span className="material-symbols-rounded animate-spin text-4xl text-mono-medium">progress_activity</span>
                    <p className="text-sm font-medium text-mono-dark">Connecting…</p>
                    <p className="text-xs text-mono-light">Select your bank and accounts in the window that opened.</p>
                  </div>
                ) : (
                  <div className="px-6 py-3 space-y-3">
                    <p className="text-sm text-mono-medium">
                      Connect your bank account to automatically import up to 24 months of transaction history.
                    </p>
                    {plaidConnectError && (
                      <p className="text-sm text-red-600">{plaidConnectError}</p>
                    )}
                  </div>
                )}
                <PlaidLinkButton
                  plaidLinkToken={plaidLinkToken}
                  loading={plaidConnectLoading}
                  onClose={closeAdd}
                  onBeforeOpen={() => setShowAdd(false)}
                  onRequestToken={async () => {
                    setPlaidConnectError(null);
                    setPlaidConnectLoading(true);
                    try {
                      const res = await fetch("/api/data-sources/plaid/create-link-token", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                      });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok && data.link_token) {
                        setPlaidLinkToken(data.link_token);
                      } else {
                        setPlaidConnectError(data.error ?? "Could not create link token");
                      }
                    } catch (e) {
                      setPlaidConnectError(e instanceof Error ? e.message : "Connection failed");
                    } finally {
                      setPlaidConnectLoading(false);
                    }
                  }}
                  onSuccess={async (publicToken: string, metadata: any) => {
                    setPlaidConnectLoading(true);
                    setPlaidConnectError(null);
                    try {
                      const res = await fetch("/api/data-sources/plaid/exchange-token", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ public_token: publicToken, metadata }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok && data.success) {
                        setShowAdd(false);
                        setAddStep("1");
                        setPlaidConnectError(null);
                        setPlaidLinkToken(null);
                        setToast("Bank account(s) connected.");
                        setTimeout(() => setToast(null), 5000);
                        await reloadSources();
                        setShowPostConnectDateModal(true);
                      } else {
                        setPlaidConnectError(data.error ?? "Could not save account.");
                      }
                    } catch (e) {
                      setPlaidConnectError(e instanceof Error ? e.message : "Exchange failed");
                    } finally {
                      setPlaidConnectLoading(false);
                    }
                  }}
                  onExit={() => {
                    setPlaidConnectLoading(false);
                    setShowAdd(true);
                    setAddStep("2b");
                  }}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit account modal */}
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
                  <label className="text-sm font-medium text-black block mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. Chase Business Checking"
                    className="w-full border px-4 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none border-bg-tertiary/60"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-black block mb-2">
                    Institution
                  </label>
                  <input
                    type="text"
                    value={editInstitution}
                    onChange={(e) => setEditInstitution(e.target.value)}
                    placeholder="e.g. Chase, Amex"
                    disabled={isDirectFeed(editSource?.source_type ?? "")}
                    className="w-full border px-4 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none border-bg-tertiary/60 disabled:bg-[#F0F1F7] disabled:text-mono-light disabled:cursor-not-allowed"
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
                    className="px-4 py-2.5 text-sm font-medium font-sans bg-[#F0F1F7] text-mono-dark rounded-none hover:bg-[#E4E7F0] transition-colors disabled:opacity-40"
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

      {/* Pull transactions (date range) modal */}
      {pullModalSource && (() => {
        return (
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
                      const data = (await res.json().catch(() => ({}))) as {
                        message?: string;
                        diagnostics?: SyncDiag;
                        plaidDiagnostics?: SyncDiag;
                      };
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
        );
      })()}

      {/* Delete account confirmation modal */}
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
                Are you sure you want to delete <strong>{deleteConfirmSource.name}</strong>? This cannot be undone.
              </p>
              <div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteAlsoTransactions}
                    onChange={(e) => setDeleteAlsoTransactions(e.target.checked)}
                    className="mt-1 rounded-none border-0 text-black accent-black"
                  />
                  <span className="text-sm text-black">
                    Also delete all transactions from this account
                  </span>
                </label>
                <p className="text-xs text-black/70 mt-1 ml-6">
                  {deleteAlsoTransactions
                    ? "Transactions will be permanently removed."
                    : "Transactions will be kept but unlinked from this account."}
                </p>
              </div>
            </div>
            <div className="px-6 pt-2 pb-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setDeleteConfirmSource(null); }}
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
                      body: JSON.stringify({ id: deleteConfirmSource.id, delete_transactions: deleteAlsoTransactions }),
                    });
                    if (res.ok) {
                      setDeleteConfirmSource(null);
                      setEditSource(null);
                      await reloadSources();
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

      {/* Post-connect modal: pull transactions for newly connected accounts */}
      {showPostConnectDateModal && (() => {
        const unsyncedSources = sources.filter(
          (s) => isDirectFeed(s.source_type) && s.last_successful_sync_at == null
        );
        if (unsyncedSources.length === 0) {
          return null;
        }
        const accountNames = unsyncedSources.map((s) => s.name).join(", ");
        return (
          <div
            className="fixed inset-0 min-h-[100dvh] z-[60] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="post-connect-date-title"
          >
            <div className="rounded-none bg-white shadow-xl max-w-md w-full mx-4 overflow-hidden border-0">
              {postConnectPulling ? (
                <div className="px-6 py-12 flex flex-col items-center justify-center gap-4">
                  <span className="material-symbols-rounded animate-spin text-4xl text-black/40">progress_activity</span>
                  <h2 className="text-xl text-black font-medium text-center" style={{ fontFamily: "var(--font-sans)" }}>
                    Loading transactions
                  </h2>
                  <p className="text-xs text-black/70 text-center">
                    Pulling from {unsyncedSources.length > 1 ? "your accounts" : accountNames}… This may take a minute.
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-white px-6 pt-6 pb-0 flex items-start">
                    <h2 id="post-connect-date-title" className="text-xl text-black font-medium" style={{ fontFamily: "var(--font-sans)" }}>
                      Pull Bank Transactions
                    </h2>
                  </div>
                  <div className="px-6 py-3 space-y-3">
                    <p className="text-xs text-black">
                      We’ll pull available transaction history for your newly connected accounts.
                    </p>

                    <div className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7]">
                      {unsyncedSources.map((s) => (
                        <div key={s.id} className="px-4 py-3 text-sm text-mono-dark">
                          {s.name}
                        </div>
                      ))}
                    </div>

                    {postConnectError && (
                      <p className="text-xs text-[#B91C1C] px-0 py-1">{postConnectError}</p>
                    )}
                  </div>
                  <div className="px-6 pt-2 pb-6 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => { setShowPostConnectDateModal(false); setPostConnectError(null); }}
                      disabled={postConnectPulling}
                      className="px-4 py-2.5 text-sm font-medium font-sans bg-[#F0F1F7] text-mono-dark rounded-none hover:bg-[#E4E7F0] transition-colors disabled:opacity-40"
                    >
                      Skip for now
                    </button>
                    <button
                      type="button"
                      disabled={postConnectPulling}
                      onClick={async () => {
                        setPostConnectPulling(true);
                        setPostConnectError(null);
                        try {
                          const failed: { name: string }[] = [];
                          let lastDiag: SyncDiag | undefined;
                          for (const source of unsyncedSources) {
                            const res = await fetch("/api/data-sources/sync", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ data_source_id: source.id }),
                            });
                            if (res.ok) {
                              const data = (await res.json().catch(() => ({}))) as { diagnostics?: SyncDiag; plaidDiagnostics?: SyncDiag };
                              const diag = data.plaidDiagnostics ?? data.diagnostics;
                              logSyncDiagnostics(diag);
                              lastDiag = diag ?? lastDiag;
                            } else {
                              failed.push({ name: source.name });
                            }
                          }
                          setShowPostConnectDateModal(false);
                          await reloadSources();
                          window.dispatchEvent(new CustomEvent("inbox-count-changed"));
                          const okCount = unsyncedSources.length - failed.length;
                          if (okCount > 0) {
                            const singleOk = okCount === 1 && unsyncedSources.length === 1 && failed.length === 0;
                            setSyncStatusBar({
                              message: singleOk && lastDiag
                                ? syncStatusMessage(lastDiag)
                                : failed.length > 0
                                  ? `Loaded ${okCount} account${okCount === 1 ? "" : "s"}. ${failed.length} couldn’t be loaded — retry or reconnect from the card.`
                                  : `Transactions loaded for ${okCount} account${okCount === 1 ? "" : "s"}.`,
                              type: "success",
                            });
                            setToast(failed.length > 0
                              ? `${failed.map((f) => f.name).join(", ")}: try again or use Repair connection on the card.`
                              : "Transactions loaded. Duplicates are skipped.");
                          } else if (failed.length > 0) {
                            setSyncStatusBar({ message: "No accounts could be loaded. Try again or reconnect from the card.", type: "error" });
                            setToast(`Couldn’t load: ${failed.map((f) => f.name).join(", ")}. Try again in a few minutes or use Repair connection.`);
                          }
                          setTimeout(() => setSyncStatusBar(null), 7000);
                          setTimeout(() => setToast(null), 6000);
                          let count = 0;
                          const t = setInterval(() => {
                            count += 1;
                            window.dispatchEvent(new CustomEvent("inbox-count-changed"));
                            if (count >= 10) clearInterval(t);
                          }, 3000);
                        } finally {
                          setPostConnectPulling(false);
                        }
                      }}
                      className="px-4 py-2.5 text-sm font-medium font-sans bg-[#2563EB] text-white rounded-none hover:bg-[#1D4ED8] transition-colors disabled:opacity-40"
                    >
                      Pull transactions
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

      {sources.length === 0 && !showAdd && !loadingNewAccounts && (
        <div className="text-center py-20">
          <p className="text-base text-mono-medium mb-2">No accounts yet</p>
          <p className="text-sm text-mono-light">
            Add a financial account to start uploading transaction CSVs.
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
              earliestTransactionDateInTaxYear: null,
            };
            const totalTxCount = s.transactionCount ?? 0;
            const reviewedTxCount =
              totalTxCount > 0
                ? Math.round((Math.min(100, Math.max(0, s.pctReviewed ?? 0)) / 100) * totalTxCount)
                : 0;
            const hasSyncFailure = !!source.last_failed_sync_at;
            const showEarliestTaxYearLine =
              totalTxCount > 0 &&
              !!s.earliestTransactionDateInTaxYear &&
              !isEarliestNearStartOfTaxYear(s.earliestTransactionDateInTaxYear, taxYear);
            return (
              <li
                key={source.id}
                className="border border-[#F0F1F7] bg-white"
              >
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
                  <p className="text-lg font-semibold text-mono-dark">{source.name}</p>
                  {source.institution && (
                    <p className="text-sm text-mono-light">{source.institution}</p>
                  )}
                  {showEarliestTaxYearLine && s.earliestTransactionDateInTaxYear && (
                    <p
                      className="mt-1.5 max-w-md text-xs leading-snug text-mono-medium"
                      style={{ fontFamily: "var(--font-sans)" }}
                    >
                      Earliest in{" "}
                      <span className="tabular-nums font-medium text-mono-dark">{taxYear}</span>
                      {": "}
                      <span className="font-medium text-mono-dark">
                        {formatEarliestCompact(s.earliestTransactionDateInTaxYear)}
                      </span>
                      {isDirectFeed(source.source_type) && (
                        <>
                          <span className="text-mono-light"> · </span>
                          <span className="text-mono-light">{source.source_type === "plaid" ? "up to 24 mo history" : "~6 mo bank feed"}</span>
                          {" · "}
                          <button
                            type="button"
                            onClick={() => setUploadSourceId(source.id)}
                            className="font-medium text-mono-dark underline underline-offset-2 decoration-black/20 hover:decoration-mono-dark focus:outline-none focus-visible:ring-1 focus-visible:ring-mono-dark/25 focus-visible:ring-offset-1"
                          >
                            Upload CSV
                          </button>
                        </>
                      )}
                      .
                    </p>
                  )}
                  {isDirectFeed(source.source_type) && (
                    <div className="text-xs text-mono-light mt-1 space-y-0.5">
                      {!source.last_successful_sync_at && totalTxCount === 0 && (
                        <p className="text-mono-medium">
                          Pull transactions to load activity from your bank.
                        </p>
                      )}
                      {source.source_type === "plaid" && (
                        <p className="text-mono-light">
                          Lookback: up to <span className="font-medium text-mono-dark">24 months</span> (varies by institution).
                        </p>
                      )}
                      {source.last_successful_sync_at && totalTxCount === 0 && (
                        <p className="text-mono-medium">
                          Sync completed; no posted transactions in the selected date range.
                        </p>
                      )}
                    </div>
                  )}
                  {isDirectFeed(source.source_type) && (connectionStatuses[source.id] === "disconnected" || connectionStatuses[source.id] === "inactive" || connectionStatuses[source.id] === "login_required" || connectionStatuses[source.id] === "error" || !(source.financial_connections_account_id || source.plaid_item_id)) && (
                    <div className="mt-3 bg-[#F5F0E8] p-3">
                      <p className="text-sm font-medium text-mono-dark">
                        {!(source.financial_connections_account_id || source.plaid_item_id)
                          ? "This account isn't linked to a bank."
                          : "This connection is no longer active"}
                      </p>
                      <p className="text-xs text-mono-medium mt-1">Reconnect your bank to restore syncing</p>
                      <button
                        type="button"
                        onClick={() => { setShowAdd(true); setAddStep("2b"); }}
                        className="mt-2 bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-black/85"
                      >
                        Repair connection
                      </button>
                    </div>
                  )}
                  {hasSyncFailure && !(isDirectFeed(source.source_type) && (connectionStatuses[source.id] === "disconnected" || connectionStatuses[source.id] === "inactive" || connectionStatuses[source.id] === "login_required" || connectionStatuses[source.id] === "error" || !(source.financial_connections_account_id || source.plaid_item_id))) && (
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
                      <span
                        className="material-symbols-rounded leading-none"
                        style={{ fontSize: 16 }}
                      >
                        list
                      </span>
                      View transactions
                    </Link>
                    {isDirectFeed(source.source_type) && connectionStatuses[source.id] !== "disconnected" && connectionStatuses[source.id] !== "inactive" && connectionStatuses[source.id] !== "login_required" && connectionStatuses[source.id] !== "error" && (source.financial_connections_account_id || source.plaid_item_id) && (
                      <button
                        type="button"
                        onClick={() => setPullModalSource(source)}
                        className="inline-flex items-center gap-2 rounded-none bg-[#2563EB] px-3 py-2 text-sm font-medium text-white hover:opacity-90 transition"
                      >
                        <span
                          className="material-symbols-rounded leading-none"
                          style={{ fontSize: 16 }}
                        >
                          sync
                        </span>
                        Pull Transactions
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setUploadSourceId(source.id)}
                      className={`inline-flex items-center gap-2 rounded-none px-3 py-2 text-sm font-medium transition ${
                        isDirectFeed(source.source_type)
                          ? "bg-cool-stock text-black hover:bg-frost"
                          : "bg-[#2563EB] text-white hover:opacity-90"
                      }`}
                    >
                      <span
                        className="material-symbols-rounded leading-none"
                        style={{ fontSize: 16 }}
                      >
                        upload_file
                      </span>
                      Upload CSV
                    </button>
                    <button
                      onClick={() => openEdit(source)}
                      className="inline-flex items-center gap-2 rounded-none border border-bg-tertiary/60 px-3 py-2 text-sm font-medium text-mono-medium hover:bg-bg-secondary/60 transition"
                      aria-label="Edit account"
                    >
                      <span
                        className="material-symbols-rounded leading-none"
                        style={{ fontSize: 16 }}
                      >
                        edit
                      </span>
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

      {uploadSourceId && (
        <UploadModal
          dataSourceId={uploadSourceId}
          directFeedAccount={sources.some((s) => s.id === uploadSourceId && isDirectFeed(s.source_type))}
          onClose={() => setUploadSourceId(null)}
          onCompleted={async (result) => {
            setUploadSourceId(null);
            await reloadSources();

            if (result?.transactionIds && result.transactionIds.length > 0) {
              fetch("/api/transactions/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ transactionIds: result.transactionIds }),
              }).catch(() => {});
              setToast(`${result.transactionIds.length} imported — AI categorization started. Check Inbox to review.`);
              setTimeout(() => setToast(null), 5000);
            }
          }}
        />
      )}
    </div>
  );
}
