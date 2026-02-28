"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ActivityVisibleColumn } from "@/lib/validation/schemas";

const COLUMN_LABELS: Record<ActivityVisibleColumn, string> = {
  date: "Date",
  vendor: "Vendor",
  description: "Description",
  amount: "Amount",
  transaction_type: "Type",
  status: "Status",
  category: "Category",
  schedule_c_line: "Schedule C",
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
  filters: {
    status: string | null;
    transaction_type: string | null;
    search: string;
    date_from: string;
    date_to: string;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
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
}: ActivityToolbarProps) {
  const [searchInput, setSearchInput] = useState(viewState.filters.search);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const toggleColumn = (key: ActivityVisibleColumn) => {
    const next = viewState.visible_columns.includes(key)
      ? viewState.visible_columns.filter((c) => c !== key)
      : [...viewState.visible_columns, key];
    onViewStateChange({ visible_columns: next });
  };

  const iconBtnClass = "flex h-7 w-7 items-center justify-center rounded text-mono-light transition-colors hover:bg-bg-tertiary/40 hover:text-mono-dark";

  return (
    <div className="space-y-4">
      {/* Header: title + count only */}
      <div>
        <h1 className="text-3xl font-bold text-mono-dark">All Activity</h1>
        <p className="text-[11px] text-mono-light mt-0.5 tracking-wide">{totalCount} transactions</p>
      </div>

      {/* Loading bar when scanning */}
      {loading && (
        <div className="h-0.5 w-full bg-bg-tertiary/40 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-accent-sage rounded-full animate-loading-bar" />
        </div>
      )}

      {/* Toolbar row: icons left, New right */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-bg-tertiary/30 bg-white/60 px-2 py-1.5">
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
          type="button"
          onClick={() => setPropertiesOpen(true)}
          title="Show or hide columns"
          className={iconBtnClass}
          aria-label="Show or hide columns"
        >
          <span className={ICON_CLASS} style={ICON_STYLE}>visibility</span>
        </button>

        {/* Date range — calendar opens modal */}
        <button
          type="button"
          onClick={() => setDateOpen(true)}
          title="Change date range"
          className={iconBtnClass}
          aria-label="Change date range"
        >
          <span className={ICON_CLASS} style={ICON_STYLE}>calendar_month</span>
        </button>

        <div className="h-4 w-px bg-bg-tertiary/40" aria-hidden />

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

        {/* Export */}
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          title="Export"
          className={iconBtnClass}
          aria-label="Export"
        >
          <span className={ICON_CLASS} style={ICON_STYLE}>download</span>
        </button>

        <div className="flex-1 min-w-2" aria-hidden />

        {/* New — right aligned, text only, no icon */}
        <button
          type="button"
          onClick={onNewTransaction}
          title="New (n)"
          className="inline-flex items-center gap-1.5 rounded-md bg-accent-sage px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-sage/90 transition-colors"
        >
          New
          <kbd className="ml-0.5 rounded bg-white/20 px-1 py-px text-[10px] font-medium">n</kbd>
        </button>
      </div>

      {/* Filter modal */}
      <ActivityModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter"
        subtitle="Filter by status and transaction type."
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

      {/* Properties (columns) modal */}
      <ActivityModal
        open={propertiesOpen}
        onClose={() => setPropertiesOpen(false)}
        title="Columns"
        subtitle="Show or hide columns in the table."
        aria-labelledby="activity-properties-title"
      >
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {(Object.keys(COLUMN_LABELS) as ActivityVisibleColumn[]).map((key) => (
            <label
              key={key}
              className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer hover:bg-bg-secondary/80 text-sm text-mono-dark"
            >
              <input
                type="checkbox"
                checked={viewState.visible_columns.includes(key)}
                onChange={() => toggleColumn(key)}
                className="rounded border-bg-tertiary text-sm"
              />
              {COLUMN_LABELS[key]}
            </label>
          ))}
        </div>
      </ActivityModal>

      {/* Date range modal — calendar icon opens this */}
      <ActivityModal
        open={dateOpen}
        onClose={() => setDateOpen(false)}
        title="Date range"
        subtitle="Set the from and to dates for the activity list."
        aria-labelledby="activity-date-title"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="activity-date-from" className="text-sm font-medium text-mono-dark shrink-0 w-12">
              From
            </label>
            <input
              id="activity-date-from"
              type="date"
              value={viewState.filters.date_from}
              onChange={(e) =>
                onViewStateChange({
                  filters: { ...viewState.filters, date_from: e.target.value },
                })
              }
              className="flex-1 min-w-0 border border-bg-tertiary/60 rounded-lg px-3 py-2 text-sm text-mono-dark bg-white focus:ring-2 focus:ring-accent-sage/20 focus:border-accent-sage/40 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="activity-date-to" className="text-sm font-medium text-mono-dark shrink-0 w-8">
              To
            </label>
            <input
              id="activity-date-to"
              type="date"
              value={viewState.filters.date_to}
              onChange={(e) =>
                onViewStateChange({
                  filters: { ...viewState.filters, date_to: e.target.value },
                })
              }
              className="flex-1 min-w-0 border border-bg-tertiary/60 rounded-lg px-3 py-2 text-sm text-mono-dark bg-white focus:ring-2 focus:ring-accent-sage/20 focus:border-accent-sage/40 outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={() => setDateOpen(false)}
            className="rounded-md bg-mono-dark px-4 py-2.5 text-sm font-semibold text-white hover:bg-mono-dark/90 transition"
          >
            Done
          </button>
        </div>
      </ActivityModal>

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

      {/* Export modal — CSV or PDF */}
      <ActivityModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export"
        subtitle="Export the current activity list (with your filters and date range) as CSV or PDF."
        aria-labelledby="activity-export-title"
      >
        <div className="space-y-3">
          <p className="text-sm text-mono-medium">
            The export uses your current date range, filters, and sort order (up to 5,000 transactions).
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams({
                  format: "csv",
                  date_from: viewState.filters.date_from,
                  date_to: viewState.filters.date_to,
                  sort_by: viewState.sort_column,
                  sort_order: viewState.sort_asc ? "asc" : "desc",
                });
                if (viewState.filters.status) params.set("status", viewState.filters.status);
                if (viewState.filters.transaction_type) params.set("transaction_type", viewState.filters.transaction_type);
                if (viewState.filters.search) params.set("search", viewState.filters.search);
                window.open(`/api/transactions/export?${params.toString()}`, "_blank");
                setExportOpen(false);
              }}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border-2 border-bg-tertiary/60 px-4 py-3 text-sm font-medium text-mono-dark hover:bg-bg-secondary/80 transition"
            >
              <span className="material-symbols-rounded text-lg">table_chart</span>
              Export as CSV
            </button>
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams({
                  format: "pdf",
                  date_from: viewState.filters.date_from,
                  date_to: viewState.filters.date_to,
                  sort_by: viewState.sort_column,
                  sort_order: viewState.sort_asc ? "asc" : "desc",
                });
                if (viewState.filters.status) params.set("status", viewState.filters.status);
                if (viewState.filters.transaction_type) params.set("transaction_type", viewState.filters.transaction_type);
                if (viewState.filters.search) params.set("search", viewState.filters.search);
                window.open(`/api/transactions/export?${params.toString()}`, "_blank");
                setExportOpen(false);
              }}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border-2 border-bg-tertiary/60 px-4 py-3 text-sm font-medium text-mono-dark hover:bg-bg-secondary/80 transition"
            >
              <span className="material-symbols-rounded text-lg">picture_as_pdf</span>
              Export as PDF
            </button>
          </div>
        </div>
      </ActivityModal>
    </div>
  );
}
