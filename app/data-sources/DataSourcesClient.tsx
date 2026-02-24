"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Database } from "@/lib/types/database";
import { UploadModal } from "@/components/UploadModal";
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function DataSourcesClient({
  initialSources,
  initialStats = {},
}: {
  initialSources: DataSource[];
  initialStats?: Record<string, DataSourceStats>;
}) {
  const router = useRouter();
  const [sources, setSources] = useState<DataSource[]>(initialSources);
  const [stats, setStats] = useState<Record<string, DataSourceStats>>(initialStats);

  useEffect(() => {
    setSources(initialSources);
    setStats(initialStats);
  }, [initialSources, initialStats]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState("checking");
  const [institution, setInstitution] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadSourceId, setUploadSourceId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editSource, setEditSource] = useState<DataSource | null>(null);
  const [editName, setEditName] = useState("");
  const [editAccountType, setEditAccountType] = useState("checking");
  const [editInstitution, setEditInstitution] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const addAccountInputRef = useRef<HTMLInputElement>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);

    const res = await fetch("/api/data-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, account_type: accountType, institution: institution || undefined }),
    });

    if (res.ok) {
      const { data } = await res.json();
      setSources((prev) => [data, ...prev]);
      setStats((prev) => ({ ...prev, [data.id]: { transactionCount: 0, totalIncome: 0, totalExpenses: 0, pctReviewed: 0, totalSavings: 0 } }));
      setName("");
      setInstitution("");
      setShowAdd(false);
    }
    setSaving(false);
  }

  function openEdit(source: DataSource) {
    setEditSource(source);
    setEditName(source.name);
    setEditAccountType(source.account_type);
    setEditInstitution(source.institution ?? "");
  }

  async function handleSaveEdit() {
    if (!editSource) return;
    setEditSaving(true);
    const res = await fetch("/api/data-sources", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editSource.id,
        name: editName,
        account_type: editAccountType,
        institution: editInstitution || undefined,
      }),
    });
    if (res.ok) {
      const { data } = await res.json();
      setSources((prev) => prev.map((s) => (s.id === data.id ? data : s)));
      setEditSource(null);
    }
    setEditSaving(false);
  }

  async function reloadSources() {
    const res = await fetch("/api/data-sources");
    if (res.ok) {
      const { data } = await res.json();
      setSources(data ?? []);
    }
    router.refresh();
  }

  const closeAdd = useCallback(() => setShowAdd(false), []);
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
    }
    if (showAdd || editSource) {
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showAdd, editSource, closeAdd, closeEdit]);

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
          <h1 className="text-3xl font-bold text-mono-dark">Data Sources</h1>
          <p className="text-sm text-mono-medium mt-1">
            Accounts you upload transactions from
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <kbd className="kbd-hint kbd-on-primary mr-2.5">a</kbd>
          New Source
        </button>
      </div>

      {/* Add Account Modal */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-account-title"
        >
          <div className="rounded-xl bg-white shadow-[0_8px_30px_-6px_rgba(0,0,0,0.14)] max-w-[500px] w-full mx-4 overflow-hidden">
            <div className="rounded-t-xl bg-[#2d3748] px-6 pt-6 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="add-account-title" className="text-xl font-bold text-white tracking-tight">
                    New Source
                  </h2>
                  <p className="text-sm text-white/80 mt-1.5 leading-relaxed">
                    Create a financial account to upload transaction CSVs and track income, expenses, and savings.
                  </p>
                </div>
                <button
                  onClick={() => setShowAdd(false)}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition shrink-0"
                  aria-label="Close"
                >
                  <span className="material-symbols-rounded text-[18px]">close</span>
                </button>
              </div>
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
                  Account Type *
                </label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value)}
                  className="w-full border border-bg-tertiary rounded-md px-3.5 py-2.5 text-sm text-mono-dark bg-white focus:ring-2 focus:ring-accent-sage/20 focus:border-accent-sage/40 outline-none transition"
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
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
                onClick={() => setShowAdd(false)}
                disabled={saving}
                className="rounded-md border border-bg-tertiary bg-white px-4 py-2.5 text-sm font-semibold text-mono-dark hover:bg-bg-secondary transition disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !name.trim()}
                className="rounded-md bg-mono-dark px-4 py-2.5 text-sm font-semibold text-white hover:bg-mono-dark/90 transition disabled:opacity-40"
              >
                {saving ? "Creating..." : "Create source"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {editSource && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-account-title"
        >
          <div className="rounded-xl bg-white shadow-[0_8px_30px_-6px_rgba(0,0,0,0.14)] max-w-[500px] w-full mx-4 overflow-hidden">
            <div className="rounded-t-xl bg-[#2d3748] px-6 pt-6 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="edit-account-title" className="text-xl font-bold text-white tracking-tight">
                    Edit Account
                  </h2>
                  <p className="text-sm text-white/80 mt-1.5">
                    Update account details below.
                  </p>
                </div>
                <button
                  onClick={() => setEditSource(null)}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition shrink-0"
                  aria-label="Close"
                >
                  <span className="material-symbols-rounded text-[18px]">close</span>
                </button>
              </div>
            </div>
            <div className="px-6 py-6 space-y-5">
              <div>
                <label className="text-sm font-medium text-mono-dark block mb-2">
                  Account Name *
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
                  Account Type *
                </label>
                <select
                  value={editAccountType}
                  onChange={(e) => setEditAccountType(e.target.value)}
                  className="w-full border border-bg-tertiary rounded-md px-3.5 py-2.5 text-sm text-mono-dark bg-white focus:ring-2 focus:ring-accent-sage/20 focus:border-accent-sage/40 outline-none transition"
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
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
                  className="w-full border border-bg-tertiary rounded-md px-3.5 py-2.5 text-sm text-mono-dark bg-white placeholder:text-mono-light focus:ring-2 focus:ring-accent-sage/20 focus:border-accent-sage/40 outline-none transition"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-bg-tertiary/40">
              <button
                onClick={() => setEditSource(null)}
                disabled={editSaving}
                className="rounded-md border border-bg-tertiary bg-white px-4 py-2.5 text-sm font-semibold text-mono-dark hover:bg-bg-secondary transition disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving || !editName.trim()}
                className="rounded-md bg-mono-dark px-4 py-2.5 text-sm font-semibold text-white hover:bg-mono-dark/90 transition disabled:opacity-40"
              >
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {sources.length === 0 && !showAdd && (
        <div className="text-center py-20">
          <p className="text-base text-mono-medium mb-2">No data sources yet</p>
          <p className="text-sm text-mono-light">
            Add a financial account to start uploading transaction CSVs.
          </p>
        </div>
      )}

      {sources.length > 0 && (
        <ul className="space-y-4">
          {sources.map((source) => {
            const s = stats[source.id] ?? {
              transactionCount: 0,
              totalIncome: 0,
              totalExpenses: 0,
              pctReviewed: 0,
              totalSavings: 0,
            };
            return (
              <li key={source.id} className="card overflow-hidden">
                <div className="p-4">
                  <div>
                    <p className="text-xs font-medium text-mono-light uppercase tracking-wide">
                      {accountTypeLabel(source.account_type)}
                    </p>
                    <p className="text-lg font-semibold text-mono-dark">{source.name}</p>
                    {source.institution && (
                      <p className="text-sm text-mono-light">{source.institution}</p>
                    )}
                  </div>
                  {s.transactionCount > 0 && (
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
                        {s.pctReviewed}% reviewed
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
                    <button
                      onClick={() => setUploadSourceId(source.id)}
                      className="inline-flex items-center gap-2 rounded-md bg-accent-terracotta px-3 py-2 text-sm font-medium text-white hover:bg-accent-terracotta-dark transition"
                    >
                      <span className="material-symbols-rounded text-[6px]">upload_file</span>
                      Upload CSV
                    </button>
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
