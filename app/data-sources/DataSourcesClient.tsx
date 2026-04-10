"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import type { Database } from "@/lib/types/database";
import { UploadModal } from "@/components/UploadModal";
import type { DataSourceStats } from "./page";
import { AccountsShareModal } from "@/components/AccountsShareModal";
import { pageIconTextClass } from "@/lib/page-icon-colors";
import { BRAND_COLOR_OPTIONS, brandColorHex, normalizeBrandColorId } from "@/lib/brand-palette";

const topBarShareActionClass =
  "inline-flex h-8 items-center rounded-none border-0 bg-transparent px-2.5 text-[13px] font-medium text-mono-dark hover:bg-bg-secondary/50 transition-colors";

const appleOverlayClass =
  "fixed inset-0 z-[70] flex min-h-[100dvh] items-center justify-center bg-black/40 px-4 backdrop-blur-md";
const applePanelClass =
  "relative w-full max-w-md overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.18)]";
const appleModalHeadClass = "px-5 pt-5 pb-1";
const appleModalBodyClass = "px-5 py-3";
const appleModalFooterClass = "flex justify-end gap-2 border-t border-black/[0.06] bg-[#fafafa]/80 px-5 py-4";
const appleBtnPrimary =
  "rounded-full bg-[#0071e3] px-5 py-2.5 text-[15px] font-medium text-white transition hover:bg-[#0077ed] disabled:opacity-40";
const appleBtnSecondary =
  "rounded-full bg-[#e5e5ea] px-5 py-2.5 text-[15px] font-medium text-[#1d1d1f] transition hover:bg-[#d8d8dc] disabled:opacity-40";
const appleInputClass =
  "w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2.5 text-sm text-mono-dark outline-none transition focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3]/25";
const appleChoiceCardClass =
  "w-full rounded-xl border border-black/[0.10] px-4 py-3 text-left transition hover:bg-[#f5f5f7]";

function rgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

type DataSource = Database["public"]["Tables"]["data_sources"]["Row"];

const ACCOUNT_TYPES = [
  { value: "checking", label: "Business Checking" },
  { value: "credit", label: "Business Credit Card" },
  { value: "savings", label: "Business Savings" },
  { value: "other", label: "Other" },
];

const ROLLUP_CLASS_OPTIONS = [
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" },
] as const;

const BALANCE_PREF_OPTIONS = [
  { value: "current", label: "Current" },
  { value: "available", label: "Available" },
  { value: "manual", label: "Manual" },
] as const;

function accountTypeLabel(type: string): string {
  return ACCOUNT_TYPES.find((a) => a.value === type)?.label ?? type;
}

function formatCurrency(n: number, currency = "USD"): string {
  const code = currency && currency.length === 3 ? currency : "USD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function numericOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Common ISO 4217 codes for manual account currency (edit / create). */
const COMMON_CURRENCY_OPTIONS: { code: string; label: string }[] = [
  { code: "USD", label: "USD — US dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British pound" },
  { code: "CAD", label: "CAD — Canadian dollar" },
  { code: "AUD", label: "AUD — Australian dollar" },
  { code: "JPY", label: "JPY — Japanese yen" },
  { code: "CHF", label: "CHF — Swiss franc" },
  { code: "CNY", label: "CNY — Chinese yuan" },
  { code: "INR", label: "INR — Indian rupee" },
  { code: "MXN", label: "MXN — Mexican peso" },
  { code: "BRL", label: "BRL — Brazilian real" },
  { code: "SEK", label: "SEK — Swedish krona" },
  { code: "NOK", label: "NOK — Norwegian krone" },
  { code: "DKK", label: "DKK — Danish krone" },
  { code: "NZD", label: "NZD — New Zealand dollar" },
  { code: "SGD", label: "SGD — Singapore dollar" },
  { code: "HKD", label: "HKD — Hong Kong dollar" },
  { code: "PLN", label: "PLN — Polish złoty" },
];

function formatEditBalanceWholeInput(raw: string): string {
  const noComma = raw.replace(/,/g, "");
  if (noComma === "" || noComma === "-") return noComma === "-" ? "-" : "";
  const neg = noComma.startsWith("-");
  const digitsOnly = (neg ? noComma.slice(1) : noComma).replace(/\D/g, "");
  if (digitsOnly === "") return neg ? "-" : "";
  const n = parseInt(digitsOnly, 10);
  if (!Number.isFinite(n)) return neg ? "-" : "";
  return (neg ? "-" : "") + n.toLocaleString("en-US");
}

function sanitizeEditBalanceWholeTyping(raw: string): string {
  // Preserve the user's caret position while typing by avoiding formatting onChange.
  // Allow digits, comma, and a single leading "-".
  const v = raw.replace(/[^\d,-]/g, "");
  const neg = v.includes("-");
  const withoutMinus = v.replace(/-/g, "");
  const digitsAndCommas = withoutMinus.replace(/[^\d,]/g, "");
  return `${neg ? "-" : ""}${digitsAndCommas}`;
}

/**
 * Whole part (comma-grouped) + cents (0–99). Returns null for cleared balance, NaN for invalid cents.
 */
function parseEditBalanceWholeAndCents(wholeDisplay: string, centsInput: string): number | null {
  const wTrim = wholeDisplay.replace(/,/g, "").trim();
  const neg = wTrim.startsWith("-");
  const wDigits = (neg ? wTrim.slice(1) : wTrim).replace(/\D/g, "");
  const cDigits = centsInput.replace(/\D/g, "").slice(0, 2);

  const centsEmpty = cDigits === "";
  const wholeEmpty = wDigits === "" && (wTrim === "" || wTrim === "-");

  if (wholeEmpty && centsEmpty) return null;

  const wholeNum = wDigits === "" ? 0 : parseInt(wDigits, 10);
  if (!Number.isFinite(wholeNum)) return NaN;

  const centsNum = centsEmpty ? 0 : parseInt(cDigits, 10);
  if (!Number.isFinite(centsNum) || centsNum > 99) return NaN;

  let val = wholeNum + centsNum / 100;
  if (neg && (wholeNum !== 0 || centsNum !== 0)) val = -val;
  return val;
}

function splitManualBalanceForEdit(m: number): { whole: string; cents: string } {
  const neg = m < 0;
  const abs = Math.abs(m);
  const whole = Math.floor(abs + 1e-8);
  const cents = Math.round((abs - whole) * 100 + 1e-8);
  return {
    whole: (neg ? "-" : "") + whole.toLocaleString("en-US"),
    cents: String(Math.min(99, Math.max(0, cents))).padStart(2, "0"),
  };
}

function formatBalanceAsOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
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
 * Oldest tx is already near the start of the calendar year — no need to surface “how far back” copy.
 * Uses Mar 1 as the cutoff (Jan–Feb = well covered from the year’s opening).
 */
function isEarliestNearStartOfCalendarYear(iso: string, year: number): boolean {
  const parts = iso.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return false;
  const earliest = new Date(y, m - 1, d);
  const marchFirst = new Date(year, 2, 1);
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
    <div className={`${appleModalFooterClass} mt-0 border-t-0 bg-transparent px-5 pb-5 pt-2`}>
      <button type="button" onClick={onClose} disabled={loading} className={appleBtnSecondary}>
        Close
      </button>
      <button
        type="button"
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
        className={appleBtnPrimary}
      >
        {loading ? "Connecting\u2026" : "Connect Bank"}
      </button>
    </div>
  );
}

