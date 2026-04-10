"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type { TransactionPropertyDefinition } from "@/lib/transaction-property-definition";
import { ACTIVITY_VISIBLE_COLUMNS, type ActivityVisibleColumn } from "@/lib/validation/schemas";

const GAP_PX = 6;

const STANDARD_LABELS: Record<ActivityVisibleColumn, string> = {
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

const STANDARD_ICONS: Record<ActivityVisibleColumn, string> = {
  date: "calendar_today",
  vendor: "storefront",
  description: "notes",
  amount: "attach_money",
  transaction_type: "merge_type",
  status: "flag",
  category: "folder",
  schedule_c_line: "account_tree",
  source: "cloud",
  ai_confidence: "psychology",
  business_purpose: "work",
  quick_label: "bookmark",
  notes: "sticky_note_2",
  created_at: "schedule",
  data_source_id: "database",
};

function orgPropertyIcon(type: string): string {
  switch (type) {
    case "short_text":
      return "title";
    case "long_text":
      return "notes";
    case "number":
      return "numbers";
    case "select":
      return "arrow_drop_down_circle";
    case "multi_select":
      return "format_list_bulleted";
    case "date":
      return "calendar_today";
    case "checkbox":
      return "check_box";
    case "org_user":
      return "person";
    case "files":
      return "attach_file";
    case "phone":
      return "phone";
    case "email":
      return "alternate_email";
    case "created_time":
    case "created_by":
    case "last_edited_date":
    case "last_edited_time":
      return "schedule";
    case "account":
      return "database";
    default:
      return "label";
  }
}

function isStandardActivityColumn(key: string): key is ActivityVisibleColumn {
  return (ACTIVITY_VISIBLE_COLUMNS as readonly string[]).includes(key);
}

function buildInitialOrder(
  visibleColumns: string[],
  orgProps: TransactionPropertyDefinition[]
): string[] {
  const orgIds = [...orgProps].sort((a, b) => a.position - b.position).map((p) => p.id);
  const known = new Set<string>([...ACTIVITY_VISIBLE_COLUMNS, ...orgIds]);
  const orphans = visibleColumns.filter((k) => !known.has(k));
  const allKeys = [...ACTIVITY_VISIBLE_COLUMNS, ...orgIds, ...orphans];
  const vis = new Set(visibleColumns);
  const visibleOrdered = visibleColumns.filter((k) => allKeys.includes(k));
  const hidden = allKeys.filter((k) => !vis.has(k));
  return [...visibleOrdered, ...hidden];
}

const rowGlyphStyle = {
  fontSize: 18,
  lineHeight: 1,
  fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
} as const;

const panelGlyphMuted = {
  fontSize: 18,
  lineHeight: 1,
  fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
} as const;

/** Horizontal insertion guide while reordering (matches table column drop line) */
const PROPERTIES_DROP_LINE_CLASS =
  "pointer-events-none mx-2 h-[2px] shrink-0 rounded-full bg-sovereign-blue shadow-[0_0_6px_rgba(91,130,180,0.45)]";

type Props = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  visibleColumns: string[];
  onVisibleColumnsChange: (columns: string[]) => void;
  transactionProperties: TransactionPropertyDefinition[];
};

