"use client";

import { useState, useEffect } from "react";
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

function accountIconName(type: string): string {
  switch (type) {
    case "checking":
      return "account_balance";
    case "credit":
      return "credit_card";
    case "savings":
      return "savings";
    default:
      return "description";
  }
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

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-mono-dark">Data Sources</h1>
          <p className="text-sm text-mono-medium mt-1">
            Financial accounts that feed into your transactions
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          Add Account
        </button>
      </div>

      {/* Add Account Modal */}
      {showAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-account-title"
        >
          <div className="rounded-xl bg-white shadow-lg max-w-md w-full mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-bg-tertiary/40">
              <h2 id="add-account-title" className="text-sm font-semibold text-mono-dark">
                New Account
              </h2>
              <button
                onClick={() => setShowAdd(false)}
                className="text-mono-light hover:text-mono-dark text-xs"
                aria-label="Close"
              >
                Close
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-mono-medium block mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Chase Business Checking"
                  className="w-full border border-bg-tertiary rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-1 focus:ring-accent-sage/30 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-mono-medium block mb-1">
                  Account Type *
                </label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value)}
                  className="w-full border border-bg-tertiary rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-1 focus:ring-accent-sage/30 outline-none"
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-mono-medium block mb-1">
                  Institution
                </label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="e.g. Chase, Amex"
                  className="w-full border border-bg-tertiary rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-1 focus:ring-accent-sage/30 outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-bg-tertiary/40 bg-bg-secondary/30">
              <button
                onClick={() => setShowAdd(false)}
                disabled={saving}
                className="rounded-md border border-bg-tertiary px-3 py-1.5 text-xs text-mono-medium hover:bg-bg-secondary transition disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !name.trim()}
                className="rounded-md bg-accent-sage px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-sage/90 transition disabled:opacity-40"
              >
                {saving ? "Creating..." : "Create Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {editSource && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-account-title"
        >
          <div className="rounded-xl bg-white shadow-lg max-w-md w-full mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-bg-tertiary/40">
              <h2 id="edit-account-title" className="text-sm font-semibold text-mono-dark">
                Edit Account
              </h2>
              <button
                onClick={() => setEditSource(null)}
                className="text-mono-light hover:text-mono-dark text-xs"
                aria-label="Close"
              >
                Close
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-mono-medium block mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Chase Business Checking"
                  className="w-full border border-bg-tertiary rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-1 focus:ring-accent-sage/30 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-mono-medium block mb-1">
                  Account Type *
                </label>
                <select
                  value={editAccountType}
                  onChange={(e) => setEditAccountType(e.target.value)}
                  className="w-full border border-bg-tertiary rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-1 focus:ring-accent-sage/30 outline-none"
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-mono-medium block mb-1">
                  Institution
                </label>
                <input
                  type="text"
                  value={editInstitution}
                  onChange={(e) => setEditInstitution(e.target.value)}
                  placeholder="e.g. Chase, Amex"
                  className="w-full border border-bg-tertiary rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-1 focus:ring-accent-sage/30 outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-bg-tertiary/40 bg-bg-secondary/30">
              <button
                onClick={() => setEditSource(null)}
                disabled={editSaving}
                className="rounded-md border border-bg-tertiary px-3 py-1.5 text-xs text-mono-medium hover:bg-bg-secondary transition disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving || !editName.trim()}
                className="rounded-md bg-accent-sage px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-sage/90 transition disabled:opacity-40"
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
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-bg-secondary/60 border-b border-bg-tertiary/40">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-mono-medium">Account</th>
                  <th className="text-right py-3 px-4 font-medium text-mono-medium">Transactions</th>
                  <th className="text-right py-3 px-4 font-medium text-mono-medium">Income</th>
                  <th className="text-right py-3 px-4 font-medium text-mono-medium">Expenses</th>
                  <th className="text-right py-3 px-4 font-medium text-mono-medium">% Reviewed</th>
                  <th className="text-right py-3 px-4 font-medium text-mono-medium">Est. Savings</th>
                  <th className="text-right py-3 px-4 font-medium text-mono-medium w-48">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-tertiary/30">
                {sources.map((source) => {
                  const s = stats[source.id] ?? {
                    transactionCount: 0,
                    totalIncome: 0,
                    totalExpenses: 0,
                    pctReviewed: 0,
                    totalSavings: 0,
                  };
                  return (
                    <tr key={source.id} className="hover:bg-bg-secondary/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <span
                            className="material-symbols-rounded text-[22px] text-accent-sage shrink-0"
                            aria-hidden
                          >
                            {accountIconName(source.account_type)}
                          </span>
                          <div>
                            <p className="font-medium text-mono-dark">{source.name}</p>
                            <p className="text-xs text-mono-light">
                              {accountTypeLabel(source.account_type)}
                              {source.institution && ` · ${source.institution}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-mono-medium">
                        {s.transactionCount}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-mono-medium text-success">
                        {formatCurrency(s.totalIncome)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-mono-medium">
                        {formatCurrency(s.totalExpenses)}
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums text-mono-medium">
                        {s.pctReviewed}%
                      </td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium text-accent-sage">
                        {formatCurrency(s.totalSavings)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(source)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-bg-tertiary/60 px-2.5 py-1.5 text-xs font-medium text-mono-medium hover:bg-bg-secondary/60 transition"
                            aria-label="Edit account"
                          >
                            <span className="material-symbols-rounded text-[16px]">edit</span>
                            Edit
                          </button>
                          <button
                            onClick={() => setUploadSourceId(source.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-sage/12 text-accent-sage border border-accent-sage/30 px-2.5 py-1.5 text-xs font-medium hover:bg-accent-sage/20 transition"
                          >
                            <span className="material-symbols-rounded text-[16px]">upload_file</span>
                            Upload CSV
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
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
