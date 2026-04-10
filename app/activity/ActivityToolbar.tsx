"use client";

import { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ACTIVITY_COLUMN_MATERIAL_ICONS as SORT_COLUMN_ICONS } from "@/lib/activity-column-icons";
import {
  ACTIVITY_SORT_COLUMNS,
  uuidSchema,
  type ActivityVisibleColumn,
  type ActivitySortColumn,
  type ActivitySortRule,
} from "@/lib/validation/schemas";
import type { TransactionPropertyDefinition } from "@/lib/transaction-property-definition";
import { ActivityColumnFiltersBar } from "@/components/ActivityColumnFiltersBar";
import { ActivityPropertyVisibilityPanel } from "@/components/ActivityPropertyVisibilityPanel";
import type { ActivityColumnFilterRow } from "@/lib/activity-column-filters";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  data_source_id: "Account",
};

export interface ActivityViewState {
  sort_column: string;
  sort_asc: boolean;
  sort_rules?: ActivitySortRule[];
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

/** Patches may send partial `filters`; parent merges into previous state. */
export type ActivityViewStatePatch = Omit<Partial<ActivityViewState>, "filters"> & {
  filters?: Partial<ActivityViewState["filters"]>;
};

interface ActivityToolbarProps {
  viewState: ActivityViewState;
  onViewStateChange: (patch: ActivityViewStatePatch) => void;
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
  /** Base name for CSV download (no extension). Saved pages: pass the page title. */
  exportFilenameBase?: string;
  /** Saved Pages only: enable Notion-style multi-column sort UI. */
  multiColumnSort?: boolean;
}

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
  ["description", true, "Description (A–Z)"],
  ["description", false, "Description (Z–A)"],
  ["schedule_c_line", true, "Schedule C (A–Z)"],
  ["source", true, "Source (A–Z)"],
  ["ai_confidence", false, "AI % (high first)"],
  ["ai_confidence", true, "AI % (low first)"],
  ["notes", true, "Notes (A–Z)"],
  ["updated_at", false, "Updated (newest)"],
  ["updated_at", true, "Updated (oldest)"],
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

const ICON_CLASS = "material-symbols-rounded text-[17px]";
const ICON_STYLE = { fontSize: "17px" };

/** Toolbar toggle background when filter / sort / properties is active */
const TOOLBAR_SELECTED_BG = "#edeeed";

const toolbarIconBtnBase =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors duration-150 ease-out hover:bg-black/[0.05] hover:text-neutral-800 active:scale-[0.97]";
const toolbarIconBtnSelected = "text-neutral-900 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]";

const EXTRA_SORT_LABELS: Partial<Record<ActivitySortColumn, string>> = {
  deduction_percent: "Deduction %",
  vendor_normalized: "Vendor key",
  data_source_id: "Account",
  updated_at: "Updated",
};

const glyphMuted = {
  fontSize: 18,
  lineHeight: 1,
  fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
} as const;

/** Matches ActivityTable column reorder: insertion line while dragging */
const SORT_DROP_BAR_LINE_CLASS =
  "pointer-events-none absolute top-1/2 z-20 h-8 w-[2px] -translate-y-1/2 rounded-full bg-sovereign-blue shadow-[0_0_6px_rgba(91,130,180,0.45)]";

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
  exportFilenameBase,
  multiColumnSort = false,
}: ActivityToolbarProps) {
  const makeKey = useCallback(() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }, []);
  const [searchInput, setSearchInput] = useState(viewState.filters.search);
  const [filtersToolbarActive, setFiltersToolbarActive] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  /** Search field is shown only after the toolbar search icon is pressed. */
  const [searchBarOpen, setSearchBarOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportToast, setExportToast] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const propertiesAnchorRef = useRef<HTMLButtonElement>(null);
  const [sortKeys, setSortKeys] = useState<string[]>([]);
  /** Insertion index 0..sortKeys.length — show bar before that pill (length = after last). */
  const [sortDropBeforeIndex, setSortDropBeforeIndex] = useState<number | null>(null);
  const sortDragPointerRef = useRef({ x: 0, y: 0 });
  const sortDragMoveCleanupRef = useRef<(() => void) | null>(null);
  /** Saved pages: toolbar sort icon shows / hides the sort box row. */
  const [multiSortBarVisible, setMultiSortBarVisible] = useState(false);
  /** Saved pages: index of rule whose edit popover is open, or null. */
  const [sortEditIndex, setSortEditIndex] = useState<number | null>(null);
  const sortBoxAnchorsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const sortEditPopoverRef = useRef<HTMLDivElement>(null);
  const [sortEditPopoverMounted, setSortEditPopoverMounted] = useState(false);
  const [sortEditPopoverPos, setSortEditPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    setSearchInput(viewState.filters.search);
  }, [viewState.filters.search]);

  useEffect(() => {
    const t = setTimeout(() => {
      onViewStateChange({
        filters: { search: searchInput.trim() },
      });
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, onViewStateChange]);

  useEffect(() => {
    if (searchBarOpen) {
      const id = window.setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [searchBarOpen]);

  useEffect(() => {
    if (!searchBarOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSearchBarOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchBarOpen]);

  const sortedOrgProperties = [...transactionProperties].sort((a, b) => a.position - b.position);

  const csvDownloadBasename = useMemo(() => {
    const fromPage = exportFilenameBase?.trim();
    if (fromPage) return fromPage;
    if (titleEditable && titleValue?.trim()) return titleValue.trim();
    const t = title.trim();
    return t || "Activity";
  }, [exportFilenameBase, titleEditable, titleValue, title]);

  const buildExportRequestBody = useCallback(() => {
    const colsForExport =
      viewState.visible_columns.length > 0
        ? viewState.visible_columns
        : (["date", "vendor", "amount", "status"] as const);
    const sortRules = Array.isArray(viewState.sort_rules) ? viewState.sort_rules : [];
    return {
      date_from: viewState.filters.date_from,
      date_to: viewState.filters.date_to,
      sort_by: viewState.sort_column,
      sort_order: viewState.sort_asc ? "asc" : "desc",
      ...(sortRules.length > 0 ? { sort_rules: sortRules } : {}),
      export_columns: [...colsForExport],
      download_basename: csvDownloadBasename,
      ...(viewState.filters.status ? { status: viewState.filters.status } : {}),
      ...(viewState.filters.transaction_type ? { transaction_type: viewState.filters.transaction_type } : {}),
      ...(viewState.filters.source ? { source: viewState.filters.source } : {}),
      ...(viewState.filters.data_source_id ? { data_source_id: viewState.filters.data_source_id } : {}),
      ...(viewState.filters.search.trim() ? { search: viewState.filters.search.trim() } : {}),
      column_filters: viewState.filters.column_filters ?? [],
    };
  }, [viewState, csvDownloadBasename]);

  const sortColumnLabel = useCallback((col: string): string => {
    const builtIn = (COLUMN_LABELS as Record<string, string>)[col];
    if (builtIn) return builtIn;
    const extra = EXTRA_SORT_LABELS[col as ActivitySortColumn];
    if (extra) return extra;
    const p = sortedOrgProperties.find((x) => x.id === col);
    return p?.name?.trim() || col;
  }, [sortedOrgProperties]);

  const sortRules = useMemo<ActivitySortRule[]>(() => {
    if (Array.isArray(viewState.sort_rules) && viewState.sort_rules.length > 0) return viewState.sort_rules;
    return [{ column: viewState.sort_column as ActivitySortColumn, asc: viewState.sort_asc }];
  }, [viewState.sort_rules, viewState.sort_column, viewState.sort_asc]);

  useEffect(() => {
    // Ensure we always have stable keys for dnd rows in multi-sort mode.
    if (!multiColumnSort) return;
    if (sortKeys.length === sortRules.length) return;
    setSortKeys(sortRules.map(() => makeKey()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiColumnSort, sortRules.length, makeKey]);

  useEffect(() => {
    if (multiColumnSort && !multiSortBarVisible) setSortEditIndex(null);
  }, [multiColumnSort, multiSortBarVisible]);

  useEffect(() => {
    setSortEditPopoverMounted(true);
  }, []);

  const updateSortEditPopoverPosition = useCallback(() => {
    if (sortEditIndex == null || !multiColumnSort) return;
    const key = sortKeys[sortEditIndex];
    if (!key) return;
    const anchor = sortBoxAnchorsRef.current[key];
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const panelW = 288;
    let left = rect.left;
    if (left + panelW > vw - 8) left = vw - 8 - panelW;
    if (left < 8) left = 8;
    setSortEditPopoverPos({ top: rect.bottom + 8, left });
  }, [sortEditIndex, sortKeys, multiColumnSort]);

  useLayoutEffect(() => {
    if (sortEditIndex == null || !multiColumnSort) return;
    updateSortEditPopoverPosition();
  }, [sortEditIndex, multiColumnSort, updateSortEditPopoverPosition, sortKeys, sortRules.length]);

  useEffect(() => {
    if (sortEditIndex == null || !multiColumnSort) return;
    const onScrollOrResize = () => updateSortEditPopoverPosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [sortEditIndex, multiColumnSort, updateSortEditPopoverPosition]);

  useEffect(() => {
    if (sortEditIndex == null || !multiColumnSort) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSortEditIndex(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sortEditIndex, multiColumnSort]);

  useEffect(() => {
    if (sortEditIndex == null || !multiColumnSort) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (sortEditPopoverRef.current?.contains(t)) return;
      const el = t instanceof Element ? t : (t as ChildNode).parentElement;
      if (!el) {
        setSortEditIndex(null);
        return;
      }
      const box = el.closest("[data-sort-rule-box]");
      if (box) {
        const raw = box.getAttribute("data-sort-index");
        const i = raw != null ? parseInt(raw, 10) : NaN;
        if (!Number.isNaN(i)) {
          setSortEditIndex(i);
          return;
        }
      }
      setSortEditIndex(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [sortEditIndex, multiColumnSort]);

  useEffect(() => {
    if (sortEditIndex != null && sortEditIndex >= sortRules.length) {
      setSortEditIndex(sortRules.length > 0 ? sortRules.length - 1 : null);
    }
  }, [sortEditIndex, sortRules.length]);

  const setSortRulesNext = useCallback(
    (next: ActivitySortRule[]) => {
      const primary = next[0] ?? { column: "date" as ActivitySortColumn, asc: false };
      onViewStateChange({
        sort_rules: next,
        sort_column: primary.column,
        sort_asc: primary.asc,
      });
    },
    [onViewStateChange]
  );

  const addSortRule = useCallback(() => {
    const used = new Set(sortRules.map((r) => r.column));
    const nextCol = ACTIVITY_SORT_COLUMNS.find((c) => !used.has(c)) ?? "date";
    const nextRules = [...sortRules, { column: nextCol, asc: true }];
    setSortKeys((prev) => [...prev, makeKey()]);
    setSortRulesNext(nextRules);
  }, [sortRules, setSortRulesNext, makeKey]);

  const clearSortRules = useCallback(() => {
    setSortKeys([makeKey()]);
    setSortRulesNext([{ column: "date", asc: false }]);
  }, [setSortRulesNext, makeKey]);

  const removeSortRuleAt = useCallback(
    (idx: number) => {
      if (sortRules.length <= 1) return clearSortRules();
      const next = sortRules.filter((_, i) => i !== idx);
      setSortKeys((prev) => prev.filter((_, i) => i !== idx));
      setSortRulesNext(next);
    },
    [sortRules, setSortRulesNext, clearSortRules]
  );

  const removeSortRuleAtWithEditor = useCallback(
    (idx: number) => {
      setSortEditIndex((cur) => {
        if (cur === idx) return null;
        if (cur != null && cur > idx) return cur - 1;
        return cur;
      });
      removeSortRuleAt(idx);
    },
    [removeSortRuleAt]
  );

  const updateSortRuleAt = useCallback(
    (idx: number, patch: Partial<ActivitySortRule>) => {
      const next = sortRules.map((r, i) => (i === idx ? { ...r, ...patch } : r));
      setSortRulesNext(next);
    },
    [sortRules, setSortRulesNext]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const endSortRuleDragUi = useCallback(() => {
    sortDragMoveCleanupRef.current?.();
    sortDragMoveCleanupRef.current = null;
    setSortDropBeforeIndex(null);
  }, []);

  const onSortRuleDragStart = useCallback((event: DragStartEvent) => {
    const ae = event.activatorEvent;
    if (ae && "clientX" in ae && typeof (ae as PointerEvent).clientX === "number") {
      const pe = ae as PointerEvent;
      sortDragPointerRef.current = { x: pe.clientX, y: pe.clientY };
    }
    const move = (ev: PointerEvent) => {
      sortDragPointerRef.current = { x: ev.clientX, y: ev.clientY };
    };
    window.addEventListener("pointermove", move);
    sortDragMoveCleanupRef.current = () => window.removeEventListener("pointermove", move);
  }, []);

  const onSortRuleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event;
      if (!over) {
        setSortDropBeforeIndex(null);
        return;
      }
      const overIdx = sortKeys.indexOf(String(over.id));
      if (overIdx < 0) {
        setSortDropBeforeIndex(null);
        return;
      }
      const { x } = sortDragPointerRef.current;
      const mid = over.rect.left + over.rect.width / 2;
      const insertAt = x < mid ? overIdx : overIdx + 1;
      setSortDropBeforeIndex(insertAt);
    },
    [sortKeys]
  );

  const onSortRuleDragEnd = useCallback(
    (e: DragEndEvent) => {
      endSortRuleDragUi();
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const oldIndex = sortKeys.indexOf(String(active.id));
      const newIndex = sortKeys.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      setSortKeys((prev) => arrayMove(prev, oldIndex, newIndex));
      setSortRulesNext(arrayMove(sortRules, oldIndex, newIndex));
    },
    [endSortRuleDragUi, sortKeys, sortRules, setSortRulesNext]
  );

  const downloadCsvExport = useCallback(async () => {
    setExporting(true);
    setExportToast(null);
    try {
      const res = await fetch("/api/transactions/export", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildExportRequestBody()),
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
      const fallbackName = `${csvDownloadBasename}.csv`;
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
  }, [buildExportRequestBody, csvDownloadBasename]);

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

      {/* Toolbar: flat row; search field appears only after the search icon is pressed */}
      <div className={`flex flex-wrap items-center gap-1.5 py-1 ${tableAlignClass}`}>
        {/* Filter — toggles column filter bar “+ Filter” */}
        <button
          type="button"
          onClick={() => {
            setSortEditIndex(null);
            if (filtersToolbarActive) {
              setFiltersToolbarActive(false);
            } else {
              setSearchBarOpen(false);
              setMultiSortBarVisible(false);
              setPropertiesOpen(false);
              setSortOpen(false);
              setFiltersToolbarActive(true);
            }
          }}
          title={filtersToolbarActive ? "Hide column filters" : "Column filters"}
          className={`${toolbarIconBtnBase} ${filtersToolbarActive ? toolbarIconBtnSelected : ""}`}
          style={filtersToolbarActive ? { backgroundColor: TOOLBAR_SELECTED_BG } : undefined}
          aria-label={filtersToolbarActive ? "Column filters active" : "Column filters"}
          aria-pressed={filtersToolbarActive}
        >
          <span className={ICON_CLASS} style={ICON_STYLE}>filter_list</span>
        </button>

        {/* Sort — Activity: modal; saved pages: toggles sort box row below */}
        <button
          type="button"
          onClick={() => {
            setSortEditIndex(null);
            if (multiColumnSort) {
              if (multiSortBarVisible) {
                setMultiSortBarVisible(false);
              } else {
                setSearchBarOpen(false);
                setFiltersToolbarActive(false);
                setPropertiesOpen(false);
                setSortOpen(false);
                setMultiSortBarVisible(true);
              }
              return;
            }
            setSearchBarOpen(false);
            setFiltersToolbarActive(false);
            setPropertiesOpen(false);
            setSortOpen(true);
          }}
          title={multiColumnSort ? (multiSortBarVisible ? "Hide sort" : "Show sort") : "Sort by column"}
          className={`${toolbarIconBtnBase} ${
            (multiColumnSort && multiSortBarVisible) || (!multiColumnSort && sortOpen) ? toolbarIconBtnSelected : ""
          }`}
          style={
            (multiColumnSort && multiSortBarVisible) || (!multiColumnSort && sortOpen)
              ? { backgroundColor: TOOLBAR_SELECTED_BG }
              : undefined
          }
          aria-label={multiColumnSort ? "Toggle sort row" : "Sort by column"}
          aria-pressed={multiColumnSort ? multiSortBarVisible : sortOpen}
        >
          <span className={ICON_CLASS} style={ICON_STYLE}>swap_vert</span>
        </button>

        {/* Properties (columns) — eye icon */}
        <button
          ref={propertiesAnchorRef}
          type="button"
          onClick={() => {
            setSortEditIndex(null);
            if (propertiesOpen) {
              setPropertiesOpen(false);
            } else {
              setSearchBarOpen(false);
              setFiltersToolbarActive(false);
              setMultiSortBarVisible(false);
              setSortOpen(false);
              setPropertiesOpen(true);
            }
          }}
          title={propertiesOpen ? "Close column properties" : "Show or hide columns"}
          className={`${toolbarIconBtnBase} ${propertiesOpen ? toolbarIconBtnSelected : ""}`}
          style={propertiesOpen ? { backgroundColor: TOOLBAR_SELECTED_BG } : undefined}
          aria-label="Show or hide columns"
          aria-pressed={propertiesOpen}
        >
          <span className={ICON_CLASS} style={ICON_STYLE}>visibility</span>
        </button>

        {/* Search — icon toggles field; Esc or icon again closes; no trailing ×, no focus ring */}
        <button
          type="button"
          onClick={() => {
            setSortEditIndex(null);
            if (searchBarOpen) {
              setSearchBarOpen(false);
            } else {
              setSearchBarOpen(true);
              setSortOpen(false);
              setPropertiesOpen(false);
            }
          }}
          title={searchBarOpen ? "Close search" : "Search"}
          className={`${toolbarIconBtnBase} ${
            searchBarOpen || viewState.filters.search.trim() ? toolbarIconBtnSelected : ""
          }`}
          style={
            searchBarOpen || viewState.filters.search.trim()
              ? { backgroundColor: TOOLBAR_SELECTED_BG }
              : undefined
          }
          aria-label={searchBarOpen ? "Close search" : "Open search"}
          aria-expanded={searchBarOpen}
          aria-pressed={searchBarOpen || Boolean(viewState.filters.search.trim())}
        >
          <span className={ICON_CLASS} style={ICON_STYLE}>
            search
          </span>
        </button>
        {searchBarOpen ? (
          <div className="flex w-44 max-w-[calc(100vw-12rem)] shrink-0 items-center sm:w-52 sm:max-w-none">
            <div className="w-full rounded-full bg-neutral-100/95 py-1 pl-3 pr-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
              <input
                ref={searchInputRef}
                id="activity-search-input"
                type="text"
                inputMode="search"
                autoComplete="off"
                enterKeyHint="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search…"
                className="activity-toolbar-search-input w-full border-0 bg-transparent py-1.5 font-sans text-[13px] text-neutral-900 placeholder:text-neutral-400"
                aria-label="Search transactions"
              />
            </div>
          </div>
        ) : null}

        <div className="min-w-3 flex-1" aria-hidden />

        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <div className="flex items-center gap-0.5">
            {/*
              Temporarily removed:
              Re-analyze (AI) toolbar button
            */}
            {/*
            <button
              type="button"
              onClick={onReanalyzeAll}
              disabled={reanalyzing}
              title="AI: Re-analyze uncategorized"
              className={`${toolbarIconBtnBase} disabled:opacity-40 disabled:pointer-events-none disabled:hover:bg-transparent`}
              aria-label="AI: Re-analyze uncategorized"
            >
              <span className={ICON_CLASS} style={ICON_STYLE}>bolt</span>
            </button>
            */}

            {/* Export — CSV only */}
            <button
              type="button"
              onClick={() => void downloadCsvExport()}
              disabled={exporting}
              title="Download CSV"
              className={`${toolbarIconBtnBase} disabled:opacity-40 disabled:pointer-events-none disabled:hover:bg-transparent`}
              aria-label="Download CSV"
            >
              <span className={ICON_CLASS} style={ICON_STYLE}>download</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onNewTransaction}
            title="New (n)"
            className="inline-flex shrink-0 items-center rounded-full bg-[#007aff] px-3 py-1.5 font-sans text-[12px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-all duration-150 ease-out hover:bg-[#0066d6] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff]/35 focus-visible:ring-offset-2"
          >
            New
          </button>
        </div>
      </div>

      <ActivityColumnFiltersBar
        columnFilters={viewState.filters.column_filters ?? []}
        onColumnFiltersChange={(column_filters) => onViewStateChange({ filters: { column_filters } })}
        transactionProperties={transactionProperties}
        filterToolbarActive={filtersToolbarActive}
        chrome={multiColumnSort ? "apple" : "default"}
        rowClassName={multiColumnSort ? tableAlignClass : undefined}
      />

      {/* Saved pages: inline sort boxes (toolbar icon toggles visibility) */}
      {multiColumnSort && multiSortBarVisible ? (
        <div className={`flex flex-wrap items-center gap-2 py-1 ${tableAlignClass}`}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onSortRuleDragStart}
            onDragOver={onSortRuleDragOver}
            onDragEnd={onSortRuleDragEnd}
            onDragCancel={endSortRuleDragUi}
          >
            <SortableContext items={sortKeys} strategy={horizontalListSortingStrategy}>
              {sortRules.map((r, idx) => {
                const kid = sortKeys[idx] ?? `${idx}`;
                const n = sortKeys.length;
                return (
                  <SortableSortBox
                    key={kid}
                    id={kid}
                    index={idx}
                    rule={r}
                    columnLabel={sortColumnLabel}
                    isEditing={sortEditIndex === idx}
                    onOpenEdit={() => setSortEditIndex(idx)}
                    onRemove={() => removeSortRuleAtWithEditor(idx)}
                    canRemove={sortRules.length > 1}
                    registerAnchor={(el) => {
                      sortBoxAnchorsRef.current[kid] = el;
                    }}
                    dropBarLeft={sortDropBeforeIndex === idx}
                    dropBarRight={sortDropBeforeIndex === n && idx === n - 1}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
          <button
            type="button"
            onClick={() => {
              const nextIdx = sortRules.length;
              addSortRule();
              setSortEditIndex(nextIdx);
            }}
            disabled={sortRules.length >= 5}
            title={sortRules.length >= 5 ? "At most 5 sorts" : "Add sort"}
            className="inline-flex h-10 min-w-[2.75rem] items-center justify-center rounded-2xl border border-dashed border-neutral-300/90 bg-white/60 px-3 text-neutral-400 transition hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-600 disabled:pointer-events-none disabled:opacity-40"
            aria-label="Add sort"
          >
            <span className="material-symbols-rounded text-[22px]" style={glyphMuted}>
              add
            </span>
          </button>
        </div>
      ) : null}

      {multiColumnSort &&
        multiSortBarVisible &&
        sortEditIndex != null &&
        sortEditPopoverMounted &&
        sortRules[sortEditIndex] != null &&
        createPortal(
          <div
            ref={sortEditPopoverRef}
            role="dialog"
            aria-modal="false"
            aria-label="Edit sort"
            className="fixed z-[200] w-72 overflow-hidden rounded-2xl border border-black/[0.08] bg-white/95 p-3 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] backdrop-blur-md"
            style={{ top: sortEditPopoverPos.top, left: sortEditPopoverPos.left }}
          >
            <div className="mb-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">Column</p>
              <div
                className="mt-1.5 max-h-52 overflow-y-auto rounded-xl border border-black/[0.08] bg-neutral-50/50 p-1"
                role="listbox"
                aria-label="Sort column"
              >
                {ACTIVITY_SORT_COLUMNS.map((c) => {
                  const selected = sortRules[sortEditIndex].column === c;
                  const icon = SORT_COLUMN_ICONS[c];
                  return (
                    <button
                      key={c}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => updateSortRuleAt(sortEditIndex, { column: c })}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-sans text-[13px] transition ${
                        selected ? "bg-white font-medium text-neutral-900 shadow-sm ring-1 ring-black/[0.06]" : "text-neutral-700 hover:bg-white/80"
                      }`}
                    >
                      <span className="material-symbols-rounded shrink-0 text-[18px] text-neutral-500" style={glyphMuted}>
                        {icon}
                      </span>
                      <span className="min-w-0 truncate">{sortColumnLabel(c)}</span>
                    </button>
                  );
                })}
                {sortedOrgProperties
                  .filter((p) => p.type === "account")
                  .map((p) => {
                    const selected = sortRules[sortEditIndex].column === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => updateSortRuleAt(sortEditIndex, { column: p.id })}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-sans text-[13px] transition ${
                          selected
                            ? "bg-white font-medium text-neutral-900 shadow-sm ring-1 ring-black/[0.06]"
                            : "text-neutral-700 hover:bg-white/80"
                        }`}
                      >
                        <span className="material-symbols-rounded shrink-0 text-[18px] text-neutral-500" style={glyphMuted}>
                          database
                        </span>
                        <span className="min-w-0 truncate">{p.name}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
            <div className="mb-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">Direction</p>
              <div className="mt-1.5 flex gap-1 rounded-xl bg-neutral-100/90 p-1">
                <button
                  type="button"
                  onClick={() => updateSortRuleAt(sortEditIndex, { asc: true })}
                  className={`flex-1 rounded-lg py-2 text-center font-sans text-[13px] font-medium transition ${
                    sortRules[sortEditIndex].asc
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  Ascending
                </button>
                <button
                  type="button"
                  onClick={() => updateSortRuleAt(sortEditIndex, { asc: false })}
                  className={`flex-1 rounded-lg py-2 text-center font-sans text-[13px] font-medium transition ${
                    !sortRules[sortEditIndex].asc
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  Descending
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeSortRuleAtWithEditor(sortEditIndex)}
              disabled={sortRules.length <= 1}
              className="w-full rounded-xl py-2.5 font-sans text-[13px] font-medium text-red-600/90 transition hover:bg-red-50 disabled:pointer-events-none disabled:opacity-35"
            >
              Remove sort
            </button>
          </div>,
          document.body
        )}

      {!multiColumnSort ? (
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
      ) : null}

      <ActivityPropertyVisibilityPanel
        open={propertiesOpen}
        anchorRef={propertiesAnchorRef}
        onClose={() => setPropertiesOpen(false)}
        visibleColumns={viewState.visible_columns}
        onVisibleColumnsChange={(visible_columns) => onViewStateChange({ visible_columns })}
        transactionProperties={transactionProperties}
      />

      {exporting && (
        <div
          className="fixed inset-0 z-[60] flex min-h-[100dvh] items-center justify-center bg-black/20 backdrop-blur-md"
          role="alert"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="mx-4 flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-black/[0.08] bg-white/95 px-8 py-10 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] backdrop-blur-md">
            <span className="material-symbols-rounded animate-spin text-[40px] text-neutral-400" style={glyphMuted}>
              progress_activity
            </span>
            <div className="text-center">
              <h2 className="font-sans text-[17px] font-semibold tracking-tight text-neutral-900">Preparing download</h2>
              <p className="mt-2 font-sans text-[13px] leading-snug text-neutral-500">
                Building your CSV with the current filters. Large exports may take a minute.
              </p>
            </div>
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

function SortableSortBox({
  id,
  index,
  rule,
  columnLabel,
  isEditing,
  onOpenEdit,
  onRemove,
  canRemove,
  registerAnchor,
  dropBarLeft,
  dropBarRight,
}: {
  id: string;
  index: number;
  rule: ActivitySortRule;
  columnLabel: (col: string) => string;
  isEditing: boolean;
  onOpenEdit: () => void;
  onRemove: () => void;
  canRemove: boolean;
  registerAnchor: (el: HTMLDivElement | null) => void;
  dropBarLeft?: boolean;
  dropBarRight?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const col = rule.column;
  const icon =
    SORT_COLUMN_ICONS[col as ActivitySortColumn] ?? (uuidSchema.safeParse(col).success ? "database" : "sort");

  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      setNodeRef(el);
      registerAnchor(el);
    },
    [setNodeRef, registerAnchor]
  );

  return (
    <div
      ref={setRefs}
      data-sort-rule-box=""
      data-sort-index={index}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={`relative inline-flex h-10 shrink-0 items-stretch overflow-visible rounded-2xl border border-black/[0.08] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04] transition hover:shadow-[0_2px_12px_rgba(0,0,0,0.07)] ${
        isEditing ? "ring-2 ring-neutral-400/55 shadow-md" : ""
      }`}
    >
      {dropBarLeft ? (
        <span className={`${SORT_DROP_BAR_LINE_CLASS} left-0 -translate-x-1/2`} aria-hidden />
      ) : null}
      {dropBarRight ? (
        <span className={`${SORT_DROP_BAR_LINE_CLASS} right-0 translate-x-1/2`} aria-hidden />
      ) : null}
      <button
        type="button"
        className="flex w-8 shrink-0 items-center justify-center text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600"
        aria-label="Reorder sort"
        {...attributes}
        {...listeners}
      >
        <span className="material-symbols-rounded text-[18px]" style={glyphMuted}>
          drag_indicator
        </span>
      </button>
      <button
        type="button"
        onClick={() => onOpenEdit()}
        className="flex min-w-0 max-w-[200px] items-center gap-2 px-1.5 text-left font-sans text-[13px] tracking-tight text-neutral-800"
      >
        <span className="material-symbols-rounded shrink-0 text-[18px] text-neutral-500" style={glyphMuted}>
          {icon}
        </span>
        <span className="truncate font-medium">{columnLabel(col)}</span>
        <span className="material-symbols-rounded shrink-0 text-[18px] text-neutral-400" style={glyphMuted}>
          {rule.asc ? "arrow_upward" : "arrow_downward"}
        </span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        disabled={!canRemove}
        className="flex w-7 shrink-0 items-center justify-center rounded-none text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 disabled:pointer-events-none disabled:opacity-35"
        aria-label="Remove sort"
        title={canRemove ? "Remove" : "At least one sort is required"}
      >
        <span className="material-symbols-rounded text-[14px] leading-none">close</span>
      </button>
    </div>
  );
}
