"use client";

import { useState, useRef, useEffect } from "react";
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

export function ActivityToolbar({
  viewState,
  onViewStateChange,
  onReanalyzeAll,
  reanalyzing,
  onNewTransaction,
  totalCount,
}: ActivityToolbarProps) {
  const [searchInput, setSearchInput] = useState(viewState.filters.search);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const propertiesRef = useRef<HTMLDivElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearchInput(viewState.filters.search);
  }, [viewState.filters.search]);

  useEffect(() => {
    const t = setTimeout(() => {
      onViewStateChange({
        filters: { ...viewState.filters, search: searchInput.trim() },
      });
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchExpanded) searchInputRef.current?.focus();
  }, [searchExpanded]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        !filterRef.current?.contains(target) &&
        !sortRef.current?.contains(target) &&
        !propertiesRef.current?.contains(target) &&
        !searchWrapRef.current?.contains(target)
      ) {
        setFilterOpen(false);
        setSortOpen(false);
        setPropertiesOpen(false);
        setSearchExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleColumn = (key: ActivityVisibleColumn) => {
    const next = viewState.visible_columns.includes(key)
      ? viewState.visible_columns.filter((c) => c !== key)
      : [...viewState.visible_columns, key];
    onViewStateChange({ visible_columns: next });
  };

  return (
    <div className="space-y-4">
      {/* Header: title + New transaction — match other pages */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-mono-dark">All Activity</h1>
          <p className="text-[11px] text-mono-light mt-0.5 tracking-wide">{totalCount} transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNewTransaction}
            title="New transaction (n)"
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-sage px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-sage/90 transition-colors"
          >
            <span className="material-symbols-rounded text-base">add</span>
            New transaction
            <kbd className="ml-0.5 rounded bg-white/20 px-1 py-px text-[10px] font-medium">n</kbd>
          </button>
        </div>
      </div>

      {/* Date range — compact, minimal */}
      <div className="flex items-baseline gap-4 text-mono-medium">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-mono-light">From</span>
          <input
            type="date"
            value={viewState.filters.date_from}
            onChange={(e) =>
              onViewStateChange({
                filters: { ...viewState.filters, date_from: e.target.value },
              })
            }
            className="w-[7.5rem] border-0 border-b border-bg-tertiary/50 bg-transparent pb-1 text-xs text-mono-dark focus:border-mono-dark/30 focus:outline-none"
          />
        </div>
        <span className="text-mono-light/60 text-xs" aria-hidden>→</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-mono-light">To</span>
          <input
            type="date"
            value={viewState.filters.date_to}
            onChange={(e) =>
              onViewStateChange({
                filters: { ...viewState.filters, date_to: e.target.value },
              })
            }
            className="w-[7.5rem] border-0 border-b border-bg-tertiary/50 bg-transparent pb-1 text-xs text-mono-dark focus:border-mono-dark/30 focus:outline-none"
          />
        </div>
      </div>

      {/* Icon toolbar row — minimal, smaller */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-bg-tertiary/30 bg-white/60 px-2 py-1.5">
        {/* Filter */}
        <div className="relative" ref={filterRef}>
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            title="Filter by status and type"
            className="flex h-7 w-7 items-center justify-center rounded text-mono-light transition-colors hover:bg-bg-tertiary/40 hover:text-mono-dark"
            aria-label="Filter by status and type"
          >
            <span className="material-symbols-rounded text-base">filter_list</span>
          </button>
          {filterOpen && (
            <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-bg-tertiary/50 rounded-lg shadow-lg py-1.5 min-w-[140px]">
              <div className="px-2.5 py-1 text-[10px] font-medium text-mono-light uppercase tracking-wider border-b border-bg-tertiary/30">
                Status
              </div>
              {STATUS_OPTIONS.map((o) => (
                <button
                  key={o.value || "all"}
                  type="button"
                  onClick={() => {
                    onViewStateChange({ filters: { ...viewState.filters, status: o.value || null } });
                  }}
                  className="w-full text-left px-2.5 py-1 text-xs text-mono-dark hover:bg-bg-secondary/80"
                >
                  {o.label}
                </button>
              ))}
              <div className="px-2.5 py-1 text-[10px] font-medium text-mono-light uppercase tracking-wider border-b border-t border-bg-tertiary/30 mt-0.5">
                Type
              </div>
              {TYPE_OPTIONS.map((o) => (
                <button
                  key={o.value || "all"}
                  type="button"
                  onClick={() => {
                    onViewStateChange({
                      filters: { ...viewState.filters, transaction_type: o.value || null },
                    });
                  }}
                  className="w-full text-left px-2.5 py-1 text-xs text-mono-dark hover:bg-bg-secondary/80"
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort */}
        <div className="relative" ref={sortRef}>
          <button
            type="button"
            onClick={() => setSortOpen((o) => !o)}
            title="Sort by column"
            className="flex h-7 w-7 items-center justify-center rounded text-mono-light transition-colors hover:bg-bg-tertiary/40 hover:text-mono-dark"
            aria-label="Sort by column"
          >
            <span className="material-symbols-rounded text-base">swap_vert</span>
          </button>
          {sortOpen && (
            <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-bg-tertiary/50 rounded-lg shadow-lg py-1.5 min-w-[180px] max-h-56 overflow-y-auto">
              {[
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
              ].map(([col, asc, label]) => (
                <button
                  key={`${col}-${asc}`}
                  type="button"
                  onClick={() => {
                    onViewStateChange({ sort_column: col as string, sort_asc: asc as boolean });
                    setSortOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1 text-xs text-mono-dark hover:bg-bg-secondary/80"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Properties */}
        <div className="relative" ref={propertiesRef}>
          <button
            type="button"
            onClick={() => setPropertiesOpen((o) => !o)}
            title="Properties: show or hide columns"
            className="flex h-7 w-7 items-center justify-center rounded text-mono-light transition-colors hover:bg-bg-tertiary/40 hover:text-mono-dark"
            aria-label="Properties: show or hide columns"
          >
            <span className="material-symbols-rounded text-base">view_column</span>
          </button>
          {propertiesOpen && (
            <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-bg-tertiary/50 rounded-lg shadow-lg py-1.5 min-w-[160px] max-h-56 overflow-y-auto">
              {(Object.keys(COLUMN_LABELS) as ActivityVisibleColumn[]).map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-2 px-2.5 py-1 cursor-pointer hover:bg-bg-secondary/80 text-xs text-mono-dark"
                >
                  <input
                    type="checkbox"
                    checked={viewState.visible_columns.includes(key)}
                    onChange={() => toggleColumn(key)}
                    className="rounded border-bg-tertiary text-xs"
                  />
                  {COLUMN_LABELS[key]}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-bg-tertiary/40" aria-hidden />

        {/* Search — collapsible */}
        <div className="relative flex items-center" ref={searchWrapRef}>
          {!searchExpanded ? (
            <button
              type="button"
              onClick={() => setSearchExpanded(true)}
              title="Search vendor or description"
              className="flex h-7 w-7 items-center justify-center rounded text-mono-light transition-colors hover:bg-bg-tertiary/40 hover:text-mono-dark"
              aria-label="Search vendor or description"
            >
              <span className="material-symbols-rounded text-base">search</span>
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <span
                className="material-symbols-rounded text-sm text-mono-light pointer-events-none"
                aria-hidden
              >
                search
              </span>
              <input
                ref={searchInputRef}
                id="activity-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onBlur={() => {
                  if (!searchInput.trim()) setSearchExpanded(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchExpanded(false);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Search…"
                title="Search vendor or description"
                className="h-7 w-28 rounded border-0 bg-bg-tertiary/40 pl-6 pr-2 text-xs text-mono-dark placeholder:text-mono-light focus:bg-bg-tertiary/60 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Re-analyze (AI) */}
        <button
          type="button"
          onClick={onReanalyzeAll}
          disabled={reanalyzing}
          title="AI: Re-analyze uncategorized"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-mono-light transition-colors hover:bg-bg-tertiary/40 hover:text-mono-dark disabled:opacity-50 disabled:pointer-events-none"
          aria-label="AI: Re-analyze uncategorized"
        >
          <span className="material-symbols-rounded text-base">bolt</span>
        </button>
      </div>
    </div>
  );
}
