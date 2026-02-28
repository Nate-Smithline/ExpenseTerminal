"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Database } from "@/lib/types/database";
import { normalizeVendor } from "@/lib/vendor-matching";
import { ActivityToolbar, type ActivityViewState } from "./ActivityToolbar";
import { ActivityTable } from "./ActivityTable";
import { TransactionDetailPanel, type TransactionDetailUpdate } from "@/components/TransactionDetailPanel";
import type { TransactionUpdate } from "@/components/TransactionCard";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

function defaultDateRange() {
  const y = new Date().getFullYear();
  return { date_from: `${y}-01-01`, date_to: `${y}-12-31` };
}

const DEFAULT_VIEW_STATE: ActivityViewState = {
  sort_column: "date",
  sort_asc: false,
  visible_columns: ["date", "vendor", "amount", "transaction_type", "status", "category"],
  filters: {
    status: null,
    transaction_type: null,
    search: "",
    ...defaultDateRange(),
  },
};

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

interface ActivityPageClientProps {
  initialTransactions: Transaction[];
  initialTotalCount: number;
  initialYear: number;
  userId: string;
}

export function ActivityPageClient({
  initialTransactions,
  initialTotalCount,
  initialYear,
  userId,
}: ActivityPageClientProps) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [viewState, setViewState] = useState<ActivityViewState>(DEFAULT_VIEW_STATE);
  const [viewSettingsLoaded, setViewSettingsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reanalyzing, setReanalyzing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarTransaction, setSidebarTransaction] = useState<Transaction | null>(null);
  const patchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    const params: Record<string, string> = {
      limit: "100",
      sort_by: viewState.sort_column,
      sort_order: viewState.sort_asc ? "asc" : "desc",
      date_from: viewState.filters.date_from,
      date_to: viewState.filters.date_to,
    };
    if (viewState.filters.status) params.status = viewState.filters.status;
    if (viewState.filters.transaction_type) params.transaction_type = viewState.filters.transaction_type;
    if (viewState.filters.search) params.search = viewState.filters.search;

    const [txs, count] = await Promise.all([
      fetchTransactions(params),
      fetchCount(params),
    ]);
    setTransactions(txs);
    setTotalCount(count);
    setLoading(false);
    return txs;
  }, [viewState.sort_column, viewState.sort_asc, viewState.filters.status, viewState.filters.transaction_type, viewState.filters.search, viewState.filters.date_from, viewState.filters.date_to]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/activity-view-settings");
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && !cancelled) {
            setViewState({
              sort_column: data.sort_column ?? DEFAULT_VIEW_STATE.sort_column,
              sort_asc: data.sort_asc ?? DEFAULT_VIEW_STATE.sort_asc,
              visible_columns: Array.isArray(data.visible_columns) && data.visible_columns.length > 0
                ? data.visible_columns
                : DEFAULT_VIEW_STATE.visible_columns,
              filters: {
                status: data.filters?.status ?? null,
                transaction_type: data.filters?.transaction_type ?? null,
                search: typeof data.filters?.search === "string" ? data.filters.search : "",
                date_from: typeof data.filters?.date_from === "string" ? data.filters.date_from : defaultDateRange().date_from,
                date_to: typeof data.filters?.date_to === "string" ? data.filters.date_to : defaultDateRange().date_to,
              },
            });
          }
        }
      } finally {
        if (!cancelled) setViewSettingsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!viewSettingsLoaded) return;
    loadTransactions();
  }, [viewSettingsLoaded, loadTransactions]);

  const persistViewState = useCallback((patch: Partial<ActivityViewState>) => {
    const next = {
      ...viewState,
      ...patch,
      filters: patch.filters ?? viewState.filters,
    };
    setViewState(next);
    if (patchDebounceRef.current) clearTimeout(patchDebounceRef.current);
    patchDebounceRef.current = setTimeout(async () => {
      patchDebounceRef.current = null;
      await fetch("/api/activity-view-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sort_column: next.sort_column,
          sort_asc: next.sort_asc,
          visible_columns: next.visible_columns,
          filters: next.filters,
        }),
      });
    }, 400);
  }, [viewState]);

  useEffect(() => {
    return () => {
      if (patchDebounceRef.current) clearTimeout(patchDebounceRef.current);
    };
  }, []);

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
              const event = JSON.parse(line) as { type: string; successful?: number; message?: string };
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
        body: JSON.stringify({ transactionIds: uncategorized.map((t) => t.id) }),
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

  async function handleSave(id: string, data: TransactionDetailUpdate & { status?: string }) {
    const res = await fetch("/api/transactions/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? "Failed to save");
    }
    await loadTransactions();
  }

  const handleCheckSimilar = useCallback(
    async (vendor: string, excludeId: string): Promise<Transaction[]> => {
      const normalized = normalizeVendor(vendor);
      const year = viewState.filters.date_from ? viewState.filters.date_from.slice(0, 4) : String(new Date().getFullYear());
      return fetchTransactions({
        tax_year: year,
        status: "pending",
        transaction_type: "expense",
        vendor_normalized: normalized,
        exclude_id: excludeId,
      });
    },
    [viewState.filters.date_from]
  );

  const handleApplyToAllSimilar = useCallback(
    async (transaction: Transaction, data: TransactionUpdate) => {
      const year = viewState.filters.date_from ? parseInt(viewState.filters.date_from.slice(0, 4), 10) : new Date().getFullYear();
      const res = await fetch("/api/transactions/auto-sort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorNormalized: transaction.vendor_normalized ?? normalizeVendor(transaction.vendor),
          quickLabel: data.quick_label,
          businessPurpose: data.business_purpose,
          category: transaction.category ?? undefined,
          taxYear: year,
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
    [viewState.filters.date_from, loadTransactions]
  );

  /** New transaction: create draft in DB with current filters (status, type) applied, open in sidebar. Shortcut "n". */
  const openNewTransaction = useCallback(async () => {
    try {
      const body: { draft: true; status?: string; transaction_type?: string } = { draft: true };
      if (viewState.filters.status) body.status = viewState.filters.status;
      if (viewState.filters.transaction_type) body.transaction_type = viewState.filters.transaction_type;

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast((data as { error?: string }).error ?? "Failed to create transaction");
        setTimeout(() => setToast(null), 5000);
        return;
      }
      const row = data as Record<string, unknown>;
      const normalized: Transaction = {
        id: String(row.id),
        user_id: String(row.user_id),
        date: String(row.date),
        vendor: row.vendor != null ? String(row.vendor) : "",
        description: row.description != null ? String(row.description) : null,
        amount: typeof row.amount === "number" ? String(row.amount) : String(row.amount ?? "0"),
        status: (row.status as Transaction["status"]) ?? "pending",
        tax_year: typeof row.tax_year === "number" ? row.tax_year : new Date(String(row.date)).getFullYear(),
        source: row.source != null ? String(row.source) : null,
        transaction_type: (row.transaction_type as Transaction["transaction_type"]) ?? "expense",
        vendor_normalized: row.vendor_normalized != null ? String(row.vendor_normalized) : null,
        created_at: String(row.created_at ?? new Date().toISOString()),
        updated_at: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
        eligible_for_ai: Boolean(row.eligible_for_ai),
        category: null,
        schedule_c_line: null,
        ai_confidence: null,
        ai_reasoning: null,
        ai_suggestions: null,
        business_purpose: null,
        quick_label: null,
        notes: null,
        auto_sort_rule_id: null,
        deduction_percent: null,
        is_meal: null,
        is_travel: null,
        data_source_id: null,
      };
      setSidebarTransaction(normalized);
      const txs = await loadTransactions();
      const full = txs.find((t) => t.id === normalized.id);
      if (full) setSidebarTransaction(full);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Failed to create transaction");
      setTimeout(() => setToast(null), 5000);
    }
  }, [viewState.filters.status, viewState.filters.transaction_type, loadTransactions]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        openNewTransaction();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openNewTransaction]);

  return (
    <div className="space-y-6">
      <ActivityToolbar
        viewState={viewState}
        onViewStateChange={persistViewState}
        onReanalyzeAll={handleReanalyzeAll}
        reanalyzing={reanalyzing === "all"}
        onNewTransaction={openNewTransaction}
        totalCount={totalCount}
        loading={loading}
      />

      {toast && (
        <div className="py-2 px-4 rounded-md bg-accent-sage text-white text-sm font-medium">
          {toast}
        </div>
      )}

      {viewSettingsLoaded && !loading && transactions.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-mono-medium">No transactions match these filters.</p>
        </div>
      )}

      {loading && (
        <p className="text-sm text-mono-medium">Loading…</p>
      )}

      {!loading && transactions.length > 0 && (
        <ActivityTable
          transactions={transactions}
          visibleColumns={viewState.visible_columns}
          selectedId={sidebarTransaction?.id ?? null}
          onSelectRow={setSidebarTransaction}
        />
      )}

      {sidebarTransaction && (
        <TransactionDetailPanel
          transaction={sidebarTransaction}
          onClose={() => setSidebarTransaction(null)}
          onReanalyze={handleReanalyze}
          onMarkPersonal={async () => {
            await handleSave(sidebarTransaction.id, { status: "personal" });
            setSidebarTransaction(null);
          }}
          editable
          onSave={async (id, update) => {
            await handleSave(id, update);
            setSidebarTransaction((prev) => {
              if (!prev || prev.id !== id) return prev;
              const next = { ...prev, ...update };
              const amount: string =
                typeof next.amount === "number" ? String(next.amount) : (next.amount ?? "");
              return { ...next, amount };
            });
          }}
          taxRate={0.24}
        />
      )}
    </div>
  );
}
