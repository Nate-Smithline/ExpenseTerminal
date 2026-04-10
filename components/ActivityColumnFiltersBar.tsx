"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { TransactionPropertyDefinition } from "@/lib/transaction-property-definition";
import { isSystemTransactionPropertyType } from "@/lib/transaction-property-types";
import type { ActivityColumnFilterRow } from "@/lib/activity-column-filters";
import {
  defaultOpForKind,
  isStandardFilterableColumn,
  opLabel,
  opNeedsSecondValue,
  opNeedsValue,
  opsForKind,
  orgPropertyFilterKind,
  standardColumnFilterKind,
  type ColumnFilterKind,
} from "@/lib/activity-column-filters";
import type { ActivityFilterableStandardColumn } from "@/lib/validation/schemas";
import { ACTIVITY_FILTERABLE_STANDARD_COLUMNS } from "@/lib/validation/schemas";

const FILTER_STANDARD_ICONS: Record<ActivityFilterableStandardColumn, string> = {
  date: "calendar_today",
  vendor: "storefront",
  description: "subject",
  amount: "attach_money",
  transaction_type: "merge_type",
  status: "flag",
  category: "folder",
  schedule_c_line: "receipt_long",
  source: "cloud",
  ai_confidence: "percent",
  business_purpose: "work",
  quick_label: "label",
  notes: "sticky_note_2",
  deduction_percent: "percent",
  vendor_normalized: "fingerprint",
  data_source_id: "database",
  created_at: "schedule",
};

const GLYPH_MUTED = {
  fontSize: 18,
  lineHeight: 1,
  fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
} as const;

const STANDARD_LABELS: Record<ActivityFilterableStandardColumn, string> = {
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
  deduction_percent: "Deduction %",
  vendor_normalized: "Vendor key",
  data_source_id: "Account",
  created_at: "Created",
};

const STATUS_VALUES = [
  { v: "pending", l: "Pending" },
  { v: "completed", l: "Completed" },
  { v: "auto_sorted", l: "Auto-sorted" },
  { v: "personal", l: "Personal" },
];

const TYPE_VALUES = [
  { v: "expense", l: "Expense" },
  { v: "income", l: "Income" },
];

