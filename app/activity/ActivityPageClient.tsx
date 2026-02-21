"use client";

import { useEffect, useState, useCallback } from "react";
import type { Database } from "@/lib/types/database";
import { TransactionCard } from "@/components/TransactionCard";
import type { TransactionUpdate } from "@/components/TransactionCard";
import { normalizeVendor } from "@/lib/vendor-matching";
import { persistTaxYear } from "@/lib/tax-year-cookie";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

type StatusFilter = "all" | "pending" | "completed" | "personal" | "auto_sorted";
type TypeFilter = "all" | "expense" | "income";

interface ActivityPageClientProps {
  initialTransactions: Transaction[];
  initialTotalCount: number;
  initialYear: number;
  userId: string;
}

async function fetchTransactions(params: Record<string, string>): Promise<Transaction[]> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/transactions?${qs}`);
  if (!res.ok) return [];
  const body = await res.json();
  return body.data ?? [];
}

async function fetchCount(params: Record<string, string>): Promise<number> {
  const qs = new URLSearchParams({ ...params, count_only: "true" }).toString();
  const res = await fetch(`/api/transactions?${qs}`);
  if (!res.ok) return 0;
  const body = await res.json();
  return body.count ?? 0;
}

export function ActivityPageClient({
  initialTransactions,
  initialTotalCount,
  initialYear,
  userId,
}: ActivityPageClientProps) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [loading, setLoading] = useState(false);
  const [reanalyzing, setReanalyzing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = {
      tax_year: String(selectedYear),
      limit: "100",
    };
    if (statusFilter !== "all") params.status = statusFilter;
    if (typeFilter !== "all") params.transaction_type = typeFilter;

    const [txs, count] = await Promise.all([
      fetchTransactions(params),
      fetchCount(params),
    ]);
    setTransactions(txs);
    setTotalCount(count);
    setLoading(false);
  }, [selectedYear, statusFilter, typeFilter]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  async function handleReanalyze(id: string) {
    setReanalyzing(id);
    try {
      const res = await fetch("/api/transactions/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionIds: [id] }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setToast((errBody as { error?: string }).error ?? "AI analysis failed");
        setTimeout(() => setToast(null), 5000);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let success = false;
      let errorMsg = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line) as {
                type: string;
                successful?: number;
                message?: string;
                category?: string;
              };
              if (event.type === "done" && (event.successful ?? 0) > 0) success = true;
              if (event.type === "error" && event.message) errorMsg = event.message;
            } catch { /* skip */ }
          }
        }
      }

      if (success) {
        setToast("AI analysis updated");
        setTimeout(() => setToast(null), 3000);
        await loadTransactions();
      } else {
        setToast(errorMsg || "AI analysis returned no results");
        setTimeout(() => setToast(null), 5000);
      }
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Re-analysis failed");
      setTimeout(() => setToast(null), 5000);
    } finally {
      setReanalyzing(null);
    }
  }

  async function handleReanalyzeAll() {
    const uncategorized = transactions.filter((t) => !t.category);
    if (uncategorized.length === 0) {
      setToast("All transactions already have AI categories");
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setReanalyzing("all");
    try {
      const res = await fetch("/api/transactions/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionIds: uncategorized.map((t) => t.id),
        }),
      });
      if (!res.ok) throw new Error("Analysis failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let successCount = 0;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line) as { type: string; successful?: number };
              if (event.type === "done") successCount = event.successful ?? 0;
            } catch { /* skip */ }
          }
        }
      }

      setToast(`${successCount} transaction(s) re-analyzed`);
      setTimeout(() => setToast(null), 4000);
      await loadTransactions();
    } catch {
      setToast("Batch re-analysis failed");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setReanalyzing(null);
    }
  }

  async function handleSave(id: string, data: TransactionUpdate & { status?: string; deduction_percent?: number }) {
    await fetch("/api/transactions/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    await loadTransactions();
  }

  const handleCheckSimilar = useCallback(
    async (vendor: string, excludeId: string): Promise<Transaction[]> => {
      const normalized = normalizeVendor(vendor);
      return fetchTransactions({
        tax_year: String(selectedYear),
        status: "pending",
        transaction_type: "expense",
        vendor_normalized: normalized,
        exclude_id: excludeId,
      });
    },
    [selectedYear]
  );

  const handleApplyToAllSimilar = useCallback(
    async (transaction: Transaction, data: TransactionUpdate) => {
      const res = await fetch("/api/transactions/auto-sort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorNormalized: transaction.vendor_normalized ?? normalizeVendor(transaction.vendor),
          quickLabel: data.quick_label,
          businessPurpose: data.business_purpose,
          category: transaction.category ?? undefined,
          taxYear: selectedYear,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to auto-sort");
      }
      const json = (await res.json()) as { updatedCount: number };
      setToast(`${json.updatedCount} transaction(s) auto-sorted`);
      setTimeout(() => setToast(null), 4000);
      await loadTransactions();
    },
    [selectedYear, loadTransactions]
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-mono-dark">All Activity</h1>
          <p className="text-sm text-mono-medium mt-1">{totalCount} transactions</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="border border-bg-tertiary/60 bg-white rounded-full px-4 py-1.5 text-sm text-mono-dark transition-all hover:bg-bg-secondary hover:border-bg-tertiary"
            onClick={handleReanalyzeAll}
            disabled={reanalyzing !== null}
          >
            {reanalyzing === "all" ? "Analyzing..." : "Re-analyze uncategorized"}
          </button>
          <select
            value={selectedYear}
            onChange={(e) => {
              const y = parseInt(e.target.value, 10);
              persistTaxYear(y);
              setSelectedYear(y);
            }}
            className="bg-white border border-bg-tertiary/60 rounded-full px-4 py-1.5 text-sm text-mono-dark"
          >
            {[0, 1, 2].map((i) => {
              const y = new Date().getFullYear() - i;
              return <option key={y} value={y}>{y}</option>;
            })}
          </select>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="flex gap-1">
          {(["all", "pending", "completed", "auto_sorted", "personal"] as StatusFilter[]).map(
            (s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  statusFilter === s
                    ? "bg-mono-dark text-white"
                    : "bg-bg-tertiary text-mono-medium hover:bg-bg-secondary"
                }`}
              >
                {s === "all" ? "All" : s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </button>
            )
          )}
        </div>

        <div className="h-5 w-px bg-bg-tertiary" />

        <div className="flex gap-1">
          {(["all", "expense", "income"] as TypeFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                typeFilter === t
                  ? "bg-mono-dark text-white"
                  : "bg-bg-tertiary text-mono-medium hover:bg-bg-secondary"
              }`}
            >
              {t === "all" ? "All types" : t}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div className="py-2 px-4 rounded-md bg-accent-sage text-white text-sm font-medium">
          {toast}
        </div>
      )}

      {loading && (
        <p className="text-sm text-mono-medium">Loading...</p>
      )}

      {!loading && transactions.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-mono-medium">No transactions match these filters.</p>
        </div>
      )}

      <div className="space-y-3">
        {transactions.map((t) => (
          <TransactionCard
            key={t.id}
            transaction={t}
            onSave={async (data) =>
              handleSave(t.id, {
                quick_label: data.quick_label,
                business_purpose: data.business_purpose,
                notes: data.notes,
                deduction_percent: data.deduction_percent,
                status: "completed",
              })
            }
            onMarkPersonal={async () =>
              handleSave(t.id, { status: "personal" })
            }
            onCheckSimilar={handleCheckSimilar}
            onApplyToAllSimilar={handleApplyToAllSimilar}
          />
        ))}
      </div>
    </div>
  );
}
