"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import type { Database, Json } from "@/lib/types/database";
import { normalizeVendor } from "@/lib/vendor-matching";
import { createSupabaseClient } from "@/lib/supabase/client";
import { ActivityToolbar, type ActivityViewState, type ActivityViewStatePatch } from "./ActivityToolbar";
import { ActivityTable, type DataSourceCellInfo } from "./ActivityTable";
import { TransactionDetailPanel, type TransactionDetailUpdate } from "@/components/TransactionDetailPanel";
import type { TransactionPropertyDefinition } from "@/lib/transaction-property-definition";
import type { OrgMemberOption } from "@/components/TransactionDetailCustomFields";
import { useIntersectionLoadMore } from "@/lib/use-intersection-load-more";
import type { TransactionUpdate } from "@/components/TransactionCard";
import { parseColumnFiltersJson, serializeColumnFiltersForQuery } from "@/lib/activity-column-filters";
import { mergeTransactionDetailPatch } from "@/lib/merge-transaction-detail-patch";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

const PAGE_SIZE = 100;

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    if (!r?.id) continue;
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

function appendUniqueById<T extends { id: string }>(prev: T[], next: T[]): T[] {
  if (prev.length === 0) return dedupeById(next);
  if (next.length === 0) return prev;
  const seen = new Set(prev.map((r) => r.id));
  const merged = [...prev];
  for (const r of next) {
    if (!r?.id) continue;
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    merged.push(r);
  }
  return merged;
}

function defaultDateRange() {
  const today = new Date().toISOString().slice(0, 10);
  return { date_from: "2000-01-01", date_to: today };
}

function allTimeDateRange() {
  const today = new Date().toISOString().slice(0, 10);
  return { date_from: "1970-01-01", date_to: today };
}

