"use client";

import { useState } from "react";
import Link from "next/link";
import type { Database } from "@/lib/types/database";
import { UploadModal } from "@/components/UploadModal";

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

function accountIcon(type: string): string {
  switch (type) {
    case "checking": return "🏦";
    case "credit": return "💳";
    case "savings": return "🏧";
    default: return "📄";
  }
}

export function DataSourcesClient({ initialSources }: { initialSources: DataSource[] }) {
  const [sources, setSources] = useState<DataSource[]>(initialSources);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState("checking");
  const [institution, setInstitution] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadSourceId, setUploadSourceId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
      setName("");
      setInstitution("");
      setShowAdd(false);
    }
    setSaving(false);
  }

  async function reloadSources() {
    const res = await fetch("/api/data-sources");
    if (res.ok) {
      const { data } = await res.json();
      setSources(data ?? []);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-mono-dark">Data Sources</h1>
          <p className="text-sm text-mono-medium mt-1">
            Financial accounts that feed into your transactions
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary"
        >
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
                    <option key={t.value} value={t.value}>{t.label}</option>
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

      {/* Source Cards */}
      {sources.length === 0 && !showAdd && (
        <div className="text-center py-20">
          <p className="text-base text-mono-medium mb-2">No data sources yet</p>
          <p className="text-sm text-mono-light">
            Add a financial account to start uploading transaction CSVs.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sources.map((source) => (
          <div key={source.id} className="card p-6 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{accountIcon(source.account_type)}</span>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-mono-dark">{source.name}</h3>
                <p className="text-xs text-mono-light">
                  {accountTypeLabel(source.account_type)}
                  {source.institution && ` · ${source.institution}`}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-mono-light">
              <span>{source.transaction_count} transactions</span>
              <span>
                {source.last_upload_at
                  ? `Last upload: ${new Date(source.last_upload_at).toLocaleDateString()}`
                  : "No uploads yet"}
              </span>
            </div>
            <button
              onClick={() => setUploadSourceId(source.id)}
              className="btn-secondary w-full text-sm"
            >
              Upload CSV
            </button>
          </div>
        ))}
      </div>

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

            // Trigger AI categorization so transactions flow into the inbox
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