export function DataSourcesClient({
  initialSources,
  initialStats = {},
}: {
  initialSources: DataSource[];
  initialStats?: Record<string, DataSourceStats>;
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
  const [balanceRefreshingId, setBalanceRefreshingId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [manualBalanceInput, setManualBalanceInput] = useState("");
  const [manualCurrencyCreate, setManualCurrencyCreate] = useState("USD");
  const [editBalanceWhole, setEditBalanceWhole] = useState("");
  const [editBalanceCents, setEditBalanceCents] = useState("");
  const [editManualCurrency, setEditManualCurrency] = useState("USD");
  const editBalanceWholeRef = useRef<HTMLInputElement>(null);
  const editBalanceCentsRef = useRef<HTMLInputElement>(null);
  // Bank Pulling step 2b state (Plaid Link)
  const [plaidLinkToken, setPlaidLinkToken] = useState<string | null>(null);
  const [plaidConnectLoading, setPlaidConnectLoading] = useState(false);
  const [plaidConnectError, setPlaidConnectError] = useState<string | null>(null);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, "good" | "login_required" | "error" | "disconnected" | "inactive" | null>>({});
  const [addModalLoading, setAddModalLoading] = useState(false);
  const [deleteConfirmSource, setDeleteConfirmSource] = useState<DataSource | null>(null);
  const [deleteAlsoTransactions, setDeleteAlsoTransactions] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [viewTxConfirmSource, setViewTxConfirmSource] = useState<DataSource | null>(null);
  const [creatingAccountPage, setCreatingAccountPage] = useState(false);
  const [pullDatesBySource, setPullDatesBySource] = useState<Record<string, { start: string; end: string }>>({});
  const [pullModalSource, setPullModalSource] = useState<DataSource | null>(null);
  type SyncStatusBar = { message: string; type: "syncing" | "success" | "error" } | null;
  const [syncStatusBar, setSyncStatusBar] = useState<SyncStatusBar>(null);
  // Post-connect sync state
  const [postConnectPulling, setPostConnectPulling] = useState(false);
  const [postConnectError, setPostConnectError] = useState<string | null>(null);

  const calendarYear = new Date().getFullYear();

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

  async function handleRefreshPlaidBalance(sourceId: string) {
    setBalanceRefreshingId(sourceId);
    try {
      const res = await fetch("/api/data-sources/plaid/refresh-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data_source_id: sourceId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setToast(data.error ?? "Could not refresh bank balance");
        setTimeout(() => setToast(null), 5000);
        return;
      }
      await reloadSources();
      setToast("Bank balance updated.");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setBalanceRefreshingId(null);
    }
  }

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
      const payload: Record<string, unknown> = {
        name: trimmedName,
        account_type: "other",
        institution: institution.trim() || null,
        source_type: "manual",
        manual_balance_iso_currency_code: manualCurrencyCreate.trim().slice(0, 3).toUpperCase() || "USD",
      };
      const balRaw = manualBalanceInput.trim();
      if (balRaw !== "") {
        const n = parseFloat(balRaw);
        if (Number.isFinite(n)) payload.manual_balance = Number(n.toFixed(2));
      }
      const res = await fetch("/api/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
        setManualBalanceInput("");
        setManualCurrencyCreate("USD");
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
    const m = numericOrNull(source.manual_balance);
    if (m == null) {
      setEditBalanceWhole("");
      setEditBalanceCents("");
    } else {
      const { whole, cents } = splitManualBalanceForEdit(m);
      setEditBalanceWhole(whole);
      setEditBalanceCents(cents);
    }
    setEditManualCurrency((source.manual_balance_iso_currency_code ?? "USD").toUpperCase().slice(0, 3));
  }

  async function handleSaveEdit() {
    if (!editSource) return;
    const trimmedName = editName.trim();
    if (!trimmedName) return;
    setEditSaving(true);
    setToast(null);
    try {
      const patch: Record<string, unknown> = {
        id: editSource.id,
        name: trimmedName,
        institution: editInstitution.trim() || null,
      };
      if (editSource.source_type === "manual") {
        const n = parseEditBalanceWholeAndCents(editBalanceWhole, editBalanceCents);
        if (Number.isNaN(n)) {
          setToast("Enter a valid balance (cents are 0–99) or clear both fields");
          setTimeout(() => setToast(null), 4000);
          setEditSaving(false);
          return;
        }
        if (n === null) {
          patch.manual_balance = null;
        } else {
          patch.manual_balance = Number(n.toFixed(2));
        }
        patch.manual_balance_iso_currency_code =
          editManualCurrency.trim().slice(0, 3).toUpperCase() || "USD";
      }
      const res = await fetch("/api/data-sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
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
      window.dispatchEvent(new CustomEvent("accounts-changed"));
    }
    router.refresh();
  }

  async function patchRollupFields(sourceId: string, patch: Record<string, unknown>) {
    try {
      const res = await fetch("/api/data-sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sourceId, ...patch }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.data) {
        setSources((prev) => prev.map((s) => (s.id === data.data.id ? { ...s, ...data.data } : s)));
        window.dispatchEvent(new CustomEvent("accounts-changed"));
        return;
      }
      setToast(data?.error ?? "Failed to update");
      setTimeout(() => setToast(null), 5000);
    } catch {
      setToast("Failed to update");
      setTimeout(() => setToast(null), 5000);
    }
  }

  async function createFilteredPageForAccount(source: DataSource) {
    if (creatingAccountPage) return;
    setCreatingAccountPage(true);
    setToast(null);
    try {
      const title = `${source.name}`.trim() || "Account";
      const createRes = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          icon_type: "material",
          icon_value: "list",
          icon_color: "grey",
        }),
      });
      const createJson = (await createRes.json().catch(() => ({}))) as { error?: string; page?: { id: string } };
      if (!createRes.ok || !createJson.page?.id) {
        setToast(createJson.error ?? "Could not create page");
        setTimeout(() => setToast(null), 5000);
        return;
      }

      const pageId = createJson.page.id;
      const filterId =
        (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `f-${Date.now()}-${Math.random().toString(16).slice(2)}`) as string;
      const patchRes = await fetch(`/api/pages/${encodeURIComponent(pageId)}/activity-view-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: {
            // Persist as a Notion-style filter row so it appears in the Filters UI.
            column_filters: [
              {
                id: filterId,
                column: "data_source_id",
                op: "is",
                value: source.id,
                value2: "",
              },
            ],
          },
        }),
      });
      const patchJson = (await patchRes.json().catch(() => ({}))) as { error?: string };
      if (!patchRes.ok) {
        setToast(patchJson.error ?? "Page created but could not set account filter");
        setTimeout(() => setToast(null), 6000);
      }

      setViewTxConfirmSource(null);
      // Sidebar listens for this to refresh its pages list.
      window.dispatchEvent(new CustomEvent("pages-changed"));
      router.refresh();
      router.push(`/pages/${pageId}`);
    } finally {
      setCreatingAccountPage(false);
    }
  }

  const closeAdd = useCallback(() => {
    setShowAdd(false);
    setAddStep("1");
    setPlaidConnectError(null);
    setPlaidLinkToken(null);
    setManualBalanceInput("");
    setManualCurrencyCreate("USD");
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
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex h-10 w-full shrink-0 items-center gap-2 border-b border-bg-tertiary/40 bg-white">
        <div className="flex min-w-0 flex-1 items-center gap-2 pl-4 md:pl-6">
          <span
            className="material-symbols-rounded shrink-0 leading-none text-mono-medium"
            style={{ fontSize: 18, fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
          >
            database
          </span>
          <span className="truncate text-[13px] font-medium text-mono-medium">Accounts</span>
        </div>
        <div className="flex shrink-0 items-center gap-1 pr-4 md:pr-6">
          <button type="button" className={topBarShareActionClass} onClick={() => setShareOpen(true)}>
            Share
          </button>
        </div>
      </div>

      <div className="mx-auto flex min-h-0 w-full min-w-0 max-w-4xl flex-1 flex-col px-4 pb-12 md:px-6">
        <div className="flex flex-col gap-0 pt-4 pb-2">
          <div className="flex flex-col gap-4 pb-5">
          <div className="mt-5 shrink-0 self-start flex h-14 w-14 items-center justify-center md:mt-6" aria-hidden>
            <span
              className={`material-symbols-rounded leading-none ${pageIconTextClass("black")}`}
              style={{ fontSize: 52, fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
            >
              database
            </span>
          </div>
          <h1 className="page-title-field min-w-0 w-full appearance-none bg-transparent text-[32px] leading-tight font-sans font-bold text-mono-dark">
            Accounts
          </h1>
          <p className="-mt-1 text-sm text-mono-medium">Bank feeds, balances, and uploads</p>
          </div>
        </div>

        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#0071e3] px-5 py-2 text-[14px] font-medium text-white shadow-sm transition hover:bg-[#0077ed] active:scale-[0.98]"
          >
            Add account
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6">
      {(syncStatusBar || debugCallouts) && (
        <div
          role="status"
          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm ${
            (syncStatusBar ?? { type: "syncing" }).type === "syncing"
              ? "border-[#d2d2d7] bg-[#f5f5f7] text-[#1d1d1f]"
              : (syncStatusBar ?? { type: "syncing" }).type === "success"
                ? "border-[#b4e4c5] bg-[#e8f8ec] text-[#1d1d1f]"
                : "border-[#f5d090] bg-[#fff8e8] text-[#1d1d1f]"
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
          className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm border-[#b4e4c5] bg-[#e8f8ec] text-[#1d1d1f]"
        >
          <span className="material-symbols-rounded text-lg text-[#16A34A]">check_circle</span>
          <span className="font-medium">Saved</span>
        </div>
      )}

      {/* Add account modal - multi-step (styled like notification preferences modal) */}
      {showAdd && (
        <div className={appleOverlayClass} role="dialog" aria-modal="true" aria-labelledby="add-account-title">
          <div className={`${applePanelClass} relative`}>
            {addModalLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/80">
                <span className="material-symbols-rounded animate-spin text-3xl text-mono-medium">progress_activity</span>
              </div>
            )}
            <div className={`${appleModalHeadClass} flex items-start`}>
              <h2
                id="add-account-title"
                className="text-[20px] font-semibold tracking-tight text-mono-dark"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {addStep === "1" && "Add account"}
                {addStep === "2a" && "Manual account"}
                {addStep === "2b" && "Direct Feed"}
              </h2>
            </div>

            {addStep === "1" && (
              <>
                <div className={`${appleModalBodyClass} space-y-3`}>
                  <p className="text-sm text-mono-medium">
                    Choose how you want to add accounts and transactions.
                  </p>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setAddStep("2a")}
                      className={appleChoiceCardClass}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-mono-dark">Manual</p>
                        <kbd className="inline-flex items-center justify-center rounded-md bg-[#f5f5f7] px-2 py-0.5 text-[11px] font-mono text-mono-dark">
                          m
                        </kbd>
                      </div>
                      <p className="mt-1.5 text-xs text-mono-light">
                        Add accounts manually; transactions come via CSV uploads or manual entry.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddStep("2b")}
                      className={appleChoiceCardClass}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-mono-dark">Direct Feed</p>
                        <kbd className="inline-flex items-center justify-center rounded-md bg-[#f5f5f7] px-2 py-0.5 text-[11px] font-mono text-mono-dark">
                          d
                        </kbd>
                      </div>
                      <p className="mt-1.5 text-xs text-mono-light">
                        Connect a bank via Plaid. We’ll automatically import up to 24 months of transaction history.
                      </p>
                    </button>
                  </div>
                  <a
                    href="https://plaid.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-[#0071e3] hover:underline"
                  >
                    <span className="material-symbols-rounded text-[18px]">open_in_new</span>
                    Learn about Plaid
                  </a>
                </div>
                <div className={appleModalFooterClass}>
                  <button type="button" onClick={closeAdd} className={appleBtnSecondary}>
                    Cancel
                  </button>
                </div>
              </>
            )}

            {addStep === "2a" && (
              <>
                <div className={`${appleModalBodyClass} pt-0`}>
                  <button
                    type="button"
                    onClick={closeAdd}
                    className="text-sm font-medium text-[#0071e3] hover:underline"
                  >
                    ← Back
                  </button>
                </div>
                <div className={`${appleModalBodyClass} space-y-3 pt-0`}>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-mono-dark">Account name *</label>
                    <input
                      ref={addAccountInputRef}
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Chase Business Checking"
                      className={appleInputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-mono-dark">Institution</label>
                    <input
                      type="text"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      placeholder="e.g. Chase, Amex"
                      className={appleInputClass}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-mono-dark">Balance (optional)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={manualBalanceInput}
                        onChange={(e) => setManualBalanceInput(e.target.value)}
                        placeholder="0.00"
                        className={appleInputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-mono-dark">Currency</label>
                      <input
                        type="text"
                        value={manualCurrencyCreate}
                        onChange={(e) => setManualCurrencyCreate(e.target.value.toUpperCase().slice(0, 3))}
                        placeholder="USD"
                        className={appleInputClass}
                        maxLength={3}
                      />
                    </div>
                  </div>
                </div>
                <div className={appleModalFooterClass}>
                  <button type="button" onClick={closeAdd} disabled={saving} className={appleBtnSecondary}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={saving || !name.trim()}
                    className={appleBtnPrimary}
                  >
                    {saving ? "Adding…" : "Add account"}
                  </button>
                </div>
              </>
            )}

            {addStep === "2b" && (
              <>
                <div className={`${appleModalBodyClass} pt-0`}>
                  <button
                    type="button"
                    onClick={closeAdd}
                    disabled={plaidConnectLoading}
                    className="text-sm font-medium text-[#0071e3] hover:underline disabled:opacity-50"
                  >
                    ← Back
                  </button>
                </div>
                {plaidConnectLoading ? (
                  <div className="flex flex-col items-center justify-center gap-3 px-5 py-12">
                    <span className="material-symbols-rounded animate-spin text-4xl text-mono-medium">progress_activity</span>
                    <p className="text-sm font-medium text-mono-dark">Connecting…</p>
                    <p className="text-center text-xs text-mono-light">Select your bank in the window that opened.</p>
                  </div>
                ) : (
                  <div className={`${appleModalBodyClass} space-y-2 pt-0`}>
                    <p className="text-sm text-mono-medium">
                      Connect your bank to import up to 24 months of transaction history.
                    </p>
                    {plaidConnectError && <p className="text-sm text-red-600">{plaidConnectError}</p>}
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
        <div className={appleOverlayClass} role="dialog" aria-modal="true" aria-labelledby="edit-account-title">
          <div className={applePanelClass}>
            <div className={appleModalHeadClass}>
              <h2 id="edit-account-title" className="text-[20px] font-semibold tracking-tight text-mono-dark">
                Edit account
              </h2>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editName.trim() && !editSaving) handleSaveEdit();
              }}
            >
              <div className={`${appleModalBodyClass} space-y-3`}>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-mono-dark">Name *</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. Chase Business Checking"
                    className={appleInputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-mono-dark">Institution</label>
                  <input
                    type="text"
                    value={editInstitution}
                    onChange={(e) => setEditInstitution(e.target.value)}
                    placeholder="e.g. Chase, Amex"
                    disabled={isDirectFeed(editSource?.source_type ?? "")}
                    className={`${appleInputClass} disabled:cursor-not-allowed disabled:bg-[#f5f5f7] disabled:text-mono-light`}
                  />
                </div>
                {editSource.source_type === "manual" && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-mono-dark">Balance</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          ref={editBalanceWholeRef}
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          value={editBalanceWhole}
                          onChange={(e) => setEditBalanceWhole(sanitizeEditBalanceWholeTyping(e.target.value))}
                          onBlur={() => setEditBalanceWhole((v) => formatEditBalanceWholeInput(v))}
                          onKeyDown={(e) => {
                            if (e.key === "." || e.key === ",") {
                              e.preventDefault();
                              editBalanceCentsRef.current?.focus();
                              editBalanceCentsRef.current?.select();
                            }
                          }}
                          placeholder="0"
                          className={`${appleInputClass} min-w-0 flex-1 tabular-nums`}
                          aria-label="Balance whole amount"
                        />
                        <span className="shrink-0 text-lg font-medium text-mono-medium" aria-hidden>
                          .
                        </span>
                        <input
                          ref={editBalanceCentsRef}
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          value={editBalanceCents}
                          onChange={(e) => setEditBalanceCents(e.target.value.replace(/\D/g, "").slice(0, 2))}
                          onBlur={() =>
                            setEditBalanceCents((v) => {
                              const d = v.replace(/\D/g, "").slice(0, 2);
                              if (d === "") return "";
                              return d.padStart(2, "0");
                            })
                          }
                          placeholder="00"
                          maxLength={2}
                          className={`${appleInputClass} w-[3.25rem] shrink-0 tabular-nums text-center`}
                          aria-label="Balance cents"
                        />
                      </div>
                      <p className="mt-1 text-xs text-mono-light">Clear both to remove balance. Cents are two digits (e.g. 50 for fifty cents).</p>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-mono-dark">Currency</label>
                      <select
                        value={editManualCurrency || "USD"}
                        onChange={(e) => setEditManualCurrency(e.target.value)}
                        className={`${appleInputClass} cursor-pointer`}
                      >
                        {COMMON_CURRENCY_OPTIONS.map((o) => (
                          <option key={o.code} value={o.code}>
                            {o.label}
                          </option>
                        ))}
                        {!COMMON_CURRENCY_OPTIONS.some((o) => o.code === editManualCurrency) && editManualCurrency ? (
                          <option value={editManualCurrency}>{editManualCurrency} — custom</option>
                        ) : null}
                      </select>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 border-t border-black/[0.06] bg-[#fafafa]/80 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmSource(editSource)}
                  disabled={editSaving}
                  className="mr-auto shrink-0 rounded-full bg-red-50 px-4 py-2.5 text-[15px] font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-40"
                >
                  Delete
                </button>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setEditSource(null)}
                    disabled={editSaving}
                    className={appleBtnSecondary}
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={editSaving || !editName.trim()} className={appleBtnPrimary}>
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
        <div className={appleOverlayClass} role="dialog" aria-modal="true" aria-labelledby="pull-transactions-title">
          <div className={applePanelClass}>
            <div className={appleModalHeadClass}>
              <h2 id="pull-transactions-title" className="text-[20px] font-semibold tracking-tight text-mono-dark">
                Pull transactions
              </h2>
            </div>
            <div className={`${appleModalBodyClass} space-y-3`}>
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-mono-dark">From date</label>
                  <input
                    type="date"
                    value={pullDatesBySource[pullModalSource.id]?.start ?? ""}
                    onChange={(e) => setPullDatesBySource((prev) => ({ ...prev, [pullModalSource.id]: { ...(prev[pullModalSource.id] ?? { start: "", end: "" }), start: e.target.value } }))}
                    className={appleInputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-mono-dark">To date</label>
                  <input
                    type="date"
                    value={pullDatesBySource[pullModalSource.id]?.end ?? ""}
                    onChange={(e) => setPullDatesBySource((prev) => ({ ...prev, [pullModalSource.id]: { ...(prev[pullModalSource.id] ?? { start: "", end: "" }), end: e.target.value } }))}
                    className={appleInputClass}
                  />
                </div>
              </div>
              <p className="text-xs text-mono-medium">Leave dates empty for default range. Duplicates are skipped.</p>
            </div>
            <div className={appleModalFooterClass}>
              <button
                type="button"
                onClick={() => setPullModalSource(null)}
                disabled={syncingId === pullModalSource.id}
                className={appleBtnSecondary}
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
                className={appleBtnPrimary}
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
        <div className={appleOverlayClass} role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title">
          <div className={applePanelClass}>
            <div className={appleModalHeadClass}>
              <h2 id="delete-confirm-title" className="text-[20px] font-semibold tracking-tight text-mono-dark">
                Delete account?
              </h2>
            </div>
            <div className={`${appleModalBodyClass} space-y-3`}>
              <p className="text-sm text-mono-dark">
                Delete <strong>{deleteConfirmSource.name}</strong>? This can’t be undone.
              </p>
              <div>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={deleteAlsoTransactions}
                    onChange={(e) => setDeleteAlsoTransactions(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-black/20 accent-[#0071e3]"
                  />
                  <span className="text-sm text-mono-dark">Also delete all transactions from this account</span>
                </label>
                <p className="ml-7 mt-1 text-xs text-mono-medium">
                  {deleteAlsoTransactions
                    ? "Transactions will be permanently removed."
                    : "Transactions stay in your workspace but unlinked."}
                </p>
              </div>
            </div>
            <div className={appleModalFooterClass}>
              <button
                type="button"
                onClick={() => { setDeleteConfirmSource(null); }}
                disabled={deleteLoading}
                className={appleBtnSecondary}
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
                className="rounded-full bg-red-50 px-5 py-2.5 text-[15px] font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-40"
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
          <div className={appleOverlayClass} role="dialog" aria-modal="true" aria-labelledby="post-connect-date-title">
            <div className={applePanelClass}>
              {postConnectPulling ? (
                <div className="flex flex-col items-center justify-center gap-4 px-5 py-12">
                  <span className="material-symbols-rounded animate-spin text-4xl text-mono-medium">progress_activity</span>
                  <h2 id="post-connect-date-title" className="text-center text-[20px] font-semibold tracking-tight text-mono-dark">
                    Loading transactions
                  </h2>
                  <p className="text-center text-sm text-mono-medium">
                    Pulling from {unsyncedSources.length > 1 ? "your accounts" : accountNames}… This may take a minute.
                  </p>
                </div>
              ) : (
                <>
                  <div className={appleModalHeadClass}>
                    <h2 id="post-connect-date-title" className="text-[20px] font-semibold tracking-tight text-mono-dark">
                      Pull bank transactions
                    </h2>
                  </div>
                  <div className={`${appleModalBodyClass} space-y-3`}>
                    <p className="text-sm text-mono-medium">
                      We’ll pull available transaction history for your newly connected accounts.
                    </p>

                    <div className="divide-y divide-black/[0.06] overflow-hidden rounded-xl border border-black/[0.08] bg-[#fafafa]/50">
                      {unsyncedSources.map((s) => (
                        <div key={s.id} className="bg-white px-4 py-3 text-sm font-medium text-mono-dark">
                          {s.name}
                        </div>
                      ))}
                    </div>

                    {postConnectError && <p className="text-sm text-red-600">{postConnectError}</p>}
                  </div>
                  <div className={appleModalFooterClass}>
                    <button
                      type="button"
                      onClick={() => { setShowPostConnectDateModal(false); setPostConnectError(null); }}
                      disabled={postConnectPulling}
                      className={appleBtnSecondary}
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
                      className={appleBtnPrimary}
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
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-black/[0.06] bg-[#fbfbfd] py-12">
          <span className="material-symbols-rounded animate-spin text-3xl text-[#86868b]">progress_activity</span>
          <p className="text-[15px] font-medium text-[#1d1d1f]" style={{ fontFamily: "var(--font-sans)" }}>
            Loading accounts…
          </p>
        </div>
      )}

      {sources.length === 0 && !showAdd && !loadingNewAccounts && (
        <div className="rounded-xl border border-black/[0.06] bg-[#fbfbfd] px-6 py-12 text-center shadow-sm">
          <p className="text-base font-semibold text-[#1d1d1f]" style={{ fontFamily: "var(--font-sans)" }}>
            No accounts yet
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-[#86868b]" style={{ fontFamily: "var(--font-sans)" }}>
            Connect a bank or add an account to import transactions.
          </p>
        </div>
      )}

      {sources.length > 0 && !loadingNewAccounts && (
        <ul className="space-y-3">
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
            const showEarliestYearLine =
              totalTxCount > 0 &&
              !!s.earliestTransactionDateInTaxYear &&
              !isEarliestNearStartOfCalendarYear(s.earliestTransactionDateInTaxYear, calendarYear);
            const balCurrency = source.plaid_balance_iso_currency_code ?? "USD";
            const balCurrent = numericOrNull(source.plaid_balance_current);
            const balAvailable = numericOrNull(source.plaid_balance_available);
            const balLimit = numericOrNull(source.plaid_balance_limit);
            const balAsOf = formatBalanceAsOf(source.plaid_balance_as_of);
            const displayMain = balCurrent ?? balAvailable;
            const mainIsAvailableOnly = balCurrent == null && balAvailable != null;
            const showPlaidBalances =
              source.source_type === "plaid" &&
              (displayMain != null || balLimit != null);
            const manualBalAmt = numericOrNull(source.manual_balance);
            const manualBalCode =
              (source.manual_balance_iso_currency_code ?? "").trim() || "USD";
            const plaidPrimaryLabel =
              displayMain != null
                ? mainIsAvailableOnly
                  ? source.account_type === "credit"
                    ? "Available credit"
                    : "Available"
                  : source.account_type === "credit"
                    ? "Current balance"
                    : "Balance"
                : balLimit != null && source.account_type === "credit"
                  ? "Credit limit"
                  : null;
            return (
              <li
                key={source.id}
                className="rounded-xl border border-black/[0.06] bg-white p-3 shadow-sm sm:p-4"
              >
                <div>
                  <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                            isDirectFeed(source.source_type)
                              ? "bg-[#0071e3]/10 text-[#0071e3]"
                              : "bg-[#f5f5f7] text-[#6e6e73]"
                          }`}
                        >
                          {sourceTypeLabel(source.source_type)}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold tracking-tight text-[#1d1d1f]" style={{ fontFamily: "var(--font-sans)" }}>
                          {source.name}
                        </p>
                      </div>
                      {source.institution && (
                        <p className="mt-0.5 text-sm text-[#86868b]" style={{ fontFamily: "var(--font-sans)" }}>
                          {source.institution}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-left sm:mt-1 sm:text-right">
                      {source.source_type === "plaid" && showPlaidBalances && (
                        <>
                          {plaidPrimaryLabel && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">
                                {plaidPrimaryLabel}
                              </p>
                              <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-[#1d1d1f]">
                                {displayMain != null
                                  ? formatCurrency(displayMain, balCurrency)
                                  : balLimit != null
                                    ? formatCurrency(balLimit, balCurrency)
                                    : null}
                              </p>
                            </div>
                          )}
                          {balCurrent != null &&
                            balAvailable != null &&
                            (source.account_type === "credit" || balAvailable !== balCurrent) && (
                              <p className="mt-1 text-xs tabular-nums text-[#6e6e73]">
                                {source.account_type === "credit" ? "Available credit" : "Available"}:{" "}
                                {formatCurrency(balAvailable, balCurrency)}
                              </p>
                            )}
                          {balLimit != null && source.account_type === "credit" && displayMain != null && (
                            <p className="mt-0.5 text-xs tabular-nums text-[#6e6e73]">
                              Limit {formatCurrency(balLimit, balCurrency)}
                            </p>
                          )}
                          {balAsOf && (
                            <p className="mt-1 max-w-[14rem] text-[11px] leading-snug text-[#aeaeb2] sm:ml-auto">
                              As of {balAsOf}
                            </p>
                          )}
                        </>
                      )}
                      {source.source_type === "plaid" && !showPlaidBalances && (
                        <p className="max-w-[220px] text-right text-[12px] leading-snug text-[#86868b] sm:ml-auto sm:text-right">
                          {source.last_successful_sync_at
                            ? "No balance yet — refresh or pull to load from Plaid."
                            : "Balance after first sync — pull or refresh."}
                        </p>
                      )}
                      {source.source_type === "manual" && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">Balance</p>
                          <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-[#1d1d1f]">
                            {manualBalAmt != null ? formatCurrency(manualBalAmt, manualBalCode) : "—"}
                          </p>
                        </div>
                      )}
                      {source.source_type === "stripe" && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">Balance</p>
                          <p className="mt-0.5 text-lg font-semibold tabular-nums text-[#aeaeb2]">—</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/[0.06] pt-3">
                    <span className="text-[12px] font-medium text-[#6e6e73]">Rollups</span>
                    <select
                      aria-label={`Balance class for ${source.name}`}
                      className={`${appleInputClass} max-w-[180px] py-2 text-[13px]`}
                      value={(source.balance_class ?? (source.account_type === "credit" ? "liability" : "asset")) as any}
                      onChange={(e) => {
                        void patchRollupFields(source.id, { balance_class: e.target.value });
                      }}
                    >
                      {ROLLUP_CLASS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={`Balance preference for ${source.name}`}
                      className={`${appleInputClass} max-w-[180px] py-2 text-[13px]`}
                      value={(source.balance_value_preference ?? (source.source_type === "manual" ? "manual" : "current")) as any}
                      onChange={(e) => {
                        void patchRollupFields(source.id, { balance_value_preference: e.target.value });
                      }}
                    >
                      {BALANCE_PREF_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <label className="inline-flex items-center gap-2 text-[12px] font-medium text-[#6e6e73]">
                      <input
                        type="checkbox"
                        checked={source.include_in_net_worth !== false}
                        onChange={(e) => {
                          void patchRollupFields(source.id, { include_in_net_worth: e.target.checked });
                        }}
                      />
                      Include in net worth
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/[0.06] pt-3">
                    <span className="text-[12px] font-medium text-[#6e6e73]">Sidebar color</span>
                    <select
                      aria-label={`Brand color for ${source.name}`}
                      className={`${appleInputClass} max-w-[220px] py-2 text-[13px]`}
                      value={normalizeBrandColorId(source.brand_color_id)}
                      onChange={async (e) => {
                        const brand_color_id = e.target.value;
                        try {
                          const res = await fetch("/api/data-sources", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: source.id, brand_color_id }),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (res.ok && data?.data) {
                            setSources((prev) => prev.map((x) => (x.id === source.id ? { ...x, ...data.data } : x)));
                            window.dispatchEvent(new CustomEvent("accounts-changed"));
                          } else {
                            setToast((data as { error?: string }).error ?? "Could not update color");
                            setTimeout(() => setToast(null), 4000);
                          }
                        } catch {
                          setToast("Could not update color");
                          setTimeout(() => setToast(null), 4000);
                        }
                      }}
                    >
                      {BRAND_COLOR_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {showEarliestYearLine && s.earliestTransactionDateInTaxYear && (
                    <p
                      className="mt-3 max-w-md text-[13px] leading-snug text-[#6e6e73]"
                      style={{ fontFamily: "var(--font-sans)" }}
                    >
                      Earliest in {calendarYear}:{" "}
                      <span className="font-medium text-[#1d1d1f]">
                        {formatEarliestCompact(s.earliestTransactionDateInTaxYear)}
                      </span>
                      {isDirectFeed(source.source_type) && (
                        <>
                          {" · "}
                          <button
                            type="button"
                            onClick={() => setUploadSourceId(source.id)}
                            className="font-medium text-[#0071e3] hover:underline underline-offset-2"
                          >
                            Upload CSV
                          </button>
                          {" for older activity."}
                        </>
                      )}
                    </p>
                  )}
                  {isDirectFeed(source.source_type) && (
                    <div className="text-[13px] text-[#86868b] mt-2 space-y-0.5" style={{ fontFamily: "var(--font-sans)" }}>
                      {!source.last_successful_sync_at && totalTxCount === 0 && (
                        <p>Pull transactions to load activity from your bank.</p>
                      )}
                      {source.last_successful_sync_at && totalTxCount === 0 && (
                        <p>Last sync had no posted transactions in range.</p>
                      )}
                    </div>
                  )}
                  {isDirectFeed(source.source_type) && (connectionStatuses[source.id] === "disconnected" || connectionStatuses[source.id] === "inactive" || connectionStatuses[source.id] === "login_required" || connectionStatuses[source.id] === "error" || !(source.financial_connections_account_id || source.plaid_item_id)) && (
                    <div className="mt-4 rounded-xl bg-[#f5f5f7] p-4">
                      <p className="text-[15px] font-semibold text-[#1d1d1f]" style={{ fontFamily: "var(--font-sans)" }}>
                        {!(source.financial_connections_account_id || source.plaid_item_id)
                          ? "This account isn't linked to a bank."
                          : "This connection is no longer active"}
                      </p>
                      <p className="text-[13px] text-[#6e6e73] mt-1" style={{ fontFamily: "var(--font-sans)" }}>
                        Reconnect your bank to restore syncing.
                      </p>
                      <button
                        type="button"
                        onClick={() => { setShowAdd(true); setAddStep("2b"); }}
                        className="mt-3 rounded-full bg-[#1d1d1f] px-4 py-2 text-[13px] font-medium text-white hover:bg-black/85 transition"
                        style={{ fontFamily: "var(--font-sans)" }}
                      >
                        Repair connection
                      </button>
                    </div>
                  )}
                  {hasSyncFailure && !(isDirectFeed(source.source_type) && (connectionStatuses[source.id] === "disconnected" || connectionStatuses[source.id] === "inactive" || connectionStatuses[source.id] === "login_required" || connectionStatuses[source.id] === "error" || !(source.financial_connections_account_id || source.plaid_item_id))) && (
                    <div className="mt-4 rounded-xl bg-[#f5f5f7] p-4">
                      <p className="text-[15px] font-semibold text-[#1d1d1f]" style={{ fontFamily: "var(--font-sans)" }}>
                        We&apos;re having trouble syncing this account
                      </p>
                      <p className="text-[13px] text-[#6e6e73] mt-1" style={{ fontFamily: "var(--font-sans)" }}>
                        {source.last_successful_sync_at
                          ? `Last synced ${formatMonthDayOrdinal(source.last_successful_sync_at)}`
                          : "Last synced never"}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleRetrySync(source.id)}
                        disabled={syncingId === source.id}
                        className="mt-3 rounded-full bg-[#1d1d1f] px-4 py-2 text-[13px] font-medium text-white hover:bg-black/85 disabled:opacity-50 transition"
                        style={{ fontFamily: "var(--font-sans)" }}
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
                      <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-[#e8e8ed]">
                        <div
                          className="h-full rounded-full bg-[#86868b] transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, s.pctReviewed))}%` }}
                        />
                      </div>
                      <span className="text-[12px] tabular-nums font-medium text-[#6e6e73] shrink-0">
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
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setViewTxConfirmSource(source)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-[13px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition"
                      style={{ fontFamily: "var(--font-sans)" }}
                    >
                      <span
                        className="material-symbols-rounded leading-none"
                        style={{ fontSize: 15 }}
                      >
                        list
                      </span>
                      View transactions
                    </button>
                    {isDirectFeed(source.source_type) && connectionStatuses[source.id] !== "disconnected" && connectionStatuses[source.id] !== "inactive" && connectionStatuses[source.id] !== "login_required" && connectionStatuses[source.id] !== "error" && (source.financial_connections_account_id || source.plaid_item_id) && (
                      <button
                        type="button"
                        onClick={() => setPullModalSource(source)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#0071e3] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#0077ed] transition"
                        style={{ fontFamily: "var(--font-sans)" }}
                      >
                        <span
                          className="material-symbols-rounded leading-none"
                          style={{ fontSize: 15 }}
                        >
                          sync
                        </span>
                        Pull Transactions
                      </button>
                    )}
                    {source.source_type === "plaid" &&
                      connectionStatuses[source.id] !== "disconnected" &&
                      connectionStatuses[source.id] !== "inactive" &&
                      connectionStatuses[source.id] !== "login_required" &&
                      connectionStatuses[source.id] !== "error" &&
                      (source.financial_connections_account_id || source.plaid_item_id) && (
                        <button
                          type="button"
                          onClick={() => handleRefreshPlaidBalance(source.id)}
                          disabled={balanceRefreshingId === source.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-[13px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition disabled:opacity-50"
                          style={{ fontFamily: "var(--font-sans)" }}
                        >
                          <span
                            className={`material-symbols-rounded leading-none ${balanceRefreshingId === source.id ? "animate-spin" : ""}`}
                            style={{ fontSize: 15 }}
                          >
                            {balanceRefreshingId === source.id ? "progress_activity" : "account_balance"}
                          </span>
                          {balanceRefreshingId === source.id ? "Refreshing…" : "Refresh balance"}
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={() => setUploadSourceId(source.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
                        isDirectFeed(source.source_type)
                          ? "border border-black/[0.08] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed]"
                          : "bg-[#0071e3] text-white hover:bg-[#0077ed]"
                      }`}
                      style={{ fontFamily: "var(--font-sans)" }}
                    >
                      <span
                        className="material-symbols-rounded leading-none"
                        style={{ fontSize: 15 }}
                      >
                        upload_file
                      </span>
                      Upload CSV
                    </button>
                    <button
                      onClick={() => openEdit(source)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-[13px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition"
                      aria-label="Edit account"
                      style={{ fontFamily: "var(--font-sans)" }}
                    >
                      <span
                        className="material-symbols-rounded leading-none"
                        style={{ fontSize: 15 }}
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
        <div className="fixed bottom-6 left-1/2 z-50 flex max-w-[min(100%-2rem,480px)] -translate-x-1/2 items-center gap-3 rounded-full border border-black/[0.06] bg-white/95 px-5 py-3 text-[14px] text-[#1d1d1f] shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-md">
          {toast ?? "Account deleted."}
          <Link href="/inbox" className="shrink-0 font-medium text-[#0071e3] underline underline-offset-2 hover:no-underline">
            Open Inbox
          </Link>
        </div>
      )}

      {/* View transactions confirmation modal */}
      {viewTxConfirmSource && (
        <div className={appleOverlayClass} role="dialog" aria-modal="true" aria-labelledby="view-tx-confirm-title">
          <div className={applePanelClass}>
            <div className={appleModalHeadClass}>
              <h2 id="view-tx-confirm-title" className="text-[20px] font-semibold tracking-tight text-mono-dark">
                Create a page for this account?
              </h2>
            </div>
            <div className={`${appleModalBodyClass} space-y-3`}>
              <p className="text-sm text-mono-medium">
                This will create a new Page with a filter for <span className="font-medium text-mono-dark">{viewTxConfirmSource.name}</span>.
              </p>
              <p className="text-xs text-mono-light">
                You can edit the page title, columns, and filters afterward.
              </p>
            </div>
            <div className={appleModalFooterClass}>
              <button
                type="button"
                onClick={() => setViewTxConfirmSource(null)}
                disabled={creatingAccountPage}
                className={appleBtnSecondary}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => createFilteredPageForAccount(viewTxConfirmSource)}
                disabled={creatingAccountPage}
                className={appleBtnPrimary}
              >
                {creatingAccountPage ? "Creating…" : "Create page"}
              </button>
            </div>
          </div>
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
      </div>

      <AccountsShareModal open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
