"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import type { Database } from "@/lib/types/database";
import { UploadModal } from "@/components/UploadModal";
import { useUpgradeModal } from "@/components/UpgradeModalContext";
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
  return sourceType === "stripe" ? "Direct Feed" : "Manual";
}

function formatLastPulled(source: DataSource): string | null {
  if (source.source_type === "stripe") {
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

export function DataSourcesClient({
  initialSources,
  initialStats = {},
  isFree = false,
  stripeSourceCount = 0,
  stripePublishableKey = null,
}: {
  initialSources: DataSource[];
  initialStats?: Record<string, DataSourceStats>;
  isFree?: boolean;
  stripeSourceCount?: number;
  /** Publishable key for Stripe.js Financial Connections (test or live based on host). */
  stripePublishableKey?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openUpgradeModal } = useUpgradeModal();
  const [sources, setSources] = useState<DataSource[]>(initialSources);
  const [stats, setStats] = useState<Record<string, DataSourceStats>>(initialStats);

  useEffect(() => {
    setSources(initialSources);
    setStats(initialStats);
  }, [initialSources, initialStats]);

  const stripeFc = searchParams.get("stripe_fc");
  const err = searchParams.get("error");
  const prevParamsRef = useRef<string>("");
  const [showPostConnectDateModal, setShowPostConnectDateModal] = useState(false);
  const [loadingNewAccounts, setLoadingNewAccounts] = useState(false);
  useEffect(() => {
    const key = `${stripeFc ?? ""}|${err ?? ""}`;
    if (key === prevParamsRef.current) return;
    prevParamsRef.current = key;
    if (stripeFc === "success") {
      setToast("Bank account(s) connected.");
      setTimeout(() => setToast(null), 5000);
      setLoadingNewAccounts(true);
      // Fetch sources first so new accounts appear in the list, then show date modal and clear URL
      fetch("/api/data-sources")
        .then((r) => r.ok ? r.json() : null)
        .then((body) => {
          if (body?.data) setSources(body.data);
          setShowPostConnectDateModal(true);
          router.replace("/data-sources", { scroll: false });
        })
        .catch(() => {})
        .finally(() => setLoadingNewAccounts(false));
    } else if (stripeFc === "already_linked") {
      setToast("Account reconnected.");
      setTimeout(() => setToast(null), 4000);
      setLoadingNewAccounts(true);
      fetch("/api/data-sources")
        .then((r) => r.ok ? r.json() : null)
        .then((body) => {
          if (body?.data) setSources(body.data);
          setShowPostConnectDateModal(true);
          router.replace("/data-sources", { scroll: false });
        })
        .catch(() => {})
        .finally(() => setLoadingNewAccounts(false));
    } else if (err) {
      setToast(decodeURIComponent(err));
      setTimeout(() => setToast(null), 6000);
      router.replace("/data-sources", { scroll: false });
    }
  }, [stripeFc, err, router]);

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
  // Bank Pulling step 2b state
  const [lookback, setLookback] = useState<"2years" | "forward" | "custom">("2years");
  const [customStartDate, setCustomStartDate] = useState("");
  const [stripeConnectLoading, setStripeConnectLoading] = useState(false);
  const [stripeConnectError, setStripeConnectError] = useState<string | null>(null);
  const [stripeStatuses, setStripeStatuses] = useState<Record<string, "active" | "disconnected" | "inactive" | null>>({});
  const [addModalLoading, setAddModalLoading] = useState(false);
  const [deleteConfirmSource, setDeleteConfirmSource] = useState<DataSource | null>(null);
  const [deleteAlsoTransactions, setDeleteAlsoTransactions] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pullDatesBySource, setPullDatesBySource] = useState<Record<string, { start: string; end: string }>>({});
  const [pullModalSource, setPullModalSource] = useState<DataSource | null>(null);
  type SyncStatusBar = { message: string; type: "syncing" | "success" | "error" } | null;
  const [syncStatusBar, setSyncStatusBar] = useState<SyncStatusBar>(null);
  // Post-connect date modal (after Stripe accounts load)
  const [postConnectLookback, setPostConnectLookback] = useState<"2years" | "forward" | "custom">("2years");
  const [postConnectCustomStartDate, setPostConnectCustomStartDate] = useState("");
  const [postConnectPulling, setPostConnectPulling] = useState(false);
  const [postConnectError, setPostConnectError] = useState<string | null>(null);

  const addAccountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showPostConnectDateModal) {
      setPostConnectLookback("2years");
      setPostConnectCustomStartDate("");
      setPostConnectError(null);
    }
  }, [showPostConnectDateModal]);

  const stripeIdsRef = useRef<string>("");
  useEffect(() => {
    const stripeIds = sources.filter((s) => s.source_type === "stripe").map((s) => s.id);
    const key = stripeIds.sort().join(",");
    if (stripeIds.length === 0 || key === stripeIdsRef.current) return;
    stripeIdsRef.current = key;
    const updates: Record<string, "active" | "disconnected" | "inactive"> = {};
    let pending = stripeIds.length;
    stripeIds.forEach((id) => {
      fetch(`/api/data-sources/stripe/status?data_source_id=${encodeURIComponent(id)}`)
        .then((r) => r.json())
        .then((body) => {
          if (body.status && body.status !== "n/a") updates[id] = body.status;
        })
        .catch(() => {})
        .finally(() => {
          pending--;
          if (pending === 0 && Object.keys(updates).length > 0) {
            setStripeStatuses((prev) => ({ ...prev, ...updates }));
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
        await reloadSources();
        window.dispatchEvent(new CustomEvent("inbox-count-changed"));
        setSyncStatusBar({ message: "Sync complete", type: "success" });
        setTimeout(() => setSyncStatusBar(null), 5000);
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
        setStats((prev) => ({ ...prev, [data.data.id]: { transactionCount: 0, totalIncome: 0, totalExpenses: 0, pctReviewed: 0, totalSavings: 0 } }));
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
    setLookback("2years");
    setCustomStartDate("");
    setStripeConnectError(null);
  }, []);
  const closeEdit = useCallback(() => setEditSource(null), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showAdd) closeAdd();
        if (editSource) closeEdit();
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
          if (isFree && stripeSourceCount >= 1) {
            openUpgradeModal("stripe_sources");
          } else {
            setAddStep("2b");
          }
        }
      }
    }
    if (showAdd || editSource) {
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showAdd, editSource, addStep, isFree, stripeSourceCount, openUpgradeModal, closeAdd, closeEdit]);

  useEffect(() => {
    if (showAdd) {
      const t = setTimeout(() => addAccountInputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [showAdd]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-mono-dark">Accounts</h1>
          <p className="text-sm text-mono-medium mt-1">
            Accounts you upload transactions from
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <kbd className="kbd-hint kbd-on-primary mr-2.5">a</kbd>
          New account
        </button>
      </div>

      {syncStatusBar && (
        <div
          role="status"
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
            syncStatusBar.type === "syncing"
              ? "border-[#635bff]/30 bg-[#635bff]/5 text-mono-dark"
              : syncStatusBar.type === "success"
                ? "border-accent-sage/40 bg-accent-sage/10 text-mono-dark"
                : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {syncStatusBar.type === "syncing" && (
            <span className="material-symbols-rounded animate-spin text-lg text-[#635bff]">progress_activity</span>
          )}
          {syncStatusBar.type === "success" && (
            <span className="material-symbols-rounded text-lg text-accent-sage">check_circle</span>
          )}
          {syncStatusBar.type === "error" && (
            <span className="material-symbols-rounded text-lg text-amber-600">error</span>
          )}
          <span className="font-medium">{syncStatusBar.message}</span>
        </div>
      )}

      {/* Add account modal - multi-step */}
      {showAdd && (
        <div
          className="fixed inset-0 min-h-[100dvh] z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-account-title"
        >
          <div className="rounded-xl bg-white shadow-[0_8px_30px_-6px_rgba(0,0,0,0.14)] max-w-[560px] w-full mx-4 overflow-hidden relative">
            {addModalLoading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-xl">
                <span className="material-symbols-rounded animate-spin text-3xl text-mono-medium">progress_activity</span>
              </div>
            )}
            <div className="rounded-t-xl bg-[#2d3748] px-6 pt-6 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="add-account-title" className="text-xl font-bold text-white tracking-tight">
                    {addStep === "1" && "Add account"}
                    {addStep === "2a" && "Manual account"}
                    {addStep === "2b" && "Direct Feed"}
                  </h2>
                  <p className="text-sm text-white/80 mt-1.5 leading-relaxed">
                    {addStep === "1" && "Choose how you want to add transactions."}
                    {addStep === "2a" && "Add an account for CSV uploads and manual entry."}
                    {addStep === "2b" && "Connect your bank in Stripe; after accounts load you’ll choose a date range and we’ll pull transactions."}
                  </p>
                </div>
                <button
                  onClick={closeAdd}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition shrink-0"
                  aria-label="Close"
                >
                  <span className="material-symbols-rounded text-[18px]">close</span>
                </button>
              </div>
            </div>

            {addStep === "1" && (
              <div className="px-6 py-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setAddStep("2a")}
                    className="rounded-xl border-2 border-bg-tertiary p-5 text-left hover:border-accent-sage/50 hover:bg-bg-secondary/50 transition"
                  >
                    <span className="material-symbols-rounded text-4xl text-mono-medium">edit_note</span>
                    <p className="font-semibold text-mono-dark mt-3 text-lg">Manual</p>
                    <p className="text-sm text-mono-light mt-1">Add accounts manually; transactions come via CSV uploads or manual entry.</p>
                    <p className="text-xs text-mono-light mt-2">
                      <kbd className="kbd-hint">m</kbd>
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (isFree && stripeSourceCount >= 1) {
                        openUpgradeModal("stripe_sources");
                      } else {
                        setAddStep("2b");
                      }
                    }}
                    className={`rounded-xl border-2 p-5 text-left transition ${
                      isFree && stripeSourceCount >= 1
                        ? "border-bg-tertiary bg-bg-secondary/50 opacity-90 relative"
                        : "border-bg-tertiary hover:border-[#635bff]/50 hover:bg-[#635bff]/5"
                    }`}
                  >
                    {isFree && stripeSourceCount >= 1 && (
                      <span className="absolute top-3 right-3 rounded bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 flex items-center gap-1">
                        <span className="material-symbols-rounded text-[14px]">lock</span>
                        Pro
                      </span>
                    )}
                    <span className="material-symbols-rounded text-4xl" style={{ color: "#635bff" }}>account_balance</span>
                    <p className="font-semibold text-mono-dark mt-3 text-lg">Direct Feed</p>
                    <p className="text-sm text-mono-light mt-1">
                      Connect a bank via Stripe Financial Connections. After connecting, choose a date range and we’ll load transactions.
                    </p>
                    <p className="text-xs text-mono-light mt-2">
                      <kbd className="kbd-hint">d</kbd>
                    </p>
                  </button>
                </div>
                <a
                  href="https://stripe.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-lg border border-bg-tertiary/60 text-sm font-medium text-mono-medium hover:text-mono-dark hover:bg-bg-secondary/50 transition"
                  style={{ color: "#635bff" }}
                >
                  <span className="inline-flex items-center justify-center" style={{ color: "#635bff", transform: "scale(0.6)", transformOrigin: "center" }}>
                    <span className="material-symbols-rounded text-[20px]">open_in_new</span>
                  </span>
                  Learn about Stripe
                </a>
              </div>
            )}

            {addStep === "2a" && (
              <>
                <div className="px-6 py-4 border-b border-bg-tertiary/40">
                  <button
                    type="button"
                    onClick={() => setAddStep("1")}
                    className="text-sm font-medium text-mono-medium hover:text-mono-dark flex items-center gap-1"
                  >
                    <span className="material-symbols-rounded text-[18px]">arrow_back</span>
                    Back
                  </button>
                </div>
                <div className="px-6 py-6 space-y-5">
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
                      className="w-full border border-bg-tertiary rounded-md px-3.5 py-2.5 text-sm text-mono-dark bg-white placeholder:text-mono-light focus:ring-2 focus:ring-accent-sage/20 focus:border-accent-sage/40 outline-none transition"
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
                      className="w-full border border-bg-tertiary rounded-md px-3.5 py-2.5 text-sm text-mono-dark bg-white placeholder:text-mono-light focus:ring-2 focus:ring-accent-sage/20 focus:border-accent-sage/40 outline-none transition"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-bg-tertiary/40">
                  <button
                    onClick={() => setAddStep("1")}
                    disabled={saving}
                    className="rounded-md border border-bg-tertiary bg-white px-4 py-2.5 text-sm font-semibold text-mono-dark hover:bg-bg-secondary transition disabled:opacity-40"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={saving || !name.trim()}
                    className="rounded-md bg-mono-dark px-4 py-2.5 text-sm font-semibold text-white hover:bg-mono-dark/90 transition disabled:opacity-40"
                  >
                    {saving ? "Creating..." : "Create account"}
                  </button>
                </div>
              </>
            )}

            {addStep === "2b" && (
              <>
                <div className="px-6 py-4 border-b border-bg-tertiary/40">
                  <button
                    type="button"
                    onClick={() => { setAddStep("1"); setStripeConnectError(null); }}
                    disabled={stripeConnectLoading}
                    className="text-sm font-medium text-mono-medium hover:text-mono-dark flex items-center gap-1 disabled:opacity-50"
                  >
                    <span className="material-symbols-rounded text-[18px]">arrow_back</span>
                    Back
                  </button>
                </div>
                {stripeConnectLoading ? (
                  <div className="px-6 py-16 flex flex-col items-center justify-center gap-4">
                    <span className="material-symbols-rounded animate-spin text-4xl text-mono-medium">progress_activity</span>
                    <p className="text-sm font-medium text-mono-dark">Connecting to Stripe…</p>
                    <p className="text-xs text-mono-light">Select your bank and accounts in the window that opened.</p>
                  </div>
                ) : (
                  <div className="px-6 py-6 space-y-5">
                    <p className="text-sm text-mono-medium">
                      You’ll choose your bank and accounts in Stripe. After they’re connected, you’ll pick how much history to pull and we’ll load transactions.
                    </p>
                    {stripeConnectError && (
                      <p className="text-sm text-red-600">{stripeConnectError}</p>
                    )}
                  </div>
                )}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-bg-tertiary/40">
                  <button
                    onClick={() => setAddStep("1")}
                    disabled={stripeConnectLoading}
                    className="rounded-md border border-bg-tertiary bg-white px-4 py-2.5 text-sm font-semibold text-mono-dark hover:bg-bg-secondary transition disabled:opacity-40"
                  >
                    Back
                  </button>
                  <button
                    onClick={async () => {
                      setStripeConnectError(null);
                      setStripeConnectLoading(true);
                      try {
                        const res = await fetch("/api/data-sources/stripe/connect", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({}),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (res.ok && data.url) {
                          window.location.href = data.url;
                          return;
                        }
                        if (res.ok && data.client_secret) {
                          if (!stripePublishableKey) {
                            setStripeConnectError("Stripe publishable key not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY for production or NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_TEST for localhost (and restart the dev server).");
                            setStripeConnectLoading(false);
                            return;
                          }
                          const stripe = await loadStripe(stripePublishableKey);
                          if (!stripe) {
                            setStripeConnectError("Could not load Stripe.");
                            setStripeConnectLoading(false);
                            return;
                          }
                          const collect = (stripe as { collectFinancialConnectionsAccounts?: (opts: { clientSecret: string }) => Promise<{ financialConnectionsSession?: { id: string }; error?: { message?: string } }> }).collectFinancialConnectionsAccounts;
                          if (!collect) {
                            setStripeConnectError("This Stripe.js version does not support Financial Connections. Please update @stripe/stripe-js.");
                            setStripeConnectLoading(false);
                            return;
                          }
                          try {
                            const result = await collect({ clientSecret: data.client_secret });
                            if (result?.error?.message) {
                              setStripeConnectError(result.error.message);
                              setStripeConnectLoading(false);
                              return;
                            }
                            const sessionId = result?.financialConnectionsSession?.id;
                            if (sessionId) {
                              const callbackUrl = `${window.location.origin}/api/data-sources/stripe/callback?session_id=${encodeURIComponent(sessionId)}&format=json`;
                              const cbRes = await fetch(callbackUrl, { credentials: "include" });
                              const cbData = await cbRes.json().catch(() => ({}));
                              if (cbData.success) {
                                if ((cbData.accountCount ?? 0) > 0) {
                                  setShowAdd(false);
                                  setAddStep("1");
                                  setStripeConnectError(null);
                                  setToast("Bank account(s) connected.");
                                  setTimeout(() => setToast(null), 5000);
                                  await reloadSources();
                                  setShowPostConnectDateModal(true);
                                } else {
                                  setStripeConnectError("No accounts were selected. Select at least one account and try again.");
                                }
                              } else {
                                setStripeConnectError(cbData.error ?? "Could not save account.");
                              }
                              setStripeConnectLoading(false);
                              return;
                            }
                            const initialStripeCount = sources.filter((s) => s.source_type === "stripe").length;
                            const pollMs = 20000;
                            const intervalMs = 2000;
                            const deadline = Date.now() + pollMs;
                            let found = false;
                            while (Date.now() < deadline) {
                              await new Promise((r) => setTimeout(r, intervalMs));
                              const rRes = await fetch("/api/data-sources", { credentials: "include" });
                              if (rRes.ok) {
                                const { data: list } = await rRes.json();
                                const newCount = (list ?? []).filter((s: { source_type?: string }) => s.source_type === "stripe").length;
                                if (newCount > initialStripeCount) {
                                  found = true;
                                  break;
                                }
                              }
                            }
                            if (found) {
                              setShowAdd(false);
                              setAddStep("1");
                              setStripeConnectError(null);
                              setToast("Bank account(s) connected.");
                              setTimeout(() => setToast(null), 5000);
                              await reloadSources();
                              setShowPostConnectDateModal(true);
                            } else {
                              setStripeConnectError("No accounts were linked. Would you like to try again?");
                            }
                          } catch (err) {
                            setStripeConnectError(err instanceof Error ? err.message : "Connection failed");
                          }
                          setStripeConnectLoading(false);
                          return;
                        }
                        setStripeConnectError(data.error ?? "Could not start connection");
                      } finally {
                        setStripeConnectLoading(false);
                      }
                    }}
                    disabled={stripeConnectLoading}
                    className="rounded-md px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-40"
                    style={{ backgroundColor: "#635bff" }}
                  >
                    {stripeConnectLoading ? "Connecting…" : "Connect with Stripe"}
                  </button>
                </div>
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
          <div className="rounded-xl bg-white shadow-[0_8px_30px_-6px_rgba(0,0,0,0.14)] max-w-[500px] w-full mx-4 overflow-hidden">
            <div className="rounded-t-xl bg-[#2d3748] px-6 pt-6 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="edit-account-title" className="text-xl font-bold text-white tracking-tight">
                    Edit account
                  </h2>
                  <p className="text-sm text-white/80 mt-1.5">
                    Update name and institution for this account.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditSource(null)}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition shrink-0"
                  aria-label="Close"
                >
                  <span className="material-symbols-rounded text-[18px]">close</span>
                </button>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editName.trim() && !editSaving) handleSaveEdit();
              }}
            >
              <div className="px-6 py-6 space-y-5">
                <div>
                  <label className="text-sm font-medium text-mono-dark block mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. Chase Business Checking"
                    className="w-full border border-bg-tertiary rounded-md px-3.5 py-2.5 text-sm text-mono-dark bg-white placeholder:text-mono-light focus:ring-2 focus:ring-accent-sage/20 focus:border-accent-sage/40 outline-none transition"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-mono-dark block mb-2">
                    Institution
                  </label>
                  <input
                    type="text"
                    value={editInstitution}
                    onChange={(e) => setEditInstitution(e.target.value)}
                    placeholder="e.g. Chase, Amex"
                    disabled={editSource?.source_type === "stripe"}
                    className="w-full border border-bg-tertiary rounded-md px-3.5 py-2.5 text-sm text-mono-dark bg-white placeholder:text-mono-light focus:ring-2 focus:ring-accent-sage/20 focus:border-accent-sage/40 outline-none transition disabled:bg-bg-secondary disabled:text-mono-light disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-bg-tertiary/40">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmSource(editSource)}
                  disabled={editSaving}
                  className="rounded-md bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-40"
                >
                  Delete
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditSource(null)}
                    disabled={editSaving}
                    className="rounded-md border border-bg-tertiary bg-white px-4 py-2.5 text-sm font-semibold text-mono-dark hover:bg-bg-secondary transition disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSaving || !editName.trim()}
                    className="rounded-md bg-mono-dark px-4 py-2.5 text-sm font-semibold text-white hover:bg-mono-dark/90 transition disabled:opacity-40"
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
      {pullModalSource && (
        <div
          className="fixed inset-0 min-h-[100dvh] z-[60] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pull-transactions-title"
        >
          <div className="rounded-xl bg-white shadow-xl max-w-[420px] w-full mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <h2 id="pull-transactions-title" className="text-lg font-bold text-mono-dark">
                Pull transactions
              </h2>
              <p className="text-sm text-mono-medium mt-1.5">
                {pullModalSource.name}
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-sm font-medium text-mono-dark block mb-1.5">From date</label>
                  <input
                    type="date"
                    value={pullDatesBySource[pullModalSource.id]?.start ?? ""}
                    onChange={(e) => setPullDatesBySource((prev) => ({ ...prev, [pullModalSource.id]: { ...(prev[pullModalSource.id] ?? { start: "", end: "" }), start: e.target.value } }))}
                    className="w-full rounded border border-bg-tertiary px-3 py-2 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-mono-dark block mb-1.5">To date</label>
                  <input
                    type="date"
                    value={pullDatesBySource[pullModalSource.id]?.end ?? ""}
                    onChange={(e) => setPullDatesBySource((prev) => ({ ...prev, [pullModalSource.id]: { ...(prev[pullModalSource.id] ?? { start: "", end: "" }), end: e.target.value } }))}
                    className="w-full rounded border border-bg-tertiary px-3 py-2 text-sm bg-white"
                  />
                </div>
              </div>
              <p className="text-xs text-mono-light mt-3">Leave dates empty to use default range. Duplicates are not added.</p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-bg-tertiary/40">
              <button
                type="button"
                onClick={() => setPullModalSource(null)}
                disabled={syncingId === pullModalSource.id}
                className="rounded-md border border-bg-tertiary bg-white px-4 py-2.5 text-sm font-semibold text-mono-dark hover:bg-bg-secondary transition disabled:opacity-40"
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
                      setPullModalSource(null);
                      await reloadSources();
                      window.dispatchEvent(new CustomEvent("inbox-count-changed"));
                      const data = await res.json().catch(() => ({}));
                      setSyncStatusBar({ message: "Sync complete", type: "success" });
                      setTimeout(() => setSyncStatusBar(null), 5000);
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
                className="rounded-md bg-accent-terracotta px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-terracotta-dark transition disabled:opacity-40"
              >
                {syncingId === pullModalSource.id ? "Pulling…" : "Pull transactions"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete account confirmation modal */}
      {deleteConfirmSource && (
        <div
          className="fixed inset-0 min-h-[100dvh] z-[60] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          <div className="rounded-xl bg-white shadow-xl max-w-[400px] w-full mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <h2 id="delete-confirm-title" className="text-lg font-bold text-mono-dark">
                Delete account?
              </h2>
              <p className="text-sm text-mono-medium mt-2">
                Are you sure you want to delete <strong>{deleteConfirmSource.name}</strong>? This cannot be undone.
              </p>
              <div className="mt-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteAlsoTransactions}
                    onChange={(e) => setDeleteAlsoTransactions(e.target.checked)}
                    className="mt-1 rounded border-bg-tertiary"
                  />
                  <span className="text-sm text-mono-dark">
                    Also delete all transactions from this account
                  </span>
                </label>
                <p className="text-xs text-mono-light mt-1 ml-6">
                  {deleteAlsoTransactions ? "Transactions will be permanently removed." : "Transactions will be kept but unlinked from this account."}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-bg-tertiary/40">
              <button
                type="button"
                onClick={() => { setDeleteConfirmSource(null); }}
                disabled={deleteLoading}
                className="rounded-md border border-bg-tertiary bg-white px-4 py-2.5 text-sm font-semibold text-mono-dark hover:bg-bg-secondary transition disabled:opacity-40"
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
                className="rounded-md bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-40"
              >
                {deleteLoading ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-connect date range modal: choose history and pull after Stripe accounts load */}
      {showPostConnectDateModal && (() => {
        const unsyncedStripeSources = sources.filter(
          (s) => s.source_type === "stripe" && s.last_successful_sync_at == null
        );
        if (unsyncedStripeSources.length === 0) {
          return null;
        }
        const twoYearsAgo = (() => {
          const d = new Date();
          d.setFullYear(d.getFullYear() - 2);
          return d.toISOString().slice(0, 10);
        })();
        const today = new Date().toISOString().slice(0, 10);
        let startDate: string | null = null;
        if (postConnectLookback === "2years") startDate = twoYearsAgo;
        else if (postConnectLookback === "custom" && postConnectCustomStartDate) startDate = postConnectCustomStartDate;
        const canPull = postConnectLookback !== "custom" || (postConnectCustomStartDate && new Date(postConnectCustomStartDate) >= new Date(twoYearsAgo));
        const accountNames = unsyncedStripeSources.map((s) => s.name).join(", ");
        return (
          <div
            className="fixed inset-0 min-h-[100dvh] z-[60] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="post-connect-date-title"
          >
            <div className="rounded-xl bg-white shadow-xl max-w-[480px] w-full mx-4 overflow-hidden">
              {postConnectPulling ? (
                <div className="px-6 py-12 flex flex-col items-center justify-center gap-4">
                  <span className="material-symbols-rounded animate-spin text-4xl text-accent-terracotta">progress_activity</span>
                  <h2 id="post-connect-date-title" className="text-lg font-bold text-mono-dark text-center">
                    Loading transactions
                  </h2>
                  <p className="text-sm text-mono-medium text-center">
                    Pulling from {unsyncedStripeSources.length > 1 ? "your accounts" : accountNames}… This may take a minute.
                  </p>
                </div>
              ) : (
                <>
                  <div className="px-6 pt-6 pb-4">
                    <h2 id="post-connect-date-title" className="text-lg font-bold text-mono-dark">
                      Choose how much history to pull
                    </h2>
                    <p className="text-sm text-mono-medium mt-1">
                      Your account{unsyncedStripeSources.length > 1 ? "s are" : " is"} connected and appear in your list below. Select a date range and we’ll load transactions.
                    </p>
                    <ul className="mt-3 text-sm text-mono-medium list-disc list-inside">
                      {unsyncedStripeSources.map((s) => (
                        <li key={s.id}>{s.name}</li>
                      ))}
                    </ul>
                    {postConnectError && (
                      <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{postConnectError}</p>
                    )}
                    <div className="mt-5 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => { setPostConnectLookback("2years"); setPostConnectError(null); }}
                          className={`rounded-lg border-2 px-4 py-3 text-left text-sm ${postConnectLookback === "2years" ? "border-bg-tertiary bg-bg-secondary" : "border-bg-tertiary"}`}
                        >
                          <span className="font-semibold text-mono-dark">Last 2 years</span>
                          <p className="text-mono-light mt-0.5">Maximum supported</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setPostConnectLookback("forward"); setPostConnectError(null); }}
                          className={`rounded-lg border-2 px-4 py-3 text-left text-sm ${postConnectLookback === "forward" ? "border-bg-tertiary bg-bg-secondary" : "border-bg-tertiary"}`}
                        >
                          <span className="font-semibold text-mono-dark">Going forward only</span>
                          <p className="text-mono-light mt-0.5">No history</p>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setPostConnectLookback("custom"); setPostConnectError(null); }}
                        className={`w-full rounded-lg border-2 px-4 py-3 text-left text-sm ${postConnectLookback === "custom" ? "border-bg-tertiary bg-bg-secondary" : "border-bg-tertiary"}`}
                      >
                        <span className="font-semibold text-mono-dark">Custom start date</span>
                        <p className="text-mono-light mt-0.5">Pick a date (max 2 years ago)</p>
                      </button>
                      {postConnectLookback === "custom" && (
                        <div>
                          <label className="text-sm font-medium text-mono-dark block mb-2">Start date</label>
                          <input
                            type="date"
                            value={postConnectCustomStartDate}
                            onChange={(e) => setPostConnectCustomStartDate(e.target.value)}
                            className="w-full border border-bg-tertiary rounded-md px-3.5 py-2.5 text-sm"
                          />
                          {postConnectCustomStartDate && new Date(postConnectCustomStartDate) < new Date(twoYearsAgo) && (
                            <p className="text-xs text-red-600 mt-1">Date must be within the last 2 years</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 px-6 py-4 border-t border-bg-tertiary/40">
                    <button
                      type="button"
                      onClick={() => { setShowPostConnectDateModal(false); setPostConnectError(null); }}
                      disabled={postConnectPulling}
                      className="rounded-md border border-bg-tertiary bg-white px-4 py-2.5 text-sm font-semibold text-mono-dark hover:bg-bg-secondary transition disabled:opacity-40"
                    >
                      Skip for now
                    </button>
                    <button
                      type="button"
                      disabled={postConnectPulling || !canPull}
                      onClick={async () => {
                        setPostConnectPulling(true);
                        setPostConnectError(null);
                        try {
                          const start = startDate ?? null;
                          const failed: { name: string }[] = [];
                          for (const source of unsyncedStripeSources) {
                            if (start) {
                              const patchRes = await fetch("/api/data-sources", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: source.id, stripe_sync_start_date: start }),
                              });
                              if (!patchRes.ok) {
                                failed.push({ name: source.name });
                                continue;
                              }
                            }
                            const syncBody: { data_source_id: string; start_date?: string; end_date: string } = {
                              data_source_id: source.id,
                              end_date: today,
                            };
                            if (start) syncBody.start_date = start;
                            const res = await fetch("/api/data-sources/sync", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(syncBody),
                            });
                            if (!res.ok) failed.push({ name: source.name });
                          }
                          setShowPostConnectDateModal(false);
                          await reloadSources();
                          window.dispatchEvent(new CustomEvent("inbox-count-changed"));
                          const okCount = unsyncedStripeSources.length - failed.length;
                          if (okCount > 0) {
                            setSyncStatusBar({
                              message: failed.length > 0
                                ? `Loaded ${okCount} account${okCount === 1 ? "" : "s"}. ${failed.length} couldn’t be loaded — retry or reconnect from the card.`
                                : "Transactions loaded",
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
                      className="rounded-md bg-accent-terracotta px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-terracotta-dark transition disabled:opacity-40"
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
            };
            const txCount = source.source_type === "stripe" ? (source.transaction_count ?? 0) : s.transactionCount;
            const hasSyncFailure = !!source.last_failed_sync_at;
            return (
              <li key={source.id} className="card overflow-hidden">
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        source.source_type === "stripe"
                          ? "bg-[#635bff]/10 text-[#635bff]"
                          : "bg-bg-tertiary text-mono-medium"
                      }`}
                    >
                      {sourceTypeLabel(source.source_type)}
                    </span>
                    <span className="text-xs text-mono-light">
                      {accountTypeLabel(source.account_type)}
                    </span>
                  </div>
                  <p className="text-lg font-semibold text-mono-dark">{source.name}</p>
                  {source.institution && (
                    <p className="text-sm text-mono-light">{source.institution}</p>
                  )}
                  {source.source_type === "stripe" && (
                    <div className="text-xs text-mono-light mt-1 space-y-0.5">
                      <p className="tabular-nums">
                        Last pulled: {formatLastPulled(source)}
                        <span className="font-medium text-mono-dark ml-1">
                          · {txCount === 0 ? "0 transactions" : `${txCount} transactions`}
                        </span>
                      </p>
                      {!source.last_successful_sync_at && txCount === 0 && (
                        <p className="text-mono-medium">
                          Pull transactions to load activity from your bank.
                        </p>
                      )}
                      {source.last_successful_sync_at && txCount === 0 && (
                        <p className="text-mono-medium">
                          Sync completed; no posted transactions in the selected date range.
                        </p>
                      )}
                    </div>
                  )}
                  {source.source_type === "stripe" && (stripeStatuses[source.id] === "disconnected" || stripeStatuses[source.id] === "inactive" || !source.financial_connections_account_id) && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-medium text-amber-800">
                        {!source.financial_connections_account_id
                          ? "This account isn't linked to a bank."
                          : "This connection is no longer active."}
                      </p>
                      <p className="text-xs text-amber-700 mt-1">Reconnect your bank to restore syncing.</p>
                      <button
                        type="button"
                        onClick={() => { setShowAdd(true); setAddStep("2b"); }}
                        className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                      >
                        Repair connection
                      </button>
                    </div>
                  )}
                  {hasSyncFailure && !(source.source_type === "stripe" && (stripeStatuses[source.id] === "disconnected" || stripeStatuses[source.id] === "inactive" || !source.financial_connections_account_id)) && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-medium text-amber-800">We couldn&apos;t sync this account.</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Last successful sync: {source.last_successful_sync_at ? new Date(source.last_successful_sync_at).toLocaleString() : "Never"}
                      </p>
                      {source.last_error_summary && (
                        <p className="text-xs text-amber-700 mt-0.5">{source.last_error_summary}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRetrySync(source.id)}
                        disabled={syncingId === source.id}
                        className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        {syncingId === source.id ? "Syncing…" : "Retry sync"}
                      </button>
                    </div>
                  )}
                  {s.transactionCount > 0 && !hasSyncFailure && (
                    <>
                  <div className="mt-3">
                    <p className="text-xs text-mono-light mb-1.5">
                      <span className="tabular-nums font-medium text-mono-dark">{s.transactionCount}</span>
                      {" transactions"}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent-sage transition-all duration-300"
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
                    {source.source_type === "stripe" && stripeStatuses[source.id] !== "disconnected" && stripeStatuses[source.id] !== "inactive" && source.financial_connections_account_id && (
                      <button
                        type="button"
                        onClick={() => setPullModalSource(source)}
                        className="inline-flex items-center gap-2 rounded-md bg-accent-terracotta px-3 py-2 text-sm font-medium text-white hover:bg-accent-terracotta-dark transition"
                      >
                        <span className="material-symbols-rounded text-[6px]">sync</span>
                        Pull Transactions
                      </button>
                    )}
                    {source.source_type !== "stripe" && (
                    <button
                      onClick={() => setUploadSourceId(source.id)}
                      className="inline-flex items-center gap-2 rounded-md bg-accent-terracotta px-3 py-2 text-sm font-medium text-white hover:bg-accent-terracotta-dark transition"
                    >
                      <span className="material-symbols-rounded text-[6px]">upload_file</span>
                      Upload CSV
                    </button>
                    )}
                    <button
                      onClick={() => openEdit(source)}
                      className="inline-flex items-center gap-2 rounded-md border border-bg-tertiary/60 px-3 py-2 text-sm font-medium text-mono-medium hover:bg-bg-secondary/60 transition"
                      aria-label="Edit account"
                    >
                      <span className="material-symbols-rounded text-[6px]">edit</span>
                      Edit
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-mono-dark text-white px-4 py-2.5 text-sm shadow-lg flex items-center gap-2">
          {toast}
          <Link href="/inbox" className="font-medium underline underline-offset-2 hover:no-underline">
            Open Inbox
          </Link>
        </div>
      )}

      {uploadSourceId && (
        <UploadModal
          dataSourceId={uploadSourceId}
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