const DEFAULT_VIEW_STATE: ActivityViewState = {
  sort_column: "date",
  sort_asc: false,
  visible_columns: ["date", "vendor", "amount", "transaction_type", "status", "category"],
  column_widths: {},
  filters: {
    status: null,
    transaction_type: null,
    source: null,
    data_source_id: null,
    search: "",
    column_filters: [],
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
  const transactionsRef = useRef(transactions);
  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reanalyzing, setReanalyzing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarTransaction, setSidebarTransaction] = useState<Transaction | null>(null);
  const sidebarTransactionRef = useRef(sidebarTransaction);
  useEffect(() => {
    sidebarTransactionRef.current = sidebarTransaction;
  }, [sidebarTransaction]);
  const [transactionProperties, setTransactionProperties] = useState<TransactionPropertyDefinition[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMemberOption[]>([]);
  const patchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePayloadRef = useRef<ActivityViewState | null>(null);
  const optimisticBackupRef = useRef<Map<string, Transaction>>(new Map());
  const saveChainRef = useRef<Map<string, Promise<void>>>(new Map());

  const memberDisplayById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const mem of orgMembers) {
      m[mem.id] = mem.display_name?.trim() || mem.email?.trim() || mem.id.slice(0, 8);
    }
    return m;
  }, [orgMembers]);

  const [dataSourceById, setDataSourceById] = useState<Record<string, DataSourceCellInfo>>({});

  const dataSourceNameById = useMemo(() => {
    const o: Record<string, string> = {};
    for (const [id, v] of Object.entries(dataSourceById)) {
      o[id] = v.name;
    }
    return o;
  }, [dataSourceById]);

  const dataSourceBrandColorIdById = useMemo(() => {
    const o: Record<string, string> = {};
    for (const [id, v] of Object.entries(dataSourceById)) {
      o[id] = v.brandColorId ?? "blue";
    }
    return o;
  }, [dataSourceById]);

  useEffect(() => {
    let cancelled = false;
    async function loadAccounts() {
      try {
        const res = await fetch("/api/data-sources?limit=200");
        if (!res.ok || cancelled) return;
        const body = await res.json().catch(() => ({}));
        const rows = Array.isArray(body.data) ? body.data : [];
        const m: Record<string, DataSourceCellInfo> = {};
        for (const r of rows as { id?: string; name?: string; brand_color_id?: string }[]) {
          if (!r?.id) continue;
          m[String(r.id)] = {
            name: String(r.name ?? "").trim() || String(r.id),
            brandColorId: typeof r.brand_color_id === "string" ? r.brand_color_id : "blue",
          };
        }
        if (!cancelled) setDataSourceById(m);
      } catch {
        /* ignore */
      }
    }
    void loadAccounts();
    function onAccountsChanged() {
      void loadAccounts();
    }
    window.addEventListener("accounts-changed", onAccountsChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("accounts-changed", onAccountsChanged);
    };
  }, []);

  const baseQueryParams = useCallback((): Record<string, string> => {
    const params: Record<string, string> = {
      limit: String(PAGE_SIZE),
      sort_by: viewState.sort_column,
      sort_order: viewState.sort_asc ? "asc" : "desc",
      date_from: viewState.filters.date_from,
      date_to: viewState.filters.date_to,
    };
    if (viewState.filters.status) params.status = viewState.filters.status;
    if (viewState.filters.transaction_type) params.transaction_type = viewState.filters.transaction_type;
    if (viewState.filters.source) params.source = viewState.filters.source;
    if (viewState.filters.data_source_id) params.data_source_id = viewState.filters.data_source_id;
    if (viewState.filters.search) params.search = viewState.filters.search;
    if (viewState.filters.column_filters?.length) {
      params.column_filters = serializeColumnFiltersForQuery(viewState.filters.column_filters);
    }
    return params;
  }, [
    viewState.sort_column,
    viewState.sort_asc,
    viewState.filters.status,
    viewState.filters.transaction_type,
    viewState.filters.source,
    viewState.filters.data_source_id,
    viewState.filters.search,
    viewState.filters.date_from,
    viewState.filters.date_to,
    viewState.filters.column_filters,
  ]);

  const loadTransactions = useCallback(async () => {
    if (transactionsRef.current.length === 0) setLoading(true);
    const params = baseQueryParams();

    try {
      const [txs, count] = await Promise.all([
        fetchTransactions(params),
        fetchCount(params),
      ]);
      const deduped = dedupeById(txs);
      setTransactions(deduped);
      setTotalCount(count);
      setSidebarTransaction((prev) => {
        if (!prev) return prev;
        const fresh = deduped.find((t) => t.id === prev.id);
        return fresh ?? prev;
      });
      return txs;
    } finally {
      setLoading(false);
    }
  }, [baseQueryParams]);

  const canLoadMore = transactions.length < totalCount;
  const loadMore = useCallback(async () => {
    if (loading || loadingMore) return;
    if (!canLoadMore) return;
    setLoadingMore(true);
    try {
      const params = { ...baseQueryParams(), offset: String(transactions.length) };
      const next = await fetchTransactions(params);
      if (next.length > 0) {
        setTransactions((prev) => appendUniqueById(prev, next));
      }
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, canLoadMore, baseQueryParams, transactions.length]);

  const loadMoreSentinelRef = useIntersectionLoadMore(
    loadMore,
    canLoadMore && !loading && transactions.length > 0,
    transactions.length
  );

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
              column_widths:
                data.column_widths && typeof data.column_widths === "object" && !Array.isArray(data.column_widths)
                  ? data.column_widths
                  : {},
              filters: {
                status: data.filters?.status ?? null,
                transaction_type: data.filters?.transaction_type ?? null,
                source: data.filters?.source ?? null,
                data_source_id: typeof data.filters?.data_source_id === "string" ? data.filters.data_source_id : null,
                search: typeof data.filters?.search === "string" ? data.filters.search : "",
                date_from: typeof data.filters?.date_from === "string" ? data.filters.date_from : defaultDateRange().date_from,
                date_to: typeof data.filters?.date_to === "string" ? data.filters.date_to : defaultDateRange().date_to,
                column_filters: parseColumnFiltersJson(data.filters?.column_filters ?? []),
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

  const refreshTransactionProperties = useCallback(async () => {
    const res = await fetch("/api/org/transaction-properties");
    if (!res.ok) return;
    const j = await res.json().catch(() => ({}));
    setTransactionProperties(Array.isArray(j.properties) ? j.properties : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pRes, mRes] = await Promise.all([
        fetch("/api/org/transaction-properties"),
        fetch("/api/orgs/members"),
      ]);
      if (cancelled) return;
      if (pRes.ok) {
        const j = await pRes.json().catch(() => ({}));
        setTransactionProperties(Array.isArray(j.properties) ? j.properties : []);
      }
      if (mRes.ok) {
        const j = await mRes.json().catch(() => ({}));
        setOrgMembers(Array.isArray(j.members) ? j.members : []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // If URL has ?data_source_id=, override filters (deep link from Accounts page).
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const ds = sp.get("data_source_id");
      if (!ds) return;
      setViewState((prev) => ({
        ...prev,
        filters: {
          ...prev.filters,
          data_source_id: ds,
          ...allTimeDateRange(),
        },
      }));
    } catch {
      // ignore
    }
  }, []);

  // Minimal deep links (from dashboard cards): transaction_type + date range.
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const txType = sp.get("transaction_type");
      const dateFrom = sp.get("date_from");
      const dateTo = sp.get("date_to");
      if (!txType && !dateFrom && !dateTo) return;
      setViewState((prev) => ({
        ...prev,
        filters: {
          ...prev.filters,
          transaction_type: txType || prev.filters.transaction_type,
          date_from: typeof dateFrom === "string" && dateFrom ? dateFrom : prev.filters.date_from,
          date_to: typeof dateTo === "string" && dateTo ? dateTo : prev.filters.date_to,
        },
      }));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!viewSettingsLoaded) return;
    loadTransactions();
  }, [viewSettingsLoaded, loadTransactions]);

  const persistViewState = useCallback((patch: ActivityViewStatePatch) => {
    setViewState((prev) => {
      const next: ActivityViewState = {
        ...prev,
        ...patch,
        column_widths: patch.column_widths
          ? { ...prev.column_widths, ...patch.column_widths }
          : prev.column_widths,
        filters: patch.filters ? { ...prev.filters, ...patch.filters } : prev.filters,
      };
      savePayloadRef.current = next;
      if (patchDebounceRef.current) clearTimeout(patchDebounceRef.current);
      patchDebounceRef.current = setTimeout(() => {
        patchDebounceRef.current = null;
        const p = savePayloadRef.current;
        if (!p) return;
        void fetch("/api/activity-view-settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sort_column: p.sort_column,
            sort_asc: p.sort_asc,
            visible_columns: p.visible_columns,
            column_widths: p.column_widths,
            filters: p.filters,
          }),
        });
      }, 400);
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (patchDebounceRef.current) {
        clearTimeout(patchDebounceRef.current);
        patchDebounceRef.current = null;
      }
      const p = savePayloadRef.current;
      if (p) {
        void fetch("/api/activity-view-settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            sort_column: p.sort_column,
            sort_asc: p.sort_asc,
            visible_columns: p.visible_columns,
            column_widths: p.column_widths,
            filters: p.filters,
          }),
        });
      }
    };
  }, []);

  // Realtime: subscribe to org-level activity_view_settings changes for cross-device sync
  const lastPersistRef = useRef<number>(0);
  useEffect(() => {
    if (!viewSettingsLoaded) return;
    let sub: ReturnType<ReturnType<typeof createSupabaseClient>["channel"]> | null = null;
    try {
      const supabase = createSupabaseClient();
      sub = supabase
        .channel("activity-view-settings-sync")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "activity_view_settings" },
          (payload) => {
            if (Date.now() - lastPersistRef.current < 2000) return;
            const row = payload.new as Record<string, unknown>;
            setViewState((prev) => ({
              sort_column: typeof row.sort_column === "string" ? row.sort_column : prev.sort_column,
              sort_asc: typeof row.sort_asc === "boolean" ? row.sort_asc : prev.sort_asc,
              visible_columns: Array.isArray(row.visible_columns) && row.visible_columns.length > 0
                ? (row.visible_columns as string[])
                : prev.visible_columns,
              column_widths:
                row.column_widths && typeof row.column_widths === "object" && !Array.isArray(row.column_widths)
                  ? (row.column_widths as Record<string, number>)
                  : prev.column_widths,
              filters: prev.filters,
            }));
          }
        )
        .subscribe();
    } catch {
      // Realtime not available in this environment
    }
    return () => {
      if (sub) {
        try { createSupabaseClient().removeChannel(sub); } catch { /* ignore */ }
      }
    };
  }, [viewSettingsLoaded]);

  // Mark when we persist locally so we can skip echoed realtime events
  const originalPersistViewState = persistViewState;
  const persistViewStateWithMark = useCallback(
    (patch: ActivityViewStatePatch) => {
      lastPersistRef.current = Date.now();
      originalPersistViewState(patch);
    },
    [originalPersistViewState]
  );

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
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setToast((errBody as { error?: string }).error ?? "Analysis failed");
        setTimeout(() => setToast(null), 5000);
        return;
      }
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

  const applyOptimisticPatch = useCallback(
    (id: string, data: TransactionDetailUpdate & { status?: string }): Transaction | null => {
      const fromList = transactionsRef.current.find((t) => t.id === id);
      const fromSidebar =
        sidebarTransactionRef.current?.id === id ? sidebarTransactionRef.current : null;
      const base = fromList ?? fromSidebar;
      if (!base) return null;
      if (!optimisticBackupRef.current.has(id)) {
        optimisticBackupRef.current.set(id, base);
      }
      const merged = mergeTransactionDetailPatch(base, data);
      setTransactions((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx === -1) return prev;
        const copy = [...prev];
        copy[idx] = merged;
        return copy;
      });
      setSidebarTransaction((prev) => (prev?.id === id ? merged : prev));
      return merged;
    },
    []
  );

  const revertOptimisticPatch = useCallback((id: string) => {
    const backup = optimisticBackupRef.current.get(id);
    optimisticBackupRef.current.delete(id);
    if (!backup) return;
    setTransactions((prev) => prev.map((t) => (t.id === id ? backup : t)));
    setSidebarTransaction((prev) => (prev?.id === id ? backup : prev));
  }, []);

  const runPersistedSave = useCallback(
    async (id: string, data: TransactionDetailUpdate & { status?: string }, mergedRow: Transaction | null) => {
      const res = await fetch("/api/transactions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to save");
      }
      if (mergedRow) optimisticBackupRef.current.set(id, mergedRow);
    },
    []
  );

  const handleSave = useCallback(
    async (id: string, data: TransactionDetailUpdate & { status?: string }) => {
      const merged = applyOptimisticPatch(id, data);
      const prev = saveChainRef.current.get(id) ?? Promise.resolve();
      const run = prev.then(() => runPersistedSave(id, data, merged));
      saveChainRef.current.set(id, run);
      try {
        await run;
      } catch (e) {
        revertOptimisticPatch(id);
        const message = e instanceof Error ? e.message : "Failed to save";
        setToast(message);
        setTimeout(() => setToast(null), 5000);
        throw e;
      } finally {
        if (saveChainRef.current.get(id) === run) {
          saveChainRef.current.delete(id);
        }
      }
    },
    [applyOptimisticPatch, revertOptimisticPatch, runPersistedSave]
  );

  const patchCheckboxCustomField = useCallback(
    async (transactionId: string, propertyId: string, value: boolean) => {
      const patch: TransactionDetailUpdate & { status?: string } = {
        custom_fields: { [propertyId]: value } as Json,
      };
      const merged = applyOptimisticPatch(transactionId, patch);

      // Evict the row immediately if a column filter now excludes it.
      const cf = viewState.filters.column_filters ?? [];
      const matchingFilter = cf.find((f) => f.column === propertyId);
      const shouldEvict =
        !!matchingFilter &&
        ((matchingFilter.op === "is_unchecked" && value === true) ||
         (matchingFilter.op === "is_checked" && value === false));
      if (shouldEvict) {
        setTransactions((prev) => prev.filter((t) => t.id !== transactionId));
        setTotalCount((c) => Math.max(0, c - 1));
      }

      const prev = saveChainRef.current.get(transactionId) ?? Promise.resolve();
      const run = prev.then(() => runPersistedSave(transactionId, patch, merged));
      saveChainRef.current.set(transactionId, run);
      try {
        await run;
      } catch {
        if (shouldEvict) {
          const backup = optimisticBackupRef.current.get(transactionId);
          if (backup) {
            setTransactions((prev) => [...prev, backup]);
            setTotalCount((c) => c + 1);
          }
        }
        revertOptimisticPatch(transactionId);
        setToast("Could not update field");
        setTimeout(() => setToast(null), 4000);
      } finally {
        if (saveChainRef.current.get(transactionId) === run) {
          saveChainRef.current.delete(transactionId);
        }
      }
    },
    [applyOptimisticPatch, revertOptimisticPatch, runPersistedSave, viewState.filters.column_filters]
  );

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
      const body: Record<string, unknown> = { draft: true };
      if (viewState.filters.status) body.status = viewState.filters.status;
      if (viewState.filters.transaction_type) body.transaction_type = viewState.filters.transaction_type;
      if (viewState.filters.source) body.source = viewState.filters.source;
      if (viewState.filters.data_source_id) body.data_source_id = viewState.filters.data_source_id;
      if (viewState.filters.date_from) body.date_from = viewState.filters.date_from;
      if (viewState.filters.date_to) body.date_to = viewState.filters.date_to;

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
        data_feed_external_id: row.data_feed_external_id != null ? String(row.data_feed_external_id) : null,
        custom_fields:
          row.custom_fields && typeof row.custom_fields === "object" && !Array.isArray(row.custom_fields)
            ? (row.custom_fields as Transaction["custom_fields"])
            : ({} as Transaction["custom_fields"]),
      };
      setSidebarTransaction(normalized);
      const txs = await loadTransactions();
      const full = txs.find((t) => t.id === normalized.id);
      if (full) setSidebarTransaction(full);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Failed to create transaction");
      setTimeout(() => setToast(null), 5000);
    }
  }, [
    viewState.filters.status,
    viewState.filters.transaction_type,
    viewState.filters.source,
    viewState.filters.data_source_id,
    viewState.filters.date_from,
    viewState.filters.date_to,
    loadTransactions,
  ]);

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
        onViewStateChange={persistViewStateWithMark}
        onReanalyzeAll={handleReanalyzeAll}
        reanalyzing={reanalyzing === "all"}
        onNewTransaction={openNewTransaction}
        totalCount={totalCount}
        loading={loading}
        title="All Activity"
        transactionProperties={transactionProperties}
      />

      {toast && (
        <div className="py-2 px-4 rounded-md bg-accent-sage text-white text-sm font-medium">
          {toast}
        </div>
      )}

      <div className="relative min-h-[200px]">
        <div className="relative">
          <ActivityTable
            transactions={transactions}
            visibleColumns={viewState.visible_columns}
            columnWidths={viewState.column_widths}
            selectedId={sidebarTransaction?.id ?? null}
            onSelectRow={setSidebarTransaction}
            onColumnWidthChange={(col, width) => {
              persistViewStateWithMark({ column_widths: { [col]: width } });
            }}
            onColumnsReorder={(columns) => {
              persistViewStateWithMark({ visible_columns: columns });
            }}
            transactionProperties={transactionProperties}
            memberDisplayById={memberDisplayById}
            onPatchCustomField={patchCheckboxCustomField}
            dataSourceById={dataSourceById}
          />
          {((!viewSettingsLoaded && transactions.length === 0) ||
            (loading && transactions.length === 0)) && (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-[#f5f5f7]/90 transition-opacity duration-300 ease-out"
              aria-busy="true"
              aria-live="polite"
            >
              <div
                className="h-7 w-7 animate-spin rounded-full border-2 border-neutral-200/90 border-t-[#007aff]"
                aria-label="Loading transactions"
              />
            </div>
          )}
        </div>
        {loadingMore && (
          <div className="flex justify-center py-2 text-xs text-mono-light">Loading…</div>
        )}
        {canLoadMore && (
          <div ref={loadMoreSentinelRef} className="h-4 w-full shrink-0" aria-hidden />
        )}
        {viewSettingsLoaded && !loading && transactions.length === 0 && (
          <div className="card mt-3 p-6 text-center">
            <p className="text-sm text-mono-medium">No transactions match these filters.</p>
          </div>
        )}
      </div>

      {sidebarTransaction && (
        <TransactionDetailPanel
          transaction={sidebarTransaction}
          onClose={() => setSidebarTransaction(null)}
          onReanalyze={handleReanalyze}
          editable
          dataSourceNameById={dataSourceNameById}
          dataSourceBrandColorIdById={dataSourceBrandColorIdById}
          onSave={handleSave}
          taxRate={0.24}
          transactionProperties={transactionProperties}
          orgMembers={orgMembers}
          memberDisplayById={memberDisplayById}
          onRefreshTransactionProperties={refreshTransactionProperties}
        />
      )}
    </div>
  );
}
