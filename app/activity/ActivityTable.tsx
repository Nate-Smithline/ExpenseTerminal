"use client";

import { useState, useCallback, useRef, useMemo, useEffect, type CSSProperties, type ReactNode } from "react";
import type { Database } from "@/lib/types/database";
import type { ActivityVisibleColumn } from "@/lib/validation/schemas";
import type { TransactionPropertyDefinition } from "@/lib/transaction-property-definition";
import { isSystemTransactionPropertyType } from "@/lib/transaction-property-types";
import { displayUSPhone } from "@/lib/format-us-phone";
import { isUuidColumnKey } from "@/lib/activity-visible-column-keys";
import { ACTIVITY_COLUMN_MATERIAL_ICONS } from "@/lib/activity-column-icons";
import { transactionPropertyTypeIcon } from "@/lib/transaction-detail-property-icons";
import type { ActivitySortColumn } from "@/lib/validation/schemas";
import { brandColorHex } from "@/lib/brand-palette";

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
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

export type DataSourceCellInfo = { name: string; brandColorId?: string | null };

function rgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatCustomPropertyCell(
  t: Transaction,
  col: string,
  def: TransactionPropertyDefinition | undefined,
  memberDisplayById: Record<string, string>,
  sanitizePublicCells: boolean,
  dataSourceById: Record<string, DataSourceCellInfo> | undefined
): ReactNode {
  if (def?.type === "account") {
    const id = t.data_source_id;
    if (!id) return "—";
    const info = dataSourceById?.[id];
    const name = info?.name?.trim() || "—";
    const hex = info?.brandColorId != null ? brandColorHex(info.brandColorId) : brandColorHex("blue");
    return (
      <span
        className="inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 font-sans text-[12px] font-medium"
        style={{ backgroundColor: rgba(hex, 0.14), color: hex }}
        title={name}
      >
        {name}
      </span>
    );
  }

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
  sanitizePublicCells: boolean,
  dataSourceById: Record<string, DataSourceCellInfo> | undefined
): ReactNode {
  if (isUuidColumnKey(col)) {
    return formatCustomPropertyCell(t, col, defsById.get(col), memberDisplayById, sanitizePublicCells, dataSourceById);
  }
  switch (col) {
    case "date":
      return formatDate(t.date);
    case "vendor":
      return t.vendor || "—";
    case "source":
      return (
        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 font-sans text-[11px] font-medium text-neutral-600 ring-1 ring-black/[0.04]">
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
    case "data_source_id": {
      const id = t.data_source_id;
      if (!id) return "—";
      const info = dataSourceById?.[id];
      const name = info?.name?.trim() || "—";
      const hex = info?.brandColorId != null ? brandColorHex(info.brandColorId) : brandColorHex("blue");
      return (
        <span
          className="inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 font-sans text-[12px] font-medium"
          style={{ backgroundColor: rgba(hex, 0.14), color: hex }}
          title={name}
        >
          {name}
        </span>
      );
    }
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
  data_source_id: "Account",
};

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  date: 120,
  vendor: 168,
  description: 200,
  amount: 108,
  transaction_type: 88,
  status: 96,
  category: 140,
  schedule_c_line: 124,
  source: 108,
  ai_confidence: 84,
  business_purpose: 168,
  quick_label: 132,
  notes: 180,
  created_at: 124,
  data_source_id: 160,
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
  /** Toggle org checkbox properties from the table (Notion-style). */
  onPatchCustomField?: (transactionId: string, propertyId: string, value: boolean) => void | Promise<void>;
  /** Resolve account id → label + brand color for Account column / account property. */
  dataSourceById?: Record<string, DataSourceCellInfo>;
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
  onPatchCustomField,
  dataSourceById,
}: ActivityTableProps) {
  const defsById = useMemo(() => {
    const m = new Map<string, TransactionPropertyDefinition>();
    for (const p of transactionProperties) m.set(p.id, p);
    return m;
  }, [transactionProperties]);

  const cols = visibleColumns.length > 0 ? visibleColumns : ["date", "vendor", "amount", "status"];

  // Optimistic UI for checkbox custom fields (so toggles feel instant even while the patch is in-flight).
  const [optimisticCheckbox, setOptimisticCheckbox] = useState<Record<string, boolean>>({});
  const optimisticSeqRef = useRef<Record<string, number>>({});
  const txById = useMemo(() => new Map(transactions.map((t) => [t.id, t])), [transactions]);

  useEffect(() => {
    // Drop optimistic values once the server state matches them (keeps the map small / avoids stale overrides).
    setOptimisticCheckbox((prev) => {
      const keys = Object.keys(prev);
      if (keys.length === 0) return prev;
      let next: Record<string, boolean> | null = null;
      for (const k of keys) {
        const [txId, propId] = k.split(":");
        const tx = txId ? txById.get(txId) : null;
        if (!tx || !propId) continue;
        const raw = getTransactionCustomFields(tx)[propId];
        const checked = raw === true;
        if (checked === prev[k]) {
          if (!next) next = { ...prev };
          delete next[k];
        }
      }
      return next ?? prev;
    });
  }, [txById]);

  const getWidth = (col: string) =>
    columnWidths[col] ?? DEFAULT_COLUMN_WIDTHS[col] ?? 112;

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
        const newWidth = Math.max(48, Math.min(640, resizeRef.current.startWidth + delta));
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

  function columnHeaderIcon(col: string): string {
    if (isUuidColumnKey(col)) {
      const def = defsById.get(col);
      return def ? transactionPropertyTypeIcon(def.type) : "tune";
    }
    return ACTIVITY_COLUMN_MATERIAL_ICONS[col as ActivitySortColumn] ?? "view_column";
  }

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

  const headerStickyCell =
    "sticky z-30 bg-[#f5f5f7] shadow-[3px_0_14px_-6px_rgba(0,0,0,0.08)]";
  const bodyStickyShadow = "shadow-[3px_0_14px_-6px_rgba(0,0,0,0.06)]";

  function renderBodyCell(t: Transaction, col: string): ReactNode {
    if (
      isUuidColumnKey(col) &&
      onPatchCustomField &&
      !sanitizePublicCells &&
      defsById.get(col)?.type === "checkbox"
    ) {
      const def = defsById.get(col)!;
      const key = `${t.id}:${col}`;
      const raw = getTransactionCustomFields(t)[col];
      const checked = (key in optimisticCheckbox ? optimisticCheckbox[key] : raw === true) === true;
      return (
        <input
          type="checkbox"
          className="activity-table-checkbox h-3.5 w-3.5 cursor-pointer rounded border-neutral-300 focus:outline-none focus:ring-0"
          checked={checked}
          aria-label={def.name?.trim() || "Checkbox"}
          onChange={(e) => {
            e.stopPropagation();
            const nextVal = e.target.checked;
            setOptimisticCheckbox((prev) => ({ ...prev, [key]: nextVal }));
            optimisticSeqRef.current[key] = (optimisticSeqRef.current[key] ?? 0) + 1;
            const seq = optimisticSeqRef.current[key];
            (async () => {
              try {
                await onPatchCustomField(t.id, col, nextVal);
              } catch {
                // If the latest attempt failed, revert back to server value.
                if (optimisticSeqRef.current[key] === seq) {
                  setOptimisticCheckbox((prev) => {
                    if (!(key in prev)) return prev;
                    const n = { ...prev };
                    delete n[key];
                    return n;
                  });
                }
              }
            })();
          }}
          onClick={(e) => e.stopPropagation()}
        />
      );
    }
    return cellValue(t, col, defsById, memberDisplayById, sanitizePublicCells, dataSourceById);
  }

  return (
    <div
      className={`min-w-0 overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04] ${
        expandToContainer ? "w-full" : "-mx-2 px-2 md:mx-0 md:px-0"
      }`}
    >
      <div className="overflow-x-auto bg-white">
        <table
          className="w-full min-w-full border-collapse font-sans text-[13px] leading-snug text-neutral-800 antialiased"
          style={tableStyle}
        >
          <colgroup>
            {cols.map((col) => (
              <col key={col} style={{ width: `${colPercent(col)}%` }} />
            ))}
          </colgroup>
          <thead className="bg-[#f5f5f7]">
            <tr className="border-b border-black/[0.08] bg-[#f5f5f7] shadow-[inset_0_0_0_9999px_rgb(245,245,247)]">
              {cols.map((key, i) => {
                const w = resolveWidth(key);
                const pct = colPercent(key);
                const isLast = i === cols.length - 1;
                const headerBg =
                  dragCol != null
                    ? "relative z-20 bg-[#f5f5f7]"
                    : "bg-[#f5f5f7]";
                return (
                  <th
                    key={key}
                    draggable
                    onDragStart={(e) => onDragStart(e, key)}
                    onDragOver={(e) => onDragOver(e, key)}
                    onDrop={onDrop}
                    onDragEnd={onDragEnd}
                    style={{ width: `${pct}%`, position: "relative" }}
                    className={`align-middle text-left px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500 whitespace-nowrap select-none cursor-grab active:cursor-grabbing transition-colors ${headerBg} ${
                      dragCol === key ? "opacity-40" : ""
                    }`}
                  >
                    {dragCol != null && dropAtIndex === i && (
                      <span
                        className="pointer-events-none absolute left-0 top-0 z-[35] h-full w-[2px] -translate-x-1/2 rounded-full bg-[#007aff] shadow-[0_0_8px_rgba(0,122,255,0.45)]"
                        aria-hidden
                      />
                    )}
                    {dragCol != null && dropAtIndex === cols.length && isLast && (
                      <span
                        className="pointer-events-none absolute right-0 top-0 z-[35] h-full w-[2px] translate-x-1/2 rounded-full bg-[#007aff] shadow-[0_0_8px_rgba(0,122,255,0.45)]"
                        aria-hidden
                      />
                    )}
                    <span className="flex w-full min-w-0 items-center gap-2">
                      <span
                        className="inline-flex h-3 w-3 shrink-0 items-center justify-center text-neutral-400"
                        aria-hidden
                      >
                        <span
                          className="material-symbols-rounded origin-center leading-none [font-size:10px]"
                          style={{
                            fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 12",
                            transform: "scale(0.65)",
                          }}
                        >
                          {columnHeaderIcon(key)}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1 truncate leading-tight">
                        {COLUMN_LABELS[key as ActivityVisibleColumn] ?? defsById.get(key)?.name ?? key}
                      </span>
                    </span>
                    {!isLast && (
                      <span
                        className="absolute right-0 top-0 z-10 h-full w-2 cursor-col-resize hover:bg-[#007aff]/20 active:bg-[#007aff]/35"
                        title="Drag to resize column"
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
          <tbody className="bg-white tabular-nums">
            {transactions.map((t) => {
              const isSel = selectedId === t.id;
              return (
                <tr
                  key={t.id}
                  onClick={() => onSelectRow(isSel ? null : t)}
                  className="group cursor-pointer border-b border-black/[0.05] transition-colors duration-150 ease-out"
                >
                  {cols.map((col, i) => {
                    const cellBg = isSel
                      ? "bg-[#007aff]/[0.09] group-hover:bg-[#007aff]/[0.12]"
                      : "bg-white group-hover:bg-neutral-50/90";
                    const checkboxCell =
                      isUuidColumnKey(col) &&
                      onPatchCustomField &&
                      !sanitizePublicCells &&
                      defsById.get(col)?.type === "checkbox";
                    return (
                      <td
                        key={col}
                        className={`px-3 py-2.5 text-neutral-800 whitespace-nowrap overflow-hidden text-ellipsis ${cellBg} ${checkboxCell ? "text-center" : ""}`}
                        style={{ width: `${colPercent(col)}%`, minWidth: 0 }}
                        onClick={checkboxCell ? (e) => e.stopPropagation() : undefined}
                      >
                        {renderBodyCell(t, col)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
