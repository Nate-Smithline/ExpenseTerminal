"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { Database, Json } from "@/lib/types/database";
import { ActivityToolbar, type ActivityViewState, type ActivityViewStatePatch } from "@/app/activity/ActivityToolbar";
import { ActivityTable, type DataSourceCellInfo } from "@/app/activity/ActivityTable";
import { TransactionDetailPanel, type TransactionDetailUpdate } from "@/components/TransactionDetailPanel";
import type { TransactionPropertyDefinition } from "@/lib/transaction-property-definition";
import type { OrgMemberOption } from "@/components/TransactionDetailCustomFields";
import { PageTopBar } from "@/components/PageTopBar";
import { PageIconPicker, type PageIconValue } from "@/components/PageIconPicker";
import { pageIconTextClass } from "@/lib/page-icon-colors";
import { useIntersectionLoadMore } from "@/lib/use-intersection-load-more";
import { parseColumnFiltersJson, serializeColumnFiltersForQuery } from "@/lib/activity-column-filters";
import { mergeTransactionDetailPatch } from "@/lib/merge-transaction-detail-patch";
import { serializeSortRulesForQuery } from "@/lib/activity-sort-rules";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { ActivitySortRule } from "@/lib/validation/schemas";

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
  const y = new Date().getFullYear();
  return { date_from: `${y}-01-01`, date_to: `${y}-12-31` };
}

