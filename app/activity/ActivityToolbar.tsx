"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ActivityVisibleColumn } from "@/lib/validation/schemas";
import type { TransactionPropertyDefinition } from "@/lib/transaction-property-definition";
import { ActivityColumnFiltersBar } from "@/components/ActivityColumnFiltersBar";
import { ActivityPropertyVisibilityPanel } from "@/components/ActivityPropertyVisibilityPanel";
import type { ActivityColumnFilterRow } from "@/lib/activity-column-filters";
import { serializeColumnFiltersForQuery } from "@/lib/activity-column-filters";

const COLUMN_LABELS: Record<ActivityVisibleColumn, string> = {
  date: "Date",
  vendor: "Vendor",
  description: "Description",
  amount: "Amount",
  transaction_type: "Type",
  status: "Status",
  category: "Category",
  schedule_c_line: "Schedule C",
  source: "Source",
  ai_confidence: "AI %",
  business_purpose: "Business purpose",
  quick_label: "Quick label",
  notes: "Notes",
  created_at: "Created",
};

export interface ActivityViewState {
  sort_column: string;
  sort_asc: boolean;
  visible_columns: string[];
  column_widths: Record<string, number>;
  filters: {
    status: string | null;
    transaction_type: string | null;
    source: string | null;
    data_source_id?: string | null;
    search: string;
    date_from: string;
    date_to: string;
    column_filters?: ActivityColumnFilterRow[];
  };
}

