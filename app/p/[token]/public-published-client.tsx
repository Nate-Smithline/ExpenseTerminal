"use client";

import { useCallback, useEffect, useState } from "react";
import { useIntersectionLoadMore } from "@/lib/use-intersection-load-more";
import Link from "next/link";
import type { Database } from "@/lib/types/database";
import { ActivityTable } from "@/app/activity/ActivityTable";
import { pageIconTextClass } from "@/lib/page-icon-colors";
import type { ActivityViewState } from "@/app/activity/ActivityToolbar";
import { serializeSortRulesForQuery } from "@/lib/activity-sort-rules";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

const PAGE_SIZE = 100;

type PagePayload = {
  title: string;
  icon_type: string;
  icon_value: string;
  icon_color: string;
  full_width: boolean;
};

type ViewPayload = ActivityViewState;

async function fetchMeta(token: string): Promise<{ page: PagePayload; view: ViewPayload } | null> {
  const res = await fetch(`/api/pages/publish/${encodeURIComponent(token)}`);
  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  if (!body?.page || !body?.view) return null;
  return body as { page: PagePayload; view: ViewPayload };
}

async function fetchTransactions(token: string, offset: number, view: ViewPayload): Promise<{ rows: Transaction[]; count: number }> {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
    sort_by: view.sort_column,
    sort_order: view.sort_asc ? "asc" : "desc",
    date_from: view.filters.date_from,
    date_to: view.filters.date_to,
  });
  if (Array.isArray((view as any).sort_rules) && (view as any).sort_rules.length > 0) {
    params.set("sort_rules", serializeSortRulesForQuery((view as any).sort_rules));
  }
  if (view.filters.status) params.set("status", view.filters.status);
  if (view.filters.transaction_type) params.set("transaction_type", view.filters.transaction_type);
  if (view.filters.source) params.set("source", view.filters.source);
  if (view.filters.data_source_id) params.set("data_source_id", view.filters.data_source_id);
  if (view.filters.search) params.set("search", view.filters.search);

  const res = await fetch(`/api/pages/publish/${encodeURIComponent(token)}/transactions?${params}`);
  if (!res.ok) return { rows: [], count: 0 };
  const body = await res.json().catch(() => ({}));
  return {
    rows: (body.data ?? []) as Transaction[],
    count: typeof body.count === "number" ? body.count : 0,
  };
}

async function fetchCount(token: string, view: ViewPayload): Promise<number> {
  const params = new URLSearchParams({
    count_only: "true",
    sort_by: view.sort_column,
    sort_order: view.sort_asc ? "asc" : "desc",
    date_from: view.filters.date_from,
    date_to: view.filters.date_to,
  });
  if (Array.isArray((view as any).sort_rules) && (view as any).sort_rules.length > 0) {
    params.set("sort_rules", serializeSortRulesForQuery((view as any).sort_rules));
  }
  if (view.filters.status) params.set("status", view.filters.status);
  if (view.filters.transaction_type) params.set("transaction_type", view.filters.transaction_type);
  if (view.filters.source) params.set("source", view.filters.source);
  if (view.filters.data_source_id) params.set("data_source_id", view.filters.data_source_id);
  if (view.filters.search) params.set("search", view.filters.search);

  const res = await fetch(`/api/pages/publish/${encodeURIComponent(token)}/transactions?${params}`);
  if (!res.ok) return 0;
  const body = await res.json().catch(() => ({}));
  return typeof body.count === "number" ? body.count : 0;
}

export function PublicPublishedClient({ token }: { token: string }) {
  const [page, setPage] = useState<PagePayload | null>(null);
  const [view, setView] = useState<ViewPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      const meta = await fetchMeta(token);
      if (cancelled) return;
      if (!meta) {
        setLoadError("This published link is invalid or has been turned off.");
        setLoading(false);
        return;
      }
      setPage(meta.page);
      setView(meta.view);
      const [txResult, count] = await Promise.all([
        fetchTransactions(token, 0, meta.view),
        fetchCount(token, meta.view),
      ]);
      if (cancelled) return;
      setTransactions(txResult.rows);
      setTotalCount(count);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const canLoadMore = view != null && transactions.length < totalCount;
  const loadMore = useCallback(async () => {
    if (!view || loading || loadingMore || !canLoadMore) return;
    setLoadingMore(true);
    try {
      const { rows } = await fetchTransactions(token, transactions.length, view);
      if (rows.length > 0) setTransactions((prev) => [...prev, ...rows]);
    } finally {
      setLoadingMore(false);
    }
  }, [token, view, loading, loadingMore, canLoadMore, transactions.length]);

  const loadMoreSentinelRef = useIntersectionLoadMore(
    loadMore,
    Boolean(canLoadMore && !loading && transactions.length > 0),
    transactions.length
  );

  if (loadError) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center px-6 py-16">
        <p className="text-center text-sm text-mono-medium">{loadError}</p>
        <Link
          href="/"
          className="mt-6 text-center text-sm font-medium text-sovereign-blue hover:underline"
        >
          Go to ExpenseTerminal
        </Link>
      </div>
    );
  }

  if (loading || !page || !view) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6 text-sm text-mono-light">
        Loading…
      </div>
    );
  }

  const shellClass = page.full_width
    ? "mx-auto w-full min-w-0 max-w-6xl"
    : "mx-auto w-full min-w-0 max-w-4xl";
  const displayTitle = page.title.trim() || "Untitled";
  const iconColorClass = pageIconTextClass(page.icon_color);
  const iconVal =
    page.icon_value && page.icon_value.length > 0
      ? page.icon_value
      : page.icon_type === "material"
        ? "description"
        : "📄";

  return (
    <div className="min-h-screen bg-white text-mono-dark">
      <header className="border-b border-bg-tertiary/40 bg-white px-4 py-3 md:px-8">
        <div className={`${shellClass} flex flex-wrap items-center justify-between gap-3`}>
          <div className="flex min-w-0 items-center gap-2">
            {page.icon_type === "material" ? (
              <span
                className={`material-symbols-rounded shrink-0 leading-none ${iconColorClass}`}
                style={{ fontSize: 22, fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
              >
                {iconVal}
              </span>
            ) : (
              <span className="shrink-0 text-xl leading-none">{iconVal}</span>
            )}
            <span className="truncate text-[15px] font-semibold text-mono-dark">{displayTitle}</span>
            <span className="shrink-0 rounded-none border border-bg-tertiary/60 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-mono-medium">
              Read-only
            </span>
          </div>
          <Link
            href="/"
            className="shrink-0 text-[13px] font-medium text-sovereign-blue hover:underline"
          >
            ExpenseTerminal
          </Link>
        </div>
      </header>

      <div className={`${shellClass} px-4 py-6 md:px-8`}>
        <p className="mb-4 text-xs text-mono-light">
          Published read-only activity view. Sign in to your workspace to see your own data or change this layout.
        </p>
        {transactions.length === 0 ? (
          <div className="py-12 text-sm text-mono-light">No transactions match this view.</div>
        ) : (
          <>
            <ActivityTable
              transactions={transactions}
              visibleColumns={view.visible_columns}
              columnWidths={view.column_widths}
              selectedId={null}
              onSelectRow={() => {}}
              onColumnWidthChange={() => {}}
              onColumnsReorder={() => {}}
              expandToContainer={page.full_width}
              sanitizePublicCells
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
  );
}