export function ActivityPropertyVisibilityPanel({
  open,
  anchorRef,
  onClose,
  visibleColumns,
  onVisibleColumnsChange,
  transactionProperties,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const [orderedKeys, setOrderedKeys] = useState<string[]>([]);
  const [visibleSet, setVisibleSet] = useState<Set<string>>(() => new Set());
  const orderedKeysRef = useRef<string[]>([]);
  const visibleSetRef = useRef<Set<string>>(new Set());
  const [dragKey, setDragKey] = useState<string | null>(null);
  /** Insertion index 0..length — line before row i, or after last when length */
  const [dropBeforeIndex, setDropBeforeIndex] = useState<number | null>(null);
  const dropBeforeIndexRef = useRef<number | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const right = Math.max(8, vw - rect.right);
    setPos({ top: rect.bottom + GAP_PX, right });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setOrderedKeys(buildInitialOrder(visibleColumns, transactionProperties));
      setVisibleSet(new Set(visibleColumns));
    }
    wasOpen.current = open;
  }, [open, visibleColumns, transactionProperties]);

  useEffect(() => {
    orderedKeysRef.current = orderedKeys;
  }, [orderedKeys]);

  useEffect(() => {
    visibleSetRef.current = visibleSet;
  }, [visibleSet]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open, onClose, anchorRef]);

  const labelFor = useCallback(
    (key: string) => {
      if (isStandardActivityColumn(key)) return STANDARD_LABELS[key];
      return transactionProperties.find((p) => p.id === key)?.name ?? "Property";
    },
    [transactionProperties]
  );

  const iconFor = useCallback(
    (key: string) => {
      if (isStandardActivityColumn(key)) return STANDARD_ICONS[key];
      const t = transactionProperties.find((p) => p.id === key)?.type ?? "";
      return orgPropertyIcon(t);
    },
    [transactionProperties]
  );

  const toggleVisible = useCallback(
    (key: string) => {
      const prev = visibleSetRef.current;
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size <= 1) return;
        next.delete(key);
      } else {
        next.add(key);
      }
      setVisibleSet(next);
      onVisibleColumnsChange(orderedKeysRef.current.filter((k) => next.has(k)));
    },
    [onVisibleColumnsChange]
  );

  const hideAll = useCallback(() => {
    const keep = "date";
    const nextVis = new Set([keep]);
    setVisibleSet(nextVis);
    const prev = orderedKeysRef.current;
    const rest = prev.filter((k) => k !== keep);
    const ord = [keep, ...rest];
    setOrderedKeys(ord);
    onVisibleColumnsChange(ord.filter((k) => nextVis.has(k)));
  }, [onVisibleColumnsChange]);

  const onDragStart = useCallback((e: React.DragEvent, key: string) => {
    setDragKey(key);
    setDropBeforeIndex(null);
    dropBeforeIndexRef.current = null;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", key);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const list = orderedKeysRef.current;
    const i = list.indexOf(key);
    if (i < 0) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    const insertAt = before ? i : i + 1;
    setDropBeforeIndex(insertAt);
    dropBeforeIndexRef.current = insertAt;
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const sourceKey = e.dataTransfer.getData("text/plain");
      const insertAt = dropBeforeIndexRef.current;
      setDragKey(null);
      setDropBeforeIndex(null);
      dropBeforeIndexRef.current = null;
      if (!sourceKey || insertAt == null) return;
      const prev = [...orderedKeysRef.current];
      const oldIdx = prev.indexOf(sourceKey);
      if (oldIdx === -1) return;
      const newIdx = insertAt > oldIdx ? insertAt - 1 : insertAt;
      prev.splice(oldIdx, 1);
      prev.splice(newIdx, 0, sourceKey);
      setOrderedKeys(prev);
      const vis = visibleSetRef.current;
      onVisibleColumnsChange(prev.filter((k) => vis.has(k)));
    },
    [onVisibleColumnsChange]
  );

  const onDragEnd = useCallback(() => {
    setDragKey(null);
    setDropBeforeIndex(null);
    dropBeforeIndexRef.current = null;
  }, []);

  if (!open || !mounted) return null;

  const panel = (
    <div
      ref={panelRef}
      className="fixed z-[200] flex max-h-[min(420px,calc(100dvh-24px))] w-[min(288px,calc(100vw-16px))] flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white/95 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] backdrop-blur-md"
      style={{ top: pos.top, right: pos.right }}
      role="dialog"
      aria-modal="false"
      aria-labelledby="activity-properties-panel-title"
      aria-describedby="activity-properties-panel-desc"
    >
      <div className="shrink-0 border-b border-black/[0.06] px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 pr-1">
            <p className="font-sans text-[11px] font-medium uppercase tracking-wider text-neutral-400">Columns</p>
            <h2
              id="activity-properties-panel-title"
              className="mt-1 font-sans text-[15px] font-semibold leading-tight tracking-tight text-neutral-900"
            >
              Properties
            </h2>
            <p
              id="activity-properties-panel-desc"
              className="mt-0.5 font-sans text-[12px] leading-snug text-neutral-500"
            >
              Show, hide, and reorder columns
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close"
          >
            <span className="material-symbols-rounded text-[18px] leading-none">close</span>
          </button>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-b border-black/[0.06] px-3 py-2">
        <span className="font-sans text-[11px] font-medium uppercase tracking-wider text-neutral-400">
          Shown in table
        </span>
        <button
          type="button"
          onClick={hideAll}
          className="rounded-lg px-2 py-1 font-sans text-[12px] font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          Hide all
        </button>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1"
        onDragLeave={(e) => {
          if (!dragKey) return;
          const related = e.relatedTarget as Node | null;
          if (related && e.currentTarget.contains(related)) return;
          setDropBeforeIndex(null);
          dropBeforeIndexRef.current = null;
        }}
      >
        {orderedKeys.map((key, idx) => {
          const visible = visibleSet.has(key);
          const showLineAbove = dragKey != null && dropBeforeIndex === idx;
          return (
            <Fragment key={key}>
              {showLineAbove ? <div className={PROPERTIES_DROP_LINE_CLASS} aria-hidden /> : null}
              <div
                onDragOver={(e) => onDragOver(e, key)}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-neutral-100/80 ${
                  dragKey === key ? "opacity-45" : ""
                }`}
              >
                <span
                  draggable
                  onDragStart={(e) => onDragStart(e, key)}
                  className="material-symbols-rounded shrink-0 cursor-grab text-neutral-400 active:cursor-grabbing"
                  style={panelGlyphMuted}
                  aria-hidden
                >
                  drag_indicator
                </span>
                <span
                  className="material-symbols-rounded shrink-0 text-neutral-500"
                  style={rowGlyphStyle}
                  aria-hidden
                >
                  {iconFor(key)}
                </span>
                <span className="min-w-0 flex-1 font-sans text-[13px] leading-snug text-neutral-800">
                  {labelFor(key)}
                </span>
                <button
                  type="button"
                  onClick={() => toggleVisible(key)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-700 transition hover:bg-neutral-200/60"
                  aria-label={visible ? `Hide ${labelFor(key)}` : `Show ${labelFor(key)}`}
                  aria-pressed={visible}
                >
                  <span
                    className={`material-symbols-rounded leading-none ${
                      visible ? "text-sovereign-blue" : "text-neutral-400"
                    }`}
                    style={{
                      fontSize: 18,
                      lineHeight: 1,
                      fontVariationSettings: visible
                        ? ("'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" as const)
                        : ("'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" as const),
                    }}
                  >
                    {visible ? "visibility" : "visibility_off"}
                  </span>
                </button>
              </div>
            </Fragment>
          );
        })}
        {dragKey != null && dropBeforeIndex === orderedKeys.length ? (
          <div className={PROPERTIES_DROP_LINE_CLASS} aria-hidden />
        ) : null}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