const DEFAULT_VIEW_STATE: ActivityViewState = {
  sort_column: "date",
  sort_asc: false,
  sort_rules: [{ column: "date", asc: false }],
  visible_columns: [
    "date",
    "vendor",
    "amount",
    "transaction_type",
    "status",
    "category",
  ],
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

/** Client state from GET /api/pages/[id]/activity-view-settings JSON (same shape as server). */
function viewStateFromPageSettingsApi(data: {
  sort_rules?: ActivitySortRule[];
  sort_column?: string;
  sort_asc?: boolean;
  visible_columns?: string[];
  column_widths?: Record<string, number>;
  filters?: Record<string, unknown>;
}): ActivityViewState {
  const sortRules =
    Array.isArray(data.sort_rules) && data.sort_rules.length > 0
      ? data.sort_rules
      : [
          {
            column: data.sort_column ?? DEFAULT_VIEW_STATE.sort_column,
            asc: data.sort_asc ?? DEFAULT_VIEW_STATE.sort_asc,
          } as ActivitySortRule,
        ];
  return {
    sort_column: data.sort_column ?? DEFAULT_VIEW_STATE.sort_column,
    sort_asc: data.sort_asc ?? DEFAULT_VIEW_STATE.sort_asc,
    sort_rules: sortRules,
    visible_columns:
      Array.isArray(data.visible_columns) && data.visible_columns.length > 0
        ? data.visible_columns
        : DEFAULT_VIEW_STATE.visible_columns,
    column_widths:
      data.column_widths && typeof data.column_widths === "object" && !Array.isArray(data.column_widths)
        ? data.column_widths
        : {},
    filters: (() => {
      const f = data.filters as ActivityViewState["filters"] | undefined;
      return {
        status: f?.status ?? null,
        transaction_type: f?.transaction_type ?? null,
        source: f?.source ?? null,
        data_source_id: typeof f?.data_source_id === "string" ? f.data_source_id : null,
        search: typeof f?.search === "string" ? f.search : "",
        date_from: typeof f?.date_from === "string" ? f.date_from : defaultDateRange().date_from,
        date_to: typeof f?.date_to === "string" ? f.date_to : defaultDateRange().date_to,
        column_filters: parseColumnFiltersJson((f as { column_filters?: unknown })?.column_filters ?? []),
      };
    })(),
  };
}

type PageMeta = {
  id: string;
  title: string | null;
  icon_type: string | null;
  icon_value: string | null;
  icon_color: string | null;
};

type ServerPage = PageMeta & {
  full_width: boolean;
  favorited: boolean;
};

function dispatchPageMeta(detail: {
  pageId: string;
  title?: string | null;
  icon_type?: string;
  icon_value?: string | null;
  icon_color?: string | null;
}) {
  window.dispatchEvent(new CustomEvent("page-meta-updated", { detail }));
}

export function PageViewClient({ page }: { page: ServerPage }) {
  const [pageMeta, setPageMeta] = useState<PageMeta>(page);
  const [fullWidth, setFullWidth] = useState(page.full_width);
  const [favorited, setFavorited] = useState(page.favorited);
  const favoritedOverrideRef = useRef<{ value: boolean; untilMs: number } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [viewState, setViewState] = useState<ActivityViewState>(DEFAULT_VIEW_STATE);
  const [viewSettingsLoaded, setViewSettingsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sidebarTransaction, setSidebarTransaction] = useState<Transaction | null>(null);
  const [transactionProperties, setTransactionProperties] = useState<TransactionPropertyDefinition[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMemberOption[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const handleFavoritedChange = useCallback((next: boolean) => {
    // Prevent a router.refresh / server prop update from briefly overwriting our optimistic value.
    // Any stale server render should be ignored for a short window.
    favoritedOverrideRef.current = { value: next, untilMs: Date.now() + 1500 };
    setFavorited(next);
  }, []);

  const transactionsRef = useRef(transactions);
  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);
  const sidebarTransactionRef = useRef(sidebarTransaction);
  useEffect(() => {
    sidebarTransactionRef.current = sidebarTransaction;
  }, [sidebarTransaction]);
  const optimisticBackupRef = useRef<Map<string, Transaction>>(new Map());
  const saveChainRef = useRef<Map<string, Promise<void>>>(new Map());
  const patchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePayloadRef = useRef<ActivityViewState | null>(null);
  const lastPersistRef = useRef(0);

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
    for (const [id, v] of Object.entries(dataSourceById)) o[id] = v.name;
    return o;
  }, [dataSourceById]);

  const dataSourceBrandColorIdById = useMemo(() => {
    const o: Record<string, string> = {};
    for (const [id, v] of Object.entries(dataSourceById)) o[id] = v.brandColorId ?? "blue";
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

  const titleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const savePageIcon = useCallback(
    async (next: PageIconValue) => {
      setPageMeta((prev) => ({
        ...prev,
        icon_type: next.icon_type,
        icon_value: next.icon_value,
        icon_color: next.icon_color,
      }));
      dispatchPageMeta({
        pageId: page.id,
        icon_type: next.icon_type,
        icon_value: next.icon_value,
        icon_color: next.icon_color,
      });
      try {
        await fetch(`/api/pages/${page.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
      } catch {
        // ignore
      }
    },
    [page.id]
  );

  const setPageTitle = useCallback(
    (title: string) => {
      setPageMeta((prev) => ({ ...prev, title }));
      dispatchPageMeta({ pageId: page.id, title });
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      titleDebounceRef.current = setTimeout(async () => {
        titleDebounceRef.current = null;
        try {
          await fetch(`/api/pages/${page.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title }),
          });
        } catch {
          // ignore
        }
      }, 250);
    },
    [page.id]
  );

  const baseQueryParams = useCallback((): Record<string, string> => {
    const params: Record<string, string> = {
      limit: String(PAGE_SIZE),
      sort_by: viewState.sort_column,
      sort_order: viewState.sort_asc ? "asc" : "desc",
      date_from: viewState.filters.date_from,
      date_to: viewState.filters.date_to,
    };
    if (Array.isArray(viewState.sort_rules) && viewState.sort_rules.length > 0) {
      params.sort_rules = serializeSortRulesForQuery(viewState.sort_rules);
    }
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
    viewState.sort_rules,
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
      const [txs, count] = await Promise.all([fetchTransactions(params), fetchCount(params)]);
      const list = dedupeById(txs);
      setTransactions(list);
      setTotalCount(count);
      return list;
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
      if (next.length > 0) setTransactions((prev) => appendUniqueById(prev, next));
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
        const res = await fetch(`/api/pages/${page.id}/activity-view-settings`);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && !cancelled) {
            setViewState(viewStateFromPageSettingsApi(data));
          }
        }
      } finally {
        if (!cancelled) setViewSettingsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page.id]);

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

  useEffect(() => {
    if (!viewSettingsLoaded) return;
    loadTransactions();
  }, [viewSettingsLoaded, loadTransactions]);

  const persistViewState = useCallback((patch: ActivityViewStatePatch) => {
    lastPersistRef.current = Date.now();
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
        void (async () => {
          try {
            const res = await fetch(`/api/pages/${page.id}/activity-view-settings`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sort_rules: Array.isArray(p.sort_rules) ? p.sort_rules : undefined,
                sort_column: p.sort_column,
                sort_asc: p.sort_asc,
                visible_columns: p.visible_columns,
                column_widths: p.column_widths,
                filters: p.filters,
              }),
            });
            if (!res.ok) {
              const j = await res.json().catch(() => ({}));
              const msg = (j as { error?: string }).error ?? "Failed to save view settings";
              setToast(msg);
              setTimeout(() => setToast(null), 5000);
              return;
            }
            const data = await res.json().catch(() => null);
            if (data) {
              // Reconcile with server-normalized values so reloads match what was saved.
              setViewState(viewStateFromPageSettingsApi(data));
            }
          } catch (e) {
            setToast(e instanceof Error ? e.message : "Failed to save view settings");
            setTimeout(() => setToast(null), 5000);
          }
        })();
      }, 400);
      return next;
    });
  }, [page.id]);

  useEffect(() => {
    return () => {
      if (patchDebounceRef.current) {
        clearTimeout(patchDebounceRef.current);
        patchDebounceRef.current = null;
      }
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
      const p = savePayloadRef.current;
      if (p) {
        void fetch(`/api/pages/${page.id}/activity-view-settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            sort_rules: Array.isArray(p.sort_rules) ? p.sort_rules : undefined,
            sort_column: p.sort_column,
            sort_asc: p.sort_asc,
            visible_columns: p.visible_columns,
            column_widths: p.column_widths,
            filters: p.filters,
          }),
        });
      }
    };
  }, [page.id]);

  useEffect(() => {
    if (!viewSettingsLoaded) return;
    let sub: ReturnType<ReturnType<typeof createSupabaseClient>["channel"]> | null = null;
    try {
      const supabase = createSupabaseClient();
      sub = supabase
        .channel(`page-activity-view-settings-${page.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "page_activity_view_settings",
            filter: `page_id=eq.${page.id}`,
          },
          () => {
            if (Date.now() - lastPersistRef.current < 2000) return;
            void (async () => {
              try {
                const res = await fetch(`/api/pages/${page.id}/activity-view-settings`);
                if (!res.ok) return;
                const data = await res.json();
                if (!data || Date.now() - lastPersistRef.current < 2000) return;
                setViewState(viewStateFromPageSettingsApi(data));
              } catch {
                /* ignore */
              }
            })();
          }
        )
        .subscribe();
    } catch {
      /* Realtime unavailable */
    }
    return () => {
      if (sub) {
        try {
          createSupabaseClient().removeChannel(sub);
        } catch {
          /* ignore */
        }
      }
    };
  }, [page.id, viewSettingsLoaded]);

  const onReanalyzeAll = useCallback(() => {
    setToast("Batch re-analysis is available on All Activity for now");
    setTimeout(() => setToast(null), 3500);
  }, []);

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
        data_source_id: row.data_source_id != null ? String(row.data_source_id) : null,
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
        void openNewTransaction();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openNewTransaction]);

  useEffect(() => {
    setFullWidth(page.full_width);
    const o = favoritedOverrideRef.current;
    if (o && Date.now() < o.untilMs) {
      setFavorited(o.value);
    } else {
      favoritedOverrideRef.current = null;
      setFavorited(page.favorited);
    }
  }, [page.id, page.full_width, page.favorited]);

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

  /** Both modes are centered; full width uses a wider cap, not main-column bleed. */
  const contentShellClass = fullWidth
    ? "mx-auto w-full min-w-0 max-w-6xl px-4 md:px-6"
    : "mx-auto w-full min-w-0 max-w-4xl px-4 md:px-6";

  const iconPickerValue: PageIconValue = {
    icon_type: pageMeta.icon_type === "material" ? "material" : "emoji",
    icon_value:
      typeof pageMeta.icon_value === "string" && pageMeta.icon_value.length > 0
        ? pageMeta.icon_value
        : pageMeta.icon_type === "material"
          ? "description"
          : "📄",
    icon_color: typeof pageMeta.icon_color === "string" ? pageMeta.icon_color : "grey",
  };

  const displayTitle = (pageMeta.title ?? "").trim() || "Untitled";
  const iconColorClass = pageIconTextClass(iconPickerValue.icon_color);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col" suppressHydrationWarning>
      {/* Full bleed within main: not inside max-width / horizontal padding shell */}
      <div className="flex h-10 w-full shrink-0 items-center gap-2 border-b border-bg-tertiary/40 bg-white">
        <div className="flex min-w-0 flex-1 items-center gap-2 pl-4 md:pl-6">
          {iconPickerValue.icon_type === "material" ? (
            <span
              className={`material-symbols-rounded shrink-0 leading-none ${iconColorClass}`}
              style={{ fontSize: 18, fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
            >
              {iconPickerValue.icon_value}
            </span>
          ) : (
            <span className="shrink-0 text-[16px] leading-none">{iconPickerValue.icon_value}</span>
          )}
          <span className="truncate text-[13px] font-medium text-mono-medium">{displayTitle}</span>
        </div>
        <div className="shrink-0 pr-4 md:pr-6">
          <PageTopBar
            pageId={page.id}
            favorited={favorited}
            fullWidth={fullWidth}
            onFullWidthChange={setFullWidth}
            onFavoritedChange={handleFavoritedChange}
          />
        </div>
      </div>

      <div className={`${contentShellClass} flex min-h-0 flex-1 flex-col`}>
        <div className="flex flex-col gap-0 pt-4 pb-2">
          <div className="flex flex-col gap-4 pb-5" suppressHydrationWarning>
            <PageIconPicker
              variant="plain"
              size={56}
              value={iconPickerValue}
              onChange={savePageIcon}
              className="mt-5 shrink-0 self-start md:mt-6"
            />
            <input
              suppressHydrationWarning
              value={pageMeta.title ?? ""}
              onChange={(e) => setPageTitle(e.target.value)}
              placeholder="Untitled"
              aria-label="Page title"
              className="page-title-field min-w-0 w-full appearance-none bg-transparent text-[32px] leading-tight font-sans font-bold text-mono-dark rounded-none border-0 shadow-none outline-none ring-0 focus:ring-0 placeholder:text-mono-light/50"
            />
          </div>

          {viewSettingsLoaded ? (
            <ActivityToolbar
              viewState={viewState}
              onViewStateChange={persistViewState}
              onReanalyzeAll={onReanalyzeAll}
              reanalyzing={false}
              onNewTransaction={() => void openNewTransaction()}
              totalCount={totalCount}
              loading={loading}
              hideTitle
              multiColumnSort
              exportFilenameBase={pageMeta.title?.trim() || "Untitled"}
              transactionProperties={transactionProperties}
              expandToContainer={fullWidth}
            />
          ) : (
            <div className="mt-1 flex items-center gap-2 text-[13px] text-mono-medium">
              <span className="material-symbols-rounded animate-spin text-[18px]">progress_activity</span>
              Loading view settings…
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 pb-6">
        {toast && <div className="mt-2 mb-2 text-sm text-mono-medium">{toast}</div>}
        <div className="relative min-h-[200px]">
          <div className="relative">
            {viewSettingsLoaded ? (
              <ActivityTable
                transactions={transactions}
                visibleColumns={viewState.visible_columns}
                columnWidths={viewState.column_widths}
                selectedId={sidebarTransaction?.id ?? null}
                onSelectRow={setSidebarTransaction}
                onColumnWidthChange={(col, width) => persistViewState({ column_widths: { [col]: width } })}
                onColumnsReorder={(cols) => persistViewState({ visible_columns: cols })}
                expandToContainer={fullWidth}
                transactionProperties={transactionProperties}
                memberDisplayById={memberDisplayById}
                onPatchCustomField={patchCheckboxCustomField}
                dataSourceById={dataSourceById}
              />
            ) : (
              <div className="flex items-center justify-center rounded-2xl border border-black/[0.06] bg-[#f5f5f7]/60 py-10">
                <span className="material-symbols-rounded animate-spin text-3xl text-mono-medium">progress_activity</span>
              </div>
            )}
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
            <div className="mt-3 rounded-lg border border-black/[0.06] bg-neutral-50/50 py-6 text-center text-sm text-mono-light">
              No transactions match this view.
            </div>
          )}
        </div>
        </div>
      </div>

      {sidebarTransaction && (
        <TransactionDetailPanel
          transaction={sidebarTransaction}
          onClose={() => setSidebarTransaction(null)}
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

