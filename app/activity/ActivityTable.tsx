"use client";

import { useState, useCallback, useRef, useMemo, type CSSProperties } from "react";
import type { Database } from "@/lib/types/database";
import type { ActivityVisibleColumn } from "@/lib/validation/schemas";
import type { TransactionPropertyDefinition } from "@/lib/transaction-property-definition";
import { isSystemTransactionPropertyType } from "@/lib/transaction-property-types";
import { displayUSPhone } from "@/lib/format-us-phone";
import { isUuidColumnKey } from "@/lib/activity-visible-column-keys";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

function getTransactionCustomFields(t: Transaction): Record<string, unknown> {
  const cf = (t as { custom_fields?: unknown }).custom_fields;
  if (cf && typeof cf === "object" && !Array.isArray(cf)) return cf as Record<string, unknown>;
  return {};
}

function optionLabel(config: Record<string, unknown> | null, id: string): string {
  const opts = config?.options;
  if (!Array.isArray(opts)) return id;
  for (const o of opts) {
    if (o && typeof o === "object" && String((o as { id?: unknown }).id) === id) {
      return String((o as { label?: unknown }).label ?? id);
    }
  }
  return id;
}

function formatDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatAmount(amount: string, transactionType: string | null) {
  const n = Number(amount);
  const abs = Math.abs(n);
  const formatted = abs.toFixed(2);
  if (transactionType === "income") return `+$${formatted}`;
  return `-$${formatted}`;
}

function formatAiConfidence(val: number | null) {
  if (val == null) return "—";
  return `${Math.round(Number(val) * 100)}%`;
}

function sourceTagLabel(source: string | null): string {
  if (source === "data_feed") return "Direct Feed";
  if (source === "csv_upload") return "CSV";
  if (source === "manual") return "Manual";
  return source ?? "—";
}

function formatCustomPropertyCell(
  t: Transaction,
  col: string,
  def: TransactionPropertyDefinition | undefined,
  memberDisplayById: Record<string, string>,
  sanitizePublicCells: boolean
): React.ReactNode {
  if (def && isSystemTransactionPropertyType(def.type)) {
    switch (def.type) {
      case "created_time":
        return t.created_at
          ? new Date(t.created_at).toLocaleString(undefined, {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "—";
      case "created_by": {
        if (sanitizePublicCells) return "—";
        return memberDisplayById[t.user_id] || "—";
      }
      case "last_edited_date":
        return t.updated_at ? formatDate(t.updated_at) : "—";
      case "last_edited_time":
        return t.updated_at
          ? new Date(t.updated_at).toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            })
          : "—";
      default:
        return "—";
    }
  }

  const fields = getTransactionCustomFields(t);
  const raw = fields[col];

  if (!def) {
    if (raw === undefined || raw === null) return "—";
    if (typeof raw === "string") return raw.length > 80 ? `${raw.slice(0, 80)}…` : raw;
    if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
    if (Array.isArray(raw)) return `${raw.length} items`;
    return "—";
  }

  if (sanitizePublicCells && def.type === "org_user") {
    return "—";
  }

  switch (def.type) {
    case "select":
      if (raw == null || raw === "") return "—";
      return optionLabel(def.config, String(raw));
    case "multi_select": {
      if (!Array.isArray(raw) || raw.length === 0) return "—";
      return raw.map((id) => optionLabel(def.config, String(id))).join(", ");
    }
    case "date":
      if (raw == null || raw === "") return "—";
      return formatDate(String(raw));
    case "short_text":
    case "long_text":
    case "email":
      if (raw == null || raw === "") return "—";
      const s = String(raw);
      return s.length > 60 ? `${s.slice(0, 60)}…` : s;
    case "phone":
      if (raw == null || raw === "") return "—";
      return displayUSPhone(String(raw)) || "—";
    case "checkbox":
      return raw === true ? "Yes" : raw === false ? "No" : "—";
    case "number":
      if (raw === null || raw === undefined || raw === "") return "—";
      return typeof raw === "number" ? String(raw) : String(raw);
    case "org_user": {
      if (raw == null || raw === "") return "—";
      return memberDisplayById[String(raw)] || "—";
    }
    case "files": {
      if (!Array.isArray(raw) || raw.length === 0) return "—";
      const names = raw
        .map((f) => (f && typeof f === "object" && (f as { name?: string }).name) || "")
        .filter(Boolean);
      if (names.length === 0) return `${raw.length} file(s)`;
      const joined = names.slice(0, 2).join(", ");
      return names.length > 2 ? `${joined}…` : joined;
    }
    default:
      return "—";
  }
}

