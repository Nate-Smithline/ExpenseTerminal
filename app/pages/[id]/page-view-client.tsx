"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import type { Database, Json } from "@/lib/types/database";
import { ActivityToolbar, type ActivityViewState } from "@/app/activity/ActivityToolbar";
import { ActivityTable } from "@/app/activity/ActivityTable";
import { TransactionDetailPanel, type TransactionDetailUpdate } from "@/components/TransactionDetailPanel";
import type { TransactionPropertyDefinition } from "@/lib/transaction-property-definition";
import type { OrgMemberOption } from "@/components/TransactionDetailCustomFields";
import { PageTopBar } from "@/components/PageTopBar";
import { PageIconPicker, type PageIconValue } from "@/components/PageIconPicker";
import { pageIconTextClass } from "@/lib/page-icon-colors";
import { useIntersectionLoadMore } from "@/lib/use-intersection-load-more";
import { parseColumnFiltersJson, serializeColumnFiltersForQuery } from "@/lib/activity-column-filters";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

const PAGE_SIZE = 100;

function defaultDateRange() {
  const y = new Date().getFullYear();
  return { date_from: `${y}-01-01`, date_to: `${y}-12-31` };
}

const DEFAULT_VIEW_STATE: ActivityViewState = {
  sort_column: "date",
  sort_asc: false,
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
  const patchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const memberDisplayById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const mem of orgMembers) {
      m[mem.id] = mem.display_name?.trim() || mem.email?.trim() || mem.id.slice(0, 8);
    }
    return m;
  }, [orgMembers]);
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
    setLoading(true);
    const params = baseQueryParams();
    const [txs, count] = await Promise.all([fetchTransactions(params), fetchCount(params)]);
    setTransactions(txs);
    setTotalCount(count);
    setLoading(false);
  }, [baseQueryParams]);

  const canLoadMore = transactions.length < totalCount;
  const loadMore = useCallback(async () => {
    if (loading || loadingMore) return;
    if (!canLoadMore) return;
    setLoadingMore(true);
    try {
      const params = { ...baseQueryParams(), offset: String(transactions.length) };
      const next = await fetchTransactions(params);
      if (next.length > 0) setTransactions((prev) => [...prev, ...next]);
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
            setViewState({
              sort_column: data.sort_column ?? DEFAULT_VIEW_STATE.sort_column,
              sort_asc: data.sort_asc ?? DEFAULT_VIEW_STATE.sort_asc,
              visible_columns:
                Array.isArray(data.visible_columns) && data.visible_columns.length > 0
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

  const persistViewState = useCallback(
    (patch: Partial<ActivityViewState>) => {
      const next = {
        ...viewState,
        ...patch,
        column_widths: patch.column_widths
          ? { ...viewState.column_widths, ...patch.column_widths }
          : viewState.column_widths,
        filters: patch.filters ?? viewState.filters,
      };
      setViewState(next);
      if (patchDebounceRef.current) clearTimeout(patchDebounceRef.current);
      patchDebounceRef.current = setTimeout(async () => {
        patchDebounceRef.current = null;
        await fetch(`/api/pages/${page.id}/activity-view-settings`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sort_column: next.sort_column,
            sort_asc: next.sort_asc,
            visible_columns: next.visible_columns,
            column_widths: next.column_widths,
            filters: next.filters,
          }),
        });
      }, 400);
    },
    [page.id, viewState]
  );

  useEffect(() => {
    return () => {
      if (patchDebounceRef.current) clearTimeout(patchDebounceRef.current);
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    };
  }, []);

  const onReanalyzeAll = useCallback(() => {
    setToast("Batch re-analysis is available on All Activity for now");
    setTimeout(() => setToast(null), 3500);
  }, []);

  const onNewTransaction = useCallback(() => {
    setToast("New transaction is available on All Activity for now");
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    setFullWidth(page.full_width);
    setFavorited(page.favorited);
  }, [page.id, page.full_width, page.favorited]);

  const handleSave = useCallback(
    async (id: string, data: TransactionDetailUpdate & { status?: string }) => {
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
    },
    [loadTransactions]
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
    <div className="flex h-full min-h-0 min-w-0 flex-col">
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
            onFavoritedChange={setFavorited}
          />
        </div>
      </div>

      <div className={`${contentShellClass} flex min-h-0 flex-1 flex-col`}>
        <div className="flex flex-col gap-0 pt-4 pb-2">
          <div className="flex flex-col gap-4 pb-5">
            <PageIconPicker
              variant="plain"
              size={56}
              value={iconPickerValue}
              onChange={savePageIcon}
              className="mt-5 shrink-0 self-start md:mt-6"
            />
            <input
              value={pageMeta.title ?? ""}
              onChange={(e) => setPageTitle(e.target.value)}
              placeholder="Untitled"
              aria-label="Page title"
              className="page-title-field min-w-0 w-full appearance-none bg-transparent text-[32px] leading-tight font-sans font-bold text-mono-dark rounded-none border-0 shadow-none outline-none ring-0 focus:ring-0 placeholder:text-mono-light/50"
            />
          </div>

          <ActivityToolbar
            viewState={viewState}
            onViewStateChange={persistViewState}
            onReanalyzeAll={onReanalyzeAll}
            reanalyzing={false}
            onNewTransaction={onNewTransaction}
            totalCount={totalCount}
            loading={loading}
            hideTitle
            transactionProperties={transactionProperties}
            expandToContainer={fullWidth}
          />
        </div>

        <div className="min-h-0 flex-1 pb-6">
        {toast && <div className="mt-2 mb-2 text-sm text-mono-medium">{toast}</div>}
        {loading && transactions.length === 0 ? (
          <div className="py-10 text-sm text-mono-light">Loading…</div>
        ) : transactions.length === 0 ? (
          <div className="py-10 text-sm text-mono-light">No transactions match this view.</div>
        ) : (
          <>
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
            />
            {loadingMore && (
              <div className="flex justify-center py-3 text-sm text-mono-light">Loading…</div>
            )}
            {canLoadMore && (
              <div ref={loadMoreSentinelRef} className="h-4 w-full shrink-0" aria-hidden />
            )}
          </>
        )}
        </div>
      </div>

      {sidebarTransaction && (
        <TransactionDetailPanel
          transaction={sidebarTransaction}
          onClose={() => setSidebarTransaction(null)}
          editable
          onSave={async (id, update) => {
            await handleSave(id, update);
            setSidebarTransaction((prev) => {
              if (!prev || prev.id !== id) return prev;
              const { custom_fields: cfPatch, ...rest } = update;
              let next = { ...prev, ...rest } as Transaction;
              if (cfPatch && typeof cfPatch === "object" && !Array.isArray(cfPatch)) {
                const prevCf =
                  prev.custom_fields && typeof prev.custom_fields === "object" && !Array.isArray(prev.custom_fields)
                    ? { ...(prev.custom_fields as Record<string, Json>) }
                    : {};
                next = {
                  ...next,
                  custom_fields: { ...prevCf, ...(cfPatch as Record<string, Json>) } as Transaction["custom_fields"],
                };
              }
              const amount: string = typeof next.amount === "number" ? String(next.amount) : (next.amount ?? "");
              return { ...next, amount };
            });
          }}
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