const SOURCE_VALUES = [
  { v: "data_feed", l: "Direct Feed" },
  { v: "csv_upload", l: "CSV" },
  { v: "manual", l: "Manual" },
];

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `f-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function kindForColumn(column: string, defs: TransactionPropertyDefinition[]): ColumnFilterKind {
  if (isStandardFilterableColumn(column)) return standardColumnFilterKind(column);
  const d = defs.find((p) => p.id === column);
  if (!d) return "text";
  return orgPropertyFilterKind(d.type);
}

function columnLabel(column: string, properties: TransactionPropertyDefinition[]): string {
  if (isStandardFilterableColumn(column)) return STANDARD_LABELS[column];
  return properties.find((p) => p.id === column)?.name ?? "Property";
}

type DataSourceOpt = { id: string; name: string };

type FilterChrome = "default" | "apple";

type Props = {
  columnFilters: ActivityColumnFilterRow[];
  onColumnFiltersChange: (next: ActivityColumnFilterRow[]) => void;
  transactionProperties: TransactionPropertyDefinition[];
  /** When false, no filter UI (chips, + Filter, popovers) — toolbar filter icon is off. */
  filterToolbarActive?: boolean;
  /** Saved pages: match multi-sort pill styling. */
  chrome?: FilterChrome;
  /** Horizontal alignment with table (e.g. ActivityToolbar `tableAlignClass`). */
  rowClassName?: string;
};

function filterChipIcon(column: string, properties: TransactionPropertyDefinition[]): string {
  if (isStandardFilterableColumn(column)) return FILTER_STANDARD_ICONS[column];
  const d = properties.find((p) => p.id === column);
  if (d?.type === "account") return "database";
  if (d?.type === "checkbox") return "check_box";
  return "tune";
}

export function ActivityColumnFiltersBar({
  columnFilters,
  onColumnFiltersChange,
  transactionProperties,
  filterToolbarActive = false,
  chrome = "default",
  rowClassName,
}: Props) {
  const [openFilterId, setOpenFilterId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [dataSources, setDataSources] = useState<DataSourceOpt[]>([]);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const addBtnRef = useRef<HTMLButtonElement | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const defsById = useMemo(() => {
    const m = new Map<string, TransactionPropertyDefinition>();
    for (const p of transactionProperties) m.set(p.id, p);
    return m;
  }, [transactionProperties]);

  const dataSourceNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const d of dataSources) {
      if (!d?.id) continue;
      m[d.id] = d.name;
    }
    return m;
  }, [dataSources]);

  const orgPickable = useMemo(
    () =>
      transactionProperties.filter(
        (p) => p.type === "account" || !isSystemTransactionPropertyType(p.type)
      ),
    [transactionProperties]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/data-sources?limit=200");
        if (!res.ok || cancelled) return;
        const j = await res.json();
        const rows = Array.isArray(j.data) ? j.data : [];
        const opts: DataSourceOpt[] = rows.map((r: { id?: string; name?: string; institution?: string }) => ({
          id: String(r.id ?? ""),
          name: String(r.name ?? r.institution ?? r.id ?? "").trim() || String(r.id ?? ""),
        }));
        if (!cancelled) setDataSources(opts.filter((o) => o.id));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!filterToolbarActive) {
      setAddOpen(false);
      setOpenFilterId(null);
      setMenuOpenId(null);
    }
  }, [filterToolbarActive]);

  const updateFilter = useCallback(
    (id: string, patch: Partial<ActivityColumnFilterRow>) => {
      onColumnFiltersChange(columnFilters.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    },
    [columnFilters, onColumnFiltersChange]
  );

  const removeFilter = useCallback(
    (id: string) => {
      onColumnFiltersChange(columnFilters.filter((f) => f.id !== id));
      setOpenFilterId(null);
      setMenuOpenId(null);
    },
    [columnFilters, onColumnFiltersChange]
  );

  const addFilterWithColumn = useCallback(
    (column: string) => {
      const kind = kindForColumn(column, transactionProperties);
      const op = defaultOpForKind(kind);
      const id = newId();
      onColumnFiltersChange([...columnFilters, { id, column, op, value: "", value2: "" }]);
      setAddOpen(false);
      queueMicrotask(() => setOpenFilterId(id));
    },
    [columnFilters, onColumnFiltersChange, transactionProperties]
  );

  useLayoutEffect(() => {
    if (!filterToolbarActive) {
      setPopoverPos(null);
      return;
    }
    if (addOpen && addBtnRef.current) {
      const r = addBtnRef.current.getBoundingClientRect();
      const width = 280;
      let left = r.left;
      if (left + width > window.innerWidth - 8) left = window.innerWidth - 8 - width;
      if (left < 8) left = 8;
      setPopoverPos({ top: r.bottom + 6, left, width });
      return;
    }
    if (openFilterId && chipRefs.current[openFilterId]) {
      const r = chipRefs.current[openFilterId]!.getBoundingClientRect();
      const width = 280;
      let left = r.left;
      if (left + width > window.innerWidth - 8) left = window.innerWidth - 8 - width;
      if (left < 8) left = 8;
      setPopoverPos({ top: r.bottom + 6, left, width });
      return;
    }
    setPopoverPos(null);
  }, [filterToolbarActive, openFilterId, addOpen, columnFilters]);

  useEffect(() => {
    if (!filterToolbarActive) return;
    if (!openFilterId && !addOpen) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      const pop = document.getElementById("activity-column-filter-popover");
      if (pop?.contains(t)) return;
      if (openFilterId && chipRefs.current[openFilterId]?.contains(t)) return;
      if (addBtnRef.current?.contains(t)) return;
      setOpenFilterId(null);
      setAddOpen(false);
      setMenuOpenId(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [filterToolbarActive, openFilterId, addOpen]);

  const activeFilter = openFilterId ? columnFilters.find((f) => f.id === openFilterId) : null;

  const addPopoverClass =
    chrome === "apple"
      ? "fixed z-[70] overflow-hidden rounded-2xl border border-black/[0.08] bg-white/95 p-1 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] backdrop-blur-md"
      : "fixed z-[70] rounded-lg border border-bg-tertiary/50 bg-white p-1 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.18)]";
  const addSectionTitleClass =
    chrome === "apple"
      ? "px-2.5 py-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400"
      : "px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-mono-light";
  const addRowClass =
    chrome === "apple"
      ? "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-sans text-[13px] text-neutral-800 hover:bg-neutral-100/80"
      : "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-mono-dark hover:bg-bg-secondary/80";

  const popoverContent =
    addOpen && popoverPos ? (
      <div
        id="activity-column-filter-popover"
        className={addPopoverClass}
        style={{ top: popoverPos.top, left: popoverPos.left, width: popoverPos.width, maxHeight: "min(60vh, 320px)" }}
      >
        <p className={addSectionTitleClass}>Columns</p>
        <div className="max-h-52 overflow-y-auto px-0.5 pb-1">
          {ACTIVITY_FILTERABLE_STANDARD_COLUMNS.map((col) => (
            <button
              key={col}
              type="button"
              onClick={() => addFilterWithColumn(col)}
              className={addRowClass}
            >
              <span
                className={`material-symbols-rounded shrink-0 text-[18px] ${chrome === "apple" ? "text-neutral-500" : "text-mono-light"}`}
                style={chrome === "apple" ? GLYPH_MUTED : undefined}
              >
                {FILTER_STANDARD_ICONS[col]}
              </span>
              <span className="min-w-0 truncate">{STANDARD_LABELS[col]}</span>
            </button>
          ))}
          {orgPickable.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => addFilterWithColumn(p.id)}
              className={addRowClass}
            >
              <span
                className={`material-symbols-rounded shrink-0 text-[18px] ${chrome === "apple" ? "text-neutral-500" : "text-mono-light"}`}
                style={chrome === "apple" ? GLYPH_MUTED : undefined}
              >
                tune
              </span>
              <span className="min-w-0 truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </div>
    ) : activeFilter && popoverPos ? (
      <FilterEditorPopover
        key={activeFilter.id}
        filter={activeFilter}
        columnLabelText={columnLabel(activeFilter.column, transactionProperties)}
        position={popoverPos}
        defsById={defsById}
        dataSources={dataSources}
        onUpdate={(patch) => updateFilter(activeFilter.id, patch)}
        onRemove={() => removeFilter(activeFilter.id)}
        menuOpen={menuOpenId === activeFilter.id}
        onMenuOpenChange={(o) => setMenuOpenId(o ? activeFilter.id : null)}
        chrome={chrome}
      />
    ) : null;

  if (!filterToolbarActive) {
    return null;
  }

  const rowGap = chrome === "apple" ? "gap-2" : "gap-1.5";

  return (
    <div className={`flex flex-wrap items-center ${rowGap} ${rowClassName ?? ""}`}>
      {columnFilters.map((f) => {
        const kind = kindForColumn(f.column, transactionProperties);
        const lbl = columnLabel(f.column, transactionProperties);
        const isAccountFilter =
          f.column === "data_source_id" || defsById.get(f.column)?.type === "account";

        const prettyValue = (raw: string | undefined) => {
          if (!raw) return "";
          if (!isAccountFilter) return raw;
          return dataSourceNameById[raw] ?? raw;
        };
        const summary =
          !opNeedsValue(kind, f.op) && !opNeedsSecondValue(kind, f.op)
            ? `${lbl} ${opLabel(kind, f.op)}`
            : f.op === "between"
              ? `${lbl} ${opLabel(kind, f.op)} ${prettyValue(f.value) || "…"} – ${prettyValue(f.value2 ?? "") || "…"}`
              : `${lbl} ${opLabel(kind, f.op)} ${
                  f.value
                    ? `"${prettyValue(f.value ?? "").slice(0, 24)}${(prettyValue(f.value ?? "").length > 24 ? "…" : "")}"`
                    : "…"
                }`;
        const chipIcon = filterChipIcon(f.column, transactionProperties);
        const chipClass =
          chrome === "apple"
            ? "inline-flex h-10 max-w-[280px] items-center gap-2 rounded-2xl border border-black/[0.08] bg-white px-3 text-left font-sans text-[13px] tracking-tight text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04] transition hover:shadow-[0_2px_12px_rgba(0,0,0,0.07)]"
            : "inline-flex max-w-[220px] items-center gap-1 rounded-md border border-bg-tertiary/60 bg-bg-secondary/30 px-2 py-1 text-left text-xs text-mono-dark hover:bg-bg-secondary/60";
        const chipGlyphClass =
          chrome === "apple" ? "material-symbols-rounded shrink-0 text-[18px] text-neutral-500" : "material-symbols-rounded shrink-0 text-[14px] text-mono-light";
        const chipGlyphStyle = chrome === "apple" ? GLYPH_MUTED : undefined;
        return (
          <button
            key={f.id}
            ref={(el) => {
              chipRefs.current[f.id] = el;
            }}
            type="button"
            onClick={() => {
              setOpenFilterId(f.id);
              setAddOpen(false);
            }}
            className={chipClass}
          >
            <span className={chipGlyphClass} style={chipGlyphStyle}>
              {chipIcon}
            </span>
            <span className="min-w-0 truncate font-medium">{summary}</span>
          </button>
        );
      })}
      <button
        ref={addBtnRef}
        type="button"
        onClick={() => {
          setAddOpen((v) => !v);
          setOpenFilterId(null);
        }}
        aria-label={chrome === "apple" ? "Add filter" : undefined}
        className={
          chrome === "apple"
            ? "inline-flex h-10 min-w-[2.75rem] items-center justify-center gap-1.5 rounded-2xl border border-dashed border-neutral-300/90 bg-white/60 px-3 font-sans text-[13px] font-medium text-neutral-500 transition hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-600"
            : "inline-flex items-center gap-1 rounded-md border border-dashed border-bg-tertiary/60 px-2 py-1 text-xs font-medium text-mono-medium hover:bg-bg-secondary/40"
        }
      >
        <span className="material-symbols-rounded text-[22px] text-neutral-400" style={chrome === "apple" ? GLYPH_MUTED : undefined}>
          add
        </span>
        {chrome === "apple" ? null : <span>Filter</span>}
      </button>
      {typeof document !== "undefined" && popoverContent ? createPortal(popoverContent, document.body) : null}
    </div>
  );
}

function FilterEditorPopover({
  filter,
  columnLabelText,
  position,
  defsById,
  dataSources,
  onUpdate,
  onRemove,
  menuOpen,
  onMenuOpenChange,
  chrome,
}: {
  filter: ActivityColumnFilterRow;
  columnLabelText: string;
  position: { top: number; left: number; width: number };
  defsById: Map<string, TransactionPropertyDefinition>;
  dataSources: DataSourceOpt[];
  onUpdate: (patch: Partial<ActivityColumnFilterRow>) => void;
  onRemove: () => void;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  chrome: FilterChrome;
}) {
  const column = filter.column;
  const kind = isStandardFilterableColumn(column)
    ? standardColumnFilterKind(column)
    : orgPropertyFilterKind(defsById.get(column)?.type ?? "short_text");

  const def = defsById.get(column);
  const ops = opsForKind(kind);
  const label = columnLabelText;

  const options = useMemo(() => {
    const c = def?.config && typeof def.config === "object" ? (def.config as { options?: unknown }).options : null;
    if (!Array.isArray(c)) return [] as { id: string; label: string }[];
    return c
      .map((o) =>
        o && typeof o === "object" && typeof (o as { id?: unknown }).id === "string"
          ? { id: (o as { id: string }).id, label: String((o as { label?: unknown }).label ?? (o as { id: string }).id) }
          : null
      )
      .filter(Boolean) as { id: string; label: string }[];
  }, [def]);

  const shellClass =
    chrome === "apple"
      ? "fixed z-[70] overflow-hidden rounded-2xl border border-black/[0.08] bg-white/95 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] backdrop-blur-md"
      : "fixed z-[70] rounded-lg border border-bg-tertiary/50 bg-white shadow-[0_8px_30px_-8px_rgba(0,0,0,0.18)]";
  const headerBorder = chrome === "apple" ? "border-b border-black/[0.06]" : "border-b border-bg-tertiary/40";

  return (
    <div
      id="activity-column-filter-popover"
      className={shellClass}
      style={{ top: position.top, left: position.left, width: position.width }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className={`flex items-center gap-1 px-2 py-2 ${headerBorder}`}>
        <span
          className={`min-w-0 shrink truncate font-medium ${chrome === "apple" ? "font-sans text-[13px] text-neutral-900" : "text-sm text-mono-dark"}`}
        >
          {label}
        </span>
        <select
          value={filter.op}
          onChange={(e) => onUpdate({ op: e.target.value })}
          className="max-w-[140px] shrink-0 cursor-pointer border-0 bg-transparent text-sm text-mono-medium underline decoration-bg-tertiary/60 underline-offset-2 focus:outline-none focus:ring-0"
          aria-label="Filter operator"
        >
          {ops.map((op) => (
            <option key={op} value={op}>
              {opLabel(kind, op)}
            </option>
          ))}
        </select>
        <div className="relative ml-auto shrink-0">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-mono-light hover:bg-bg-secondary/80 hover:text-mono-dark"
            aria-label="Filter actions"
            onClick={() => onMenuOpenChange(!menuOpen)}
          >
            <span className="material-symbols-rounded text-[18px]">more_horiz</span>
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-full z-10 mt-0.5 min-w-[140px] rounded-md border border-bg-tertiary/50 bg-white py-1 shadow-md">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-bg-secondary/60"
                onClick={() => {
                  onMenuOpenChange(false);
                  onRemove();
                }}
              >
                <span className="material-symbols-rounded text-[16px]">delete</span>
                Delete filter
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="p-2">
        {opNeedsValue(kind, filter.op) || opNeedsSecondValue(kind, filter.op) ? (
          <ValueInputs
            kind={kind}
            column={column}
            filter={filter}
            options={options}
            dataSources={dataSources}
            def={def}
            onUpdate={onUpdate}
          />
        ) : (
          <p className="text-xs text-mono-light">No value needed for this condition.</p>
        )}
      </div>
    </div>
  );
}

function ValueInputs({
  kind,
  column,
  filter,
  options,
  dataSources,
  def,
  onUpdate,
}: {
  kind: ColumnFilterKind;
  column: string;
  filter: ActivityColumnFilterRow;
  options: { id: string; label: string }[];
  dataSources: DataSourceOpt[];
  def?: TransactionPropertyDefinition;
  onUpdate: (patch: Partial<ActivityColumnFilterRow>) => void;
}) {
  const needs2 = opNeedsSecondValue(kind, filter.op);

  if (column === "status") {
    return (
      <select
        value={filter.value ?? ""}
        onChange={(e) => onUpdate({ value: e.target.value })}
        className="w-full rounded-md border border-[#F0F1F7] bg-white px-2 py-2 text-sm text-mono-dark focus:border-mono-medium/25 focus:outline-none"
      >
        <option value="">Choose…</option>
        {STATUS_VALUES.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    );
  }
  if (column === "transaction_type") {
    return (
      <select
        value={filter.value ?? ""}
        onChange={(e) => onUpdate({ value: e.target.value })}
        className="w-full rounded-md border border-[#F0F1F7] bg-white px-2 py-2 text-sm text-mono-dark focus:border-mono-medium/25 focus:outline-none"
      >
        <option value="">Choose…</option>
        {TYPE_VALUES.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    );
  }
  if (column === "source") {
    return (
      <select
        value={filter.value ?? ""}
        onChange={(e) => onUpdate({ value: e.target.value })}
        className="w-full rounded-md border border-[#F0F1F7] bg-white px-2 py-2 text-sm text-mono-dark focus:border-mono-medium/25 focus:outline-none"
      >
        <option value="">Choose…</option>
        {SOURCE_VALUES.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    );
  }
  if (column === "data_source_id" || def?.type === "account") {
    return (
      <select
        value={filter.value ?? ""}
        onChange={(e) => onUpdate({ value: e.target.value })}
        className="w-full rounded-md border border-[#F0F1F7] bg-white px-2 py-2 text-sm text-mono-dark focus:border-mono-medium/25 focus:outline-none"
      >
        <option value="">Choose account…</option>
        {dataSources.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    );
  }

  if (kind === "enum" && options.length > 0) {
    return (
      <select
        value={filter.value ?? ""}
        onChange={(e) => onUpdate({ value: e.target.value })}
        className="w-full rounded-md border border-[#F0F1F7] bg-white px-2 py-2 text-sm text-mono-dark focus:border-mono-medium/25 focus:outline-none"
      >
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (kind === "multi" && options.length > 0 && filter.op === "contains") {
    return (
      <select
        value={filter.value ?? ""}
        onChange={(e) => onUpdate({ value: e.target.value })}
        className="w-full rounded-md border border-[#F0F1F7] bg-white px-2 py-2 text-sm text-mono-dark focus:border-mono-medium/25 focus:outline-none"
      >
        <option value="">Choose option…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (kind === "date") {
    return (
      <div className="space-y-2">
        <input
          type="date"
          value={filter.value ?? ""}
          onChange={(e) => onUpdate({ value: e.target.value })}
          className="w-full rounded-md border border-[#F0F1F7] bg-white px-2 py-2 text-sm text-mono-dark focus:border-mono-medium/25 focus:outline-none"
        />
        {needs2 ? (
          <input
            type="date"
            value={filter.value2 ?? ""}
            onChange={(e) => onUpdate({ value2: e.target.value })}
            className="w-full rounded-md border border-[#F0F1F7] bg-white px-2 py-2 text-sm text-mono-dark focus:border-mono-medium/25 focus:outline-none"
          />
        ) : null}
      </div>
    );
  }

  if (kind === "number") {
    return (
      <input
        type="number"
        step="any"
        value={filter.value ?? ""}
        onChange={(e) => onUpdate({ value: e.target.value })}
        placeholder="Type a value…"
        className="w-full rounded-md border border-[#F0F1F7] bg-white px-2 py-2 text-sm text-mono-dark placeholder:text-mono-light focus:border-mono-medium/25 focus:outline-none"
      />
    );
  }

  return (
    <input
      type="text"
      value={filter.value ?? ""}
      onChange={(e) => onUpdate({ value: e.target.value })}
      placeholder="Type a value…"
      className="w-full rounded-md border border-[#F0F1F7] bg-white px-2 py-2 text-sm text-mono-dark placeholder:text-mono-light focus:border-mono-medium/25 focus:outline-none"
    />
  );
}