function cellValue(
  t: Transaction,
  col: string,
  defsById: Map<string, TransactionPropertyDefinition>,
  memberDisplayById: Record<string, string>,
  sanitizePublicCells: boolean
): React.ReactNode {
  if (isUuidColumnKey(col)) {
    return formatCustomPropertyCell(t, col, defsById.get(col), memberDisplayById, sanitizePublicCells);
  }
  switch (col) {
    case "date":
      return formatDate(t.date);
    case "vendor":
      return t.vendor || "—";
    case "source":
      return (
        <span className="inline-flex items-center rounded border border-bg-tertiary/60 px-1.5 py-0.5 text-[11px] text-mono-medium bg-white">
          {sourceTagLabel(t.source)}
        </span>
      );
    case "description":
      return t.description ? String(t.description).slice(0, 80) + (String(t.description).length > 80 ? "…" : "") : "—";
    case "amount":
      return formatAmount(t.amount, t.transaction_type);
    case "transaction_type":
      return t.transaction_type ?? "—";
    case "status":
      return t.status ?? "—";
    case "category":
      return t.category ?? "—";
    case "schedule_c_line":
      return t.schedule_c_line ?? "—";
    case "ai_confidence":
      return formatAiConfidence(t.ai_confidence);
    case "business_purpose":
      return t.business_purpose ? String(t.business_purpose).slice(0, 60) + (String(t.business_purpose).length > 60 ? "…" : "") : "—";
    case "quick_label":
      return t.quick_label ?? "—";
    case "notes":
      return t.notes ? String(t.notes).slice(0, 60) + (String(t.notes).length > 60 ? "…" : "") : "—";
    case "created_at":
      return formatDate(t.created_at);
    default:
      return "—";
  }
}

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

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  date: 130,
  vendor: 180,
  description: 200,
  amount: 110,
  transaction_type: 90,
  status: 100,
  category: 140,
  schedule_c_line: 130,
  source: 110,
  ai_confidence: 80,
  business_purpose: 180,
  quick_label: 130,
  notes: 180,
  created_at: 130,
};

interface ActivityTableProps {
  transactions: Transaction[];
  visibleColumns: string[];
  columnWidths: Record<string, number>;
  selectedId: string | null;
  onSelectRow: (tx: Transaction | null) => void;
  onColumnWidthChange: (col: string, width: number) => void;
  onColumnsReorder: (columns: string[]) => void;
  /** When true, the wrapper is full width of the parent; table always fills the wrapper (min 100% width). */
  expandToContainer?: boolean;
  transactionProperties?: TransactionPropertyDefinition[];
  memberDisplayById?: Record<string, string>;
  sanitizePublicCells?: boolean;
}

