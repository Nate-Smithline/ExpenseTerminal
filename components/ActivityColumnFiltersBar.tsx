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

type Props = {
  columnFilters: ActivityColumnFilterRow[];
  onColumnFiltersChange: (next: ActivityColumnFilterRow[]) => void;
  transactionProperties: TransactionPropertyDefinition[];
  /** When false, no filter UI (chips, + Filter, popovers) — toolbar filter icon is off. */
  filterToolbarActive?: boolean;
};

export function ActivityColumnFiltersBar({
  columnFilters,
  onColumnFiltersChange,
  transactionProperties,
  filterToolbarActive = false,
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

  const orgPickable = useMemo(
    () => transactionProperties.filter((p) => !isSystemTransactionPropertyType(p.type)),
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

  const popoverContent =
    addOpen && popoverPos ? (
      <div
        id="activity-column-filter-popover"
        className="fixed z-[70] rounded-lg border border-bg-tertiary/50 bg-white p-1 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.18)]"
        style={{ top: popoverPos.top, left: popoverPos.left, width: popoverPos.width, maxHeight: "min(60vh, 320px)" }}
      >
        <p className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-mono-light">Columns</p>
        <div className="max-h-52 overflow-y-auto">
          {ACTIVITY_FILTERABLE_STANDARD_COLUMNS.map((col) => (
            <button
              key={col}
              type="button"
              onClick={() => addFilterWithColumn(col)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-mono-dark hover:bg-bg-secondary/80"
            >
              {STANDARD_LABELS[col]}
            </button>
          ))}
          {orgPickable.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => addFilterWithColumn(p.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-mono-dark hover:bg-bg-secondary/80"
            >
              {p.name}
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
      />
    ) : null;

  if (!filterToolbarActive) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {columnFilters.map((f) => {
        const kind = kindForColumn(f.column, transactionProperties);
        const lbl = columnLabel(f.column, transactionProperties);
        const summary =
          !opNeedsValue(kind, f.op) && !opNeedsSecondValue(kind, f.op)
            ? `${lbl} ${opLabel(kind, f.op)}`
            : f.op === "between"
              ? `${lbl} ${opLabel(kind, f.op)} ${f.value || "…"} – ${f.value2 || "…"}`
              : `${lbl} ${opLabel(kind, f.op)} ${f.value ? `"${f.value.slice(0, 24)}${f.value.length > 24 ? "…" : ""}"` : "…"}`;
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
            className="inline-flex max-w-[220px] items-center gap-1 rounded-md border border-bg-tertiary/60 bg-bg-secondary/30 px-2 py-1 text-left text-xs text-mono-dark hover:bg-bg-secondary/60"
          >
            <span className="material-symbols-rounded shrink-0 text-[14px] text-mono-light">filter_alt</span>
            <span className="truncate">{summary}</span>
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
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-bg-tertiary/60 px-2 py-1 text-xs font-medium text-mono-medium hover:bg-bg-secondary/40"
      >
        <span className="material-symbols-rounded text-[14px]">add</span>
        Filter
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

  return (
    <div
      id="activity-column-filter-popover"
      className="fixed z-[70] rounded-lg border border-bg-tertiary/50 bg-white shadow-[0_8px_30px_-8px_rgba(0,0,0,0.18)]"
      style={{ top: position.top, left: position.left, width: position.width }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 border-b border-bg-tertiary/40 px-2 py-2">
        <span className="min-w-0 shrink truncate text-sm font-medium text-mono-dark">{label}</span>
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
  onUpdate,
}: {
  kind: ColumnFilterKind;
  column: string;
  filter: ActivityColumnFilterRow;
  options: { id: string; label: string }[];
  dataSources: DataSourceOpt[];
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
  if (column === "data_source_id") {
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
