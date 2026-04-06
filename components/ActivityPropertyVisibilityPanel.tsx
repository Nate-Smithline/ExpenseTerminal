"use client";

import {
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
  fontSize: 15,
  lineHeight: 1,
  fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
} as const;

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
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
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
      setVisibleSet((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          if (next.size <= 1) return prev;
          next.delete(key);
        } else {
          next.add(key);
        }
        setOrderedKeys((ord) => {
          onVisibleColumnsChange(ord.filter((k) => next.has(k)));
          return ord;
        });
        return next;
      });
    },
    [onVisibleColumnsChange]
  );

  const hideAll = useCallback(() => {
    const keep = "date";
    const nextVis = new Set([keep]);
    setVisibleSet(nextVis);
    setOrderedKeys((prev) => {
      const rest = prev.filter((k) => k !== keep);
      const ord = [keep, ...rest];
      onVisibleColumnsChange(ord.filter((k) => nextVis.has(k)));
      return ord;
    });
  }, [onVisibleColumnsChange]);

  const onDragStart = useCallback((e: React.DragEvent, key: string) => {
    setDragKey(key);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", key);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(key);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent, targetKey: string) => {
      e.preventDefault();
      const sourceKey = e.dataTransfer.getData("text/plain");
      setDragKey(null);
      setDropTarget(null);
      if (!sourceKey || sourceKey === targetKey) return;
      setOrderedKeys((prev) => {
        const oldIdx = prev.indexOf(sourceKey);
        const newIdx = prev.indexOf(targetKey);
        if (oldIdx === -1 || newIdx === -1) return prev;
        const nextOrder = [...prev];
        nextOrder.splice(oldIdx, 1);
        nextOrder.splice(newIdx, 0, sourceKey);
        setVisibleSet((vis) => {
          onVisibleColumnsChange(nextOrder.filter((k) => vis.has(k)));
          return vis;
        });
        return nextOrder;
      });
    },
    [onVisibleColumnsChange]
  );

  const onDragEnd = useCallback(() => {
    setDragKey(null);
    setDropTarget(null);
  }, []);

  if (!open || !mounted) return null;

  const panel = (
    <div
      ref={panelRef}
      className="fixed z-[200] flex max-h-[min(420px,calc(100dvh-24px))] w-[min(300px,calc(100vw-16px))] flex-col overflow-hidden rounded-none border border-bg-tertiary/60 bg-white shadow-lg"
      style={{ top: pos.top, right: pos.right }}
      role="dialog"
      aria-modal="false"
      aria-labelledby="activity-properties-panel-title"
      aria-describedby="activity-properties-panel-desc"
    >
      <div className="shrink-0 border-b border-bg-tertiary/40 px-2.5 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 pr-1">
            <h2
              id="activity-properties-panel-title"
              className="font-sans text-[14px] font-semibold leading-tight text-mono-dark"
            >
              Properties
            </h2>
            <p
              id="activity-properties-panel-desc"
              className="mt-1 font-sans text-[11px] leading-snug text-mono-light"
            >
              Manage which columns are visible or not
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-none text-mono-light hover:bg-bg-tertiary/40 hover:text-mono-dark"
            aria-label="Close"
          >
            <span className="material-symbols-rounded text-[16px] leading-none">close</span>
          </button>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-b border-bg-tertiary/30 px-2.5 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-mono-light">
          Shown in table
        </span>
        <button
          type="button"
          onClick={hideAll}
          className="text-[12px] font-medium text-sovereign-blue hover:underline"
        >
          Hide all
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-0.5">
        {orderedKeys.map((key) => {
          const visible = visibleSet.has(key);
          const isDrop = dropTarget === key && dragKey != null && dragKey !== key;
          return (
            <div
              key={key}
              onDragOver={(e) => onDragOver(e, key)}
              onDrop={(e) => onDrop(e, key)}
              onDragEnd={onDragEnd}
              className={`flex items-center gap-1.5 border-b border-bg-tertiary/15 px-2.5 py-1.5 transition-colors ${
                isDrop ? "bg-sovereign-blue/10" : "hover:bg-bg-secondary/50"
              } ${dragKey === key ? "opacity-50" : ""}`}
            >
              <span
                draggable
                onDragStart={(e) => onDragStart(e, key)}
                className="material-symbols-rounded shrink-0 cursor-grab text-mono-light active:cursor-grabbing"
                style={{ fontSize: 16, fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
                aria-hidden
              >
                drag_indicator
              </span>
              <span
                className="material-symbols-rounded shrink-0 text-mono-medium"
                style={rowGlyphStyle}
                aria-hidden
              >
                {iconFor(key)}
              </span>
              <span className="min-w-0 flex-1 font-sans text-[12px] leading-snug text-mono-dark">
                {labelFor(key)}
              </span>
              <button
                type="button"
                onClick={() => toggleVisible(key)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none text-mono-dark hover:bg-bg-tertiary/40"
                aria-label={visible ? `Hide ${labelFor(key)}` : `Show ${labelFor(key)}`}
                aria-pressed={visible}
              >
                <span
                  className={`material-symbols-rounded leading-none ${
                    visible ? "text-sovereign-blue" : "text-mono-light"
                  }`}
                  style={{
                    fontSize: 18,
                    lineHeight: 1,
                    fontVariationSettings: visible
                      ? ("'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20" as const)
                      : ("'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" as const),
                  }}
                >
                  {visible ? "visibility" : "visibility_off"}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