export function ActivityTable({
  transactions,
  visibleColumns,
  columnWidths,
  selectedId,
  onSelectRow,
  onColumnWidthChange,
  onColumnsReorder,
  expandToContainer = false,
  transactionProperties = [],
  memberDisplayById = {},
  sanitizePublicCells = false,
}: ActivityTableProps) {
  const defsById = useMemo(() => {
    const m = new Map<string, TransactionPropertyDefinition>();
    for (const p of transactionProperties) m.set(p.id, p);
    return m;
  }, [transactionProperties]);

  const cols = visibleColumns.length > 0 ? visibleColumns : ["date", "vendor", "amount", "status"];

  const getWidth = (col: string) =>
    columnWidths[col] ?? DEFAULT_COLUMN_WIDTHS[col] ?? 120;

  const [localWidths, setLocalWidths] = useState<Record<string, number>>({});
  const commitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleResize = useCallback(
    (col: string, width: number) => {
      setLocalWidths((prev) => ({ ...prev, [col]: width }));
      if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
      commitTimeoutRef.current = setTimeout(() => {
        onColumnWidthChange(col, width);
      }, 300);
    },
    [onColumnWidthChange]
  );

  const resolveWidth = (col: string) => localWidths[col] ?? getWidth(col);

  // Native HTML5 drag-and-drop: insertion index 0..cols.length (line before cols[at], or after last if at === length)
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [dropAtIndex, setDropAtIndex] = useState<number | null>(null);
  const dropAtIndexRef = useRef<number | null>(null);

  const onDragStart = useCallback((e: React.DragEvent, col: string) => {
    setDragCol(col);
    setDropAtIndex(null);
    dropAtIndexRef.current = null;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", col);
  }, []);

  const onDragOver = useCallback(
    (e: React.DragEvent, col: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const i = cols.indexOf(col);
      if (i === -1) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const before = e.clientX < rect.left + rect.width / 2;
      const at = before ? i : i + 1;
      setDropAtIndex(at);
      dropAtIndexRef.current = at;
    },
    [cols]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const sourceCol = e.dataTransfer.getData("text/plain");
      const at = dropAtIndexRef.current;
      setDragCol(null);
      setDropAtIndex(null);
      dropAtIndexRef.current = null;
      if (!sourceCol || at == null) return;
      const oldIdx = cols.indexOf(sourceCol);
      if (oldIdx === -1) return;
      const next = [...cols];
      next.splice(oldIdx, 1);
      let newIdx = at;
      if (oldIdx < at) newIdx -= 1;
      if (newIdx < 0) newIdx = 0;
      if (newIdx > next.length) newIdx = next.length;
      next.splice(newIdx, 0, sourceCol);
      onColumnsReorder(next);
    },
    [cols, onColumnsReorder]
  );

  const onDragEnd = useCallback(() => {
    setDragCol(null);
    setDropAtIndex(null);
    dropAtIndexRef.current = null;
  }, []);

  // Resize handle via pointer events (attached to a <span> to keep valid table HTML)
  const resizeRef = useRef<{ col: string; startX: number; startWidth: number } | null>(null);

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, col: string, currentWidth: number) => {
      e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      resizeRef.current = { col, startX: e.clientX, startWidth: currentWidth };

      const onMove = (ev: PointerEvent) => {
        if (!resizeRef.current) return;
        const delta = ev.clientX - resizeRef.current.startX;
        const newWidth = Math.max(40, Math.min(800, resizeRef.current.startWidth + delta));
        handleResize(resizeRef.current.col, newWidth);
      };

      const onUp = () => {
        resizeRef.current = null;
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
      };

      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
    },
    [handleResize]
  );

  const totalWidth = cols.reduce((sum, col) => sum + resolveWidth(col), 0);

  const colPercent = (col: string) => {
    const w = resolveWidth(col);
    if (totalWidth <= 0) return 100 / Math.max(cols.length, 1);
    return (w / totalWidth) * 100;
  };

  const tableStyle: CSSProperties = {
    width: "100%",
    tableLayout: "fixed",
    ...(totalWidth > 0 ? { minWidth: totalWidth } : {}),
  };

  return (
    <div
      className={`min-w-0 overflow-x-auto border border-bg-tertiary/40 bg-white ${
        expandToContainer ? "w-full" : "-mx-2 px-2 md:mx-0 md:px-0"
      }`}
    >
      <table className="w-full min-w-full border-collapse text-sm" style={tableStyle}>
        <colgroup>
          {cols.map((col) => (
            <col key={col} style={{ width: `${colPercent(col)}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-bg-tertiary/70 bg-white">
            {cols.map((key, i) => {
              const w = resolveWidth(key);
              const pct = colPercent(key);
              const isFirst = i === 0;
              const isLast = i === cols.length - 1;
              return (
                <th
                  key={key}
                  draggable
                  onDragStart={(e) => onDragStart(e, key)}
                  onDragOver={(e) => onDragOver(e, key)}
                  onDrop={onDrop}
                  onDragEnd={onDragEnd}
                  style={{ width: `${pct}%`, position: "relative" }}
                  className={`text-left py-2.5 px-2 md:px-3 text-xs font-medium uppercase tracking-wider text-mono-medium whitespace-nowrap select-none cursor-grab active:cursor-grabbing ${
                    dragCol != null
                      ? isFirst
                        ? "sticky left-0 z-30 bg-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]"
                        : "relative z-20 bg-white"
                      : isFirst
                        ? "sticky left-0 z-[1] bg-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]"
                        : "bg-white"
                  } ${dragCol === key ? "opacity-40" : ""}`}
                >
                  {dragCol != null && dropAtIndex === i && (
                    <span
                      className="pointer-events-none absolute left-0 top-0 z-[35] h-full w-[2px] -translate-x-1/2 rounded-full bg-sovereign-blue shadow-[0_0_6px_rgba(91,130,180,0.45)]"
                      aria-hidden
                    />
                  )}
                  {dragCol != null && dropAtIndex === cols.length && isLast && (
                    <span
                      className="pointer-events-none absolute right-0 top-0 z-[35] h-full w-[2px] translate-x-1/2 rounded-full bg-sovereign-blue shadow-[0_0_6px_rgba(91,130,180,0.45)]"
                      aria-hidden
                    />
                  )}
                  {COLUMN_LABELS[key as ActivityVisibleColumn] ?? defsById.get(key)?.name ?? key}
                  {!isLast && (
                    <span
                      className="absolute right-0 top-0 h-full w-[5px] cursor-col-resize hover:bg-sovereign-blue/30 active:bg-sovereign-blue/50 z-10 block"
                      onPointerDown={(e) => handleResizePointerDown(e, key, w)}
                      draggable={false}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr
              key={t.id}
              onClick={() => onSelectRow(selectedId === t.id ? null : t)}
              className={`group border-b border-bg-tertiary/40 hover:bg-bg-secondary/60 cursor-pointer transition-colors ${selectedId === t.id ? "bg-bg-secondary/50" : ""}`}
            >
              {cols.map((col, i) => (
                <td
                  key={col}
                  className={`py-2.5 px-2 md:px-3 text-mono-dark whitespace-nowrap overflow-hidden text-ellipsis ${
                    i === 0
                      ? "sticky left-0 bg-white z-[1] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] group-hover:bg-bg-secondary/60"
                      : ""
                  }`}
                  style={{ width: `${colPercent(col)}%`, minWidth: 0 }}
                >
                  {cellValue(t, col, defsById, memberDisplayById, sanitizePublicCells)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