interface ActivityToolbarProps {
  viewState: ActivityViewState;
  onViewStateChange: (patch: Partial<ActivityViewState>) => void;
  onReanalyzeAll: () => void;
  reanalyzing: boolean;
  onNewTransaction: () => void;
  totalCount: number;
  loading?: boolean;
  /** When true, the large title block is omitted (e.g. page title lives in PageTopBar). */
  hideTitle?: boolean;
  title?: string;
  titleEditable?: boolean;
  titleValue?: string;
  onTitleChange?: (value: string) => void;
  transactionProperties?: TransactionPropertyDefinition[];
  /** Match horizontal inset of ActivityTable wrapper (saved pages: pass same as table’s expandToContainer). */
  expandToContainer?: boolean;
}

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "auto_sorted", label: "Auto-sorted" },
  { value: "personal", label: "Personal" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

const SOURCE_OPTIONS = [
  { value: "", label: "All sources" },
  { value: "data_feed", label: "Direct Feed" },
  { value: "csv_upload", label: "CSV" },
  { value: "manual", label: "Manual" },
];

const SORT_OPTIONS: [string, boolean, string][] = [
  ["date", false, "Date (newest)"],
  ["date", true, "Date (oldest)"],
  ["amount", false, "Amount (high first)"],
  ["amount", true, "Amount (low first)"],
  ["vendor", true, "Vendor (A–Z)"],
  ["vendor", false, "Vendor (Z–A)"],
  ["status", true, "Status (A–Z)"],
  ["status", false, "Status (Z–A)"],
  ["transaction_type", true, "Type (A–Z)"],
  ["transaction_type", false, "Type (Z–A)"],
  ["category", true, "Category (A–Z)"],
  ["category", false, "Category (Z–A)"],
  ["created_at", false, "Created (newest)"],
  ["created_at", true, "Created (oldest)"],
];

/** Org-profile style modal: centered, dark header, ESC to close. */
function ActivityModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  "aria-labelledby": ariaLabelledby,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  "aria-labelledby"?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      const firstFocusable = containerRef.current?.querySelector<HTMLElement>("button, [href], input, select, textarea");
      firstFocusable?.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 min-h-[100dvh] z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledby}
    >
      <div
        ref={containerRef}
        className="rounded-xl bg-white shadow-[0_8px_30px_-6px_rgba(0,0,0,0.14)] max-w-[500px] w-full mx-4 overflow-hidden"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        <div className="rounded-t-xl bg-[#2d3748] px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={ariaLabelledby} className="text-xl font-bold text-white tracking-tight">
                {title}
              </h2>
              {subtitle && <p className="text-sm text-white/80 mt-1.5">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition shrink-0"
              aria-label="Close"
            >
              <span className="material-symbols-rounded text-[18px]">close</span>
            </button>
          </div>
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

const ICON_CLASS = "material-symbols-rounded text-[16px]";
const ICON_STYLE = { fontSize: "16px" };

export function ActivityToolbar({
  viewState,
  onViewStateChange,
  onReanalyzeAll,
  reanalyzing,
  onNewTransaction,
  totalCount,
  loading = false,
  hideTitle = false,
  title = "All Activity",
  titleEditable = false,
  titleValue,
  onTitleChange,
  transactionProperties = [],
  expandToContainer = false,
}: ActivityToolbarProps) {
  const [searchInput, setSearchInput] = useState(viewState.filters.search);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportToast, setExportToast] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const propertiesAnchorRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setSearchInput(viewState.filters.search);
  }, [viewState.filters.search]);

  const applySearch = useCallback(() => {
    onViewStateChange({ filters: { ...viewState.filters, search: searchInput.trim() } });
    setSearchModalOpen(false);
  }, [onViewStateChange, viewState.filters, searchInput]);

  useEffect(() => {
    const t = setTimeout(() => {
      onViewStateChange({
        filters: { ...viewState.filters, search: searchInput.trim() },
      });
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchModalOpen) {
      const id = setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [searchModalOpen]);

  const sortedOrgProperties = [...transactionProperties].sort((a, b) => a.position - b.position);

  const buildExportSearchParams = useCallback(() => {
    const params = new URLSearchParams({
      date_from: viewState.filters.date_from,
      date_to: viewState.filters.date_to,
      sort_by: viewState.sort_column,
      sort_order: viewState.sort_asc ? "asc" : "desc",
    });
    if (viewState.filters.status) params.set("status", viewState.filters.status);
    if (viewState.filters.transaction_type) params.set("transaction_type", viewState.filters.transaction_type);
    if (viewState.filters.source) params.set("source", viewState.filters.source);
    if (viewState.filters.data_source_id) params.set("data_source_id", viewState.filters.data_source_id);
    if (viewState.filters.search) params.set("search", viewState.filters.search);
    if (viewState.filters.column_filters?.length) {
      params.set("column_filters", serializeColumnFiltersForQuery(viewState.filters.column_filters));
    }
    return params;
  }, [viewState]);

  const downloadCsvExport = useCallback(async () => {
    setExporting(true);
    setExportToast(null);
    try {
      const params = buildExportSearchParams();
      const res = await fetch(`/api/transactions/export?${params.toString()}`, {
        credentials: "same-origin",
      });
      const contentType = res.headers.get("Content-Type") ?? "";
      if (!res.ok) {
        const errText =
          contentType.includes("application/json") ? (await res.json().catch(() => null))?.error : null;
        setExportToast(typeof errText === "string" ? errText : "Export failed");
        setTimeout(() => setExportToast(null), 5000);
        return;
      }
      const blob = await res.blob();
      const fallbackName = `activity-export-${viewState.filters.date_from}-to-${viewState.filters.date_to}.csv`;
      const dispo = res.headers.get("Content-Disposition");
      let filename = fallbackName;
      if (dispo) {
        const m = /filename="([^"]+)"/.exec(dispo) ?? /filename=([^;\s]+)/.exec(dispo);
        if (m?.[1]) filename = m[1].trim();
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportToast("Export failed");
      setTimeout(() => setExportToast(null), 5000);
    } finally {
      setExporting(false);
    }
  }, [buildExportSearchParams, viewState.filters.date_from, viewState.filters.date_to]);

  const iconBtnClass = "flex h-7 w-7 items-center justify-center rounded text-mono-light transition-colors hover:bg-bg-tertiary/40 hover:text-mono-dark";

  const tableAlignClass = expandToContainer
    ? "w-full min-w-0"
    : "-mx-2 px-2 md:mx-0 md:px-0 min-w-0";

  return (
    <div className="space-y-4">
      {!hideTitle && (
        <div>
          {titleEditable ? (
            <input
              value={titleValue ?? ""}
              onChange={(e) => onTitleChange?.(e.target.value)}
              placeholder="Untitled"
              aria-label="Page title"
              className="page-title-field w-full appearance-none bg-transparent text-[32px] leading-tight font-sans font-normal text-mono-dark rounded-none border-0 border-transparent shadow-none outline-none ring-0 ring-offset-0 focus:border-0 focus:border-transparent focus:shadow-none focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0"
            />
          ) : (
            <div
              role="heading"
              aria-level={1}
              className="text-[32px] leading-tight font-sans font-normal text-mono-dark"
            >
              {title}
            </div>
          )}
        </div>
      )}

      {/* Loading bar when scanning */}
      {loading && (
        <div className="h-0.5 w-full bg-bg-tertiary/40 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-accent-sage rounded-full animate-loading-bar" />
        </div>
      )}

      {/* Toolbar row: icons left, New right — same horizontal box as ActivityTable wrapper */}
      <div className={`flex flex-wrap items-center gap-1 py-1.5 ${tableAlignClass}`}>
        {/* Filter */}
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          title="Filter by status and type"
          className={iconBtnClass}
          aria-label="Filter by status and type"
        >
          <span className={ICON_CLASS} style={ICON_STYLE}>filter_list</span>
        </button>

        {/* Sort */}
        <button
          type="button"
          onClick={() => setSortOpen(true)}
          title="Sort by column"
          className={iconBtnClass}
          aria-label="Sort by column"
        >
          <span className={ICON_CLASS} style={ICON_STYLE}>swap_vert</span>
        </button>

        {/* Properties (columns) — eye icon */}
        <button
          ref={propertiesAnchorRef}
          type="button"
          onClick={() => setPropertiesOpen(true)}
          title="Show or hide columns"
          className={iconBtnClass}
          aria-label="Show or hide columns"
        >
          <span className={ICON_CLASS} style={ICON_STYLE}>visibility</span>
        </button>

        {/* Search */}
        <button
          type="button"
          onClick={() => setSearchModalOpen(true)}
          title="Search vendor or description"
          className={iconBtnClass}
          aria-label="Search vendor or description"
        >
          <span className={ICON_CLASS} style={ICON_STYLE}>search</span>
        </button>

        {/* Re-analyze (AI) */}
        <button
          type="button"
          onClick={onReanalyzeAll}
          disabled={reanalyzing}
          title="AI: Re-analyze uncategorized"
          className={`${iconBtnClass} disabled:opacity-50 disabled:pointer-events-none shrink-0`}
          aria-label="AI: Re-analyze uncategorized"
        >
          <span className={ICON_CLASS} style={ICON_STYLE}>bolt</span>
        </button>

        {/* Export — CSV only */}
        <button
          type="button"
          onClick={() => void downloadCsvExport()}
          disabled={exporting}
          title="Download CSV"
          className={`${iconBtnClass} disabled:opacity-50 disabled:pointer-events-none shrink-0`}
          aria-label="Download CSV"
        >
          <span className={ICON_CLASS} style={ICON_STYLE}>download</span>
        </button>

        <div className="flex-1 min-w-2" aria-hidden />

        {/* New — right aligned, text only, no icon */}
        <button
          type="button"
          onClick={onNewTransaction}
          title="New (n)"
          className="inline-flex items-center rounded-none bg-sovereign-blue px-3 py-1.5 text-xs font-medium text-black hover:bg-sovereign-blue/90 transition-colors"
        >
          New
        </button>
      </div>

      <ActivityColumnFiltersBar
        columnFilters={viewState.filters.column_filters ?? []}
        onColumnFiltersChange={(column_filters) =>
          onViewStateChange({ filters: { ...viewState.filters, column_filters } })
        }
        transactionProperties={transactionProperties}
      />

      {/* Filter modal */}
      <ActivityModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter"
        subtitle="Filter by status, type, and account."
        aria-labelledby="activity-filter-title"
      >
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-medium text-mono-light uppercase tracking-wider mb-2">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((o) => (
                <button
                  key={o.value || "all"}
                  type="button"
                  onClick={() => {
                    onViewStateChange({ filters: { ...viewState.filters, status: o.value || null } });
                    setFilterOpen(false);
                  }}
                  className="rounded-md border border-bg-tertiary/60 px-3 py-1.5 text-xs text-mono-dark hover:bg-bg-secondary/80 transition"
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-medium text-mono-light uppercase tracking-wider mb-2">Type</p>
            <div className="flex flex-wrap gap-1.5">
              {TYPE_OPTIONS.map((o) => (
                <button
                  key={o.value || "all"}
                  type="button"
                  onClick={() => {
                    onViewStateChange({
                      filters: { ...viewState.filters, transaction_type: o.value || null },
                    });
                    setFilterOpen(false);
                  }}
                  className="rounded-md border border-bg-tertiary/60 px-3 py-1.5 text-xs text-mono-dark hover:bg-bg-secondary/80 transition"
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-medium text-mono-light uppercase tracking-wider mb-2">Data source</p>
            <div className="flex flex-wrap gap-1.5">
              {SOURCE_OPTIONS.map((o) => (
                <button
                  key={o.value || "all"}
                  type="button"
                  onClick={() => {
                    onViewStateChange({
                      filters: { ...viewState.filters, source: o.value || null },
                    });
                    setFilterOpen(false);
                  }}
                  className="rounded-md border border-bg-tertiary/60 px-3 py-1.5 text-xs text-mono-dark hover:bg-bg-secondary/80 transition"
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </ActivityModal>

      {/* Sort modal */}
      <ActivityModal
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        title="Sort"
        subtitle="Choose sort order for the activity table."
        aria-labelledby="activity-sort-title"
      >
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {SORT_OPTIONS.map(([col, asc, label]) => (
            <button
              key={`${col}-${asc}`}
              type="button"
              onClick={() => {
                onViewStateChange({ sort_column: col, sort_asc: asc });
                setSortOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-md text-sm text-mono-dark hover:bg-bg-secondary/80 transition"
            >
              {label}
            </button>
          ))}
        </div>
      </ActivityModal>

      <ActivityPropertyVisibilityPanel
        open={propertiesOpen}
        anchorRef={propertiesAnchorRef}
        onClose={() => setPropertiesOpen(false)}
        visibleColumns={viewState.visible_columns}
        onVisibleColumnsChange={(visible_columns) => onViewStateChange({ visible_columns })}
        transactionProperties={transactionProperties}
      />

      {/* Search modal — Enter to search */}
      <ActivityModal
        open={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        title="Search"
        subtitle="Search by vendor or description. Press Enter to apply."
        aria-labelledby="activity-search-title"
      >
        <div className="space-y-4">
          <input
            ref={searchInputRef}
            id="activity-search-input"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applySearch();
              }
            }}
            placeholder="Vendor or description…"
            className="w-full border border-bg-tertiary/60 rounded-lg px-3 py-2.5 text-sm text-mono-dark bg-white placeholder:text-mono-light focus:ring-2 focus:ring-accent-sage/20 focus:border-accent-sage/40 outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSearchModalOpen(false)}
              className="rounded-md border border-bg-tertiary bg-white px-4 py-2.5 text-sm font-semibold text-mono-dark hover:bg-bg-secondary transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applySearch}
              className="rounded-md bg-mono-dark px-4 py-2.5 text-sm font-semibold text-white hover:bg-mono-dark/90 transition"
            >
              Search
            </button>
          </div>
        </div>
      </ActivityModal>

      {exporting && (
        <div
          className="fixed inset-0 min-h-[100dvh] z-[60] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
          role="alert"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="rounded-none bg-white shadow-xl max-w-md w-full mx-4 overflow-hidden border-0 px-6 py-12 flex flex-col items-center justify-center gap-4">
            <span className="material-symbols-rounded animate-spin text-4xl text-black/40">progress_activity</span>
            <h2
              className="text-xl text-black font-medium text-center"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              Preparing download
            </h2>
            <p className="text-xs text-black/70 text-center">
              Building your CSV with the current filters. Large exports may take a minute.
            </p>
          </div>
        </div>
      )}

      {exportToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] max-w-[min(90vw,28rem)] rounded-none bg-[#5B82B4] text-black px-4 py-2.5 text-sm shadow-lg text-center">
          {exportToast}
        </div>
      )}
    </div>
  );
}
