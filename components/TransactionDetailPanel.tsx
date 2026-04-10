"use client";

import { useEffect, useRef, useState } from "react";
import type { Database, Json } from "@/lib/types/database";
import { SCHEDULE_C_LINES } from "@/lib/tax/schedule-c-lines";
import type { TransactionPropertyDefinition } from "@/lib/transaction-property-definition";
import {
  TransactionDetailCustomFields,
  type OrgMemberOption,
} from "@/components/TransactionDetailCustomFields";
import { TransactionPropertySidebarCreate } from "@/components/TransactionPropertySidebarCreate";
import { NotionStylePropertyRow, NotionValuePill } from "@/components/NotionStylePropertyRow";
import { CORE_FIELD_ICONS } from "@/lib/transaction-detail-property-icons";
import { brandColorHex } from "@/lib/brand-palette";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

/** Partial transaction shape from tax details summary (no description, ai_* etc.) */
export type PartialTransaction = Pick<
  TransactionRow,
  | "id"
  | "vendor"
  | "amount"
  | "date"
  | "status"
  | "transaction_type"
  | "category"
  | "schedule_c_line"
  | "deduction_percent"
  | "business_purpose"
  | "quick_label"
  | "notes"
  | "is_meal"
  | "is_travel"
> & {
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  data_source_id?: string | null;
  ai_confidence?: number | null;
  ai_reasoning?: string | null;
  description?: string | null;
  source?: string | null;
  vendor_normalized?: string | null;
  custom_fields?: Json | null;
};

export type TransactionDetailUpdate = {
  category?: string | null;
  schedule_c_line?: string | null;
  deduction_percent?: number | null;
  business_purpose?: string | null;
  notes?: string | null;
  vendor?: string;
  date?: string;
  amount?: number;
  transaction_type?: "expense" | "income";
  status?: "pending" | "completed" | "auto_sorted" | "personal";
  source?: "csv_upload" | "manual";
  custom_fields?: Json;
};

interface TransactionDetailPanelProps {
  transaction: TransactionRow | PartialTransaction;
  onClose: () => void;
  onReanalyze?: (id: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  /** When set, show editable tax fields and call onSave when user saves */
  editable?: boolean;
  onSave?: (id: string, update: TransactionDetailUpdate) => Promise<void>;
  taxRate?: number;
  transactionProperties?: TransactionPropertyDefinition[];
  orgMembers?: OrgMemberOption[];
  memberDisplayById?: Record<string, string>;
  /** When set, sidebar shows “Add org property” (Activity / saved pages). */
  onRefreshTransactionProperties?: () => Promise<void>;
  /** Resolve data_source_id → account name for Account property row. */
  dataSourceNameById?: Record<string, string>;
  /** Resolve data_source_id → brand_color_id for Account property row. */
  dataSourceBrandColorIdById?: Record<string, string>;
}

const PANEL_MIN_WIDTH = 360;
const PANEL_MAX_WIDTH = 500;

function rgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
const COLLAPSED_WIDTH = 72;

function formatDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

const SNAP_POINTS = [0, 25, 50, 75, 100];

export function TransactionDetailPanel({
  transaction,
  onClose,
  onReanalyze,
  onDelete,
  editable = false,
  onSave,
  taxRate = 0.24,
  transactionProperties = [],
  orgMembers = [],
  memberDisplayById: memberDisplayByIdProp,
  onRefreshTransactionProperties,
  dataSourceNameById = {},
  dataSourceBrandColorIdById = {},
}: TransactionDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const memberDisplayById =
    memberDisplayByIdProp ??
    Object.fromEntries(
      orgMembers.map((m) => [
        m.id,
        m.display_name?.trim() || m.email?.trim() || m.id.slice(0, 8),
      ])
    );

  const [editCategory, setEditCategory] = useState(transaction.category ?? "");
  const [editScheduleLine, setEditScheduleLine] = useState(transaction.schedule_c_line ?? "");
  const [editDeductionPct, setEditDeductionPct] = useState(transaction.deduction_percent ?? 100);
  const [editBusinessPurpose, setEditBusinessPurpose] = useState(transaction.business_purpose ?? "");
  const [editNotes, setEditNotes] = useState(transaction.notes ?? "");
  const [editVendor, setEditVendor] = useState(transaction.vendor ?? "");
  const [editDate, setEditDate] = useState(transaction.date ? transaction.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [editAmount, setEditAmount] = useState(String(Math.abs(Number(transaction.amount))));
  const [editTransactionType, setEditTransactionType] = useState<"expense" | "income">(
    (transaction.transaction_type === "income" ? "income" : "expense") as "expense" | "income"
  );
  const [editStatus, setEditStatus] = useState<"pending" | "completed" | "auto_sorted" | "personal">(
    (transaction.status as "pending" | "completed" | "auto_sorted" | "personal") ?? "pending"
  );
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editSource, setEditSource] = useState<"csv_upload" | "manual">(
    (transaction.source === "manual" ? "manual" : "csv_upload") as "csv_upload" | "manual",
  );
  const [editCustomFields, setEditCustomFields] = useState<Record<string, unknown>>({});
  const baselineCustomFieldsRef = useRef<Record<string, unknown>>({});
  const [panelWidth, setPanelWidth] = useState(PANEL_MAX_WIDTH);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEscapedDocked, setIsEscapedDocked] = useState(false);

  const amount = Math.abs(Number(transaction.amount));
  const deductionPct = transaction.deduction_percent ?? 100;
  const deductibleAmount = amount * deductionPct / 100;
  const confidence = transaction.ai_confidence != null ? Number(transaction.ai_confidence) : null;
  const confPct = confidence != null ? Math.round(confidence * 100) : null;

  const statusVariant = (s: string | null): "default" | "sage" | "amber" | "red" => {
    if (s === "completed" || s === "auto_sorted") return "sage";
    if (s === "pending") return "amber";
    if (s === "personal") return "red";
    return "default";
  };

  function stableFieldJson(v: unknown): string {
    return JSON.stringify(v === undefined ? null : v);
  }

  function getPendingUpdate(): TransactionDetailUpdate {
    const update: TransactionDetailUpdate = {};
    if (editCategory !== (transaction.category ?? "")) update.category = editCategory || null;
    if (editScheduleLine !== (transaction.schedule_c_line ?? "")) update.schedule_c_line = editScheduleLine || null;
    if (editDeductionPct !== (transaction.deduction_percent ?? 100)) update.deduction_percent = editDeductionPct;
    if (editBusinessPurpose !== (transaction.business_purpose ?? "")) update.business_purpose = editBusinessPurpose || null;
    if (editNotes !== (transaction.notes ?? "")) update.notes = editNotes || null;
    if (editVendor !== (transaction.vendor ?? "")) update.vendor = editVendor.trim();
    const numAmount = parseFloat(editAmount);
    if (!Number.isNaN(numAmount)) {
      const currentAmount = Math.abs(Number(transaction.amount));
      if (Math.abs(numAmount - currentAmount) > 1e-6) update.amount = numAmount;
    }
    if (editDate !== (transaction.date ?? "").slice(0, 10)) update.date = editDate;
    if (editTransactionType !== (transaction.transaction_type === "income" ? "income" : "expense")) update.transaction_type = editTransactionType;
    if (editStatus !== (transaction.status ?? "pending")) update.status = editStatus;
    const currentSource = (transaction.source === "manual" ? "manual" : "csv_upload") as "csv_upload" | "manual";
    if (transaction.source !== "data_feed" && editSource !== currentSource) {
      update.source = editSource;
    }

    const base = baselineCustomFieldsRef.current;
    const cfPatch: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(editCustomFields)]);
    for (const k of keys) {
      if (stableFieldJson(base[k]) !== stableFieldJson(editCustomFields[k])) {
        cfPatch[k] = editCustomFields[k];
      }
    }
    if (Object.keys(cfPatch).length > 0) update.custom_fields = cfPatch as Json;

    return update;
  }

  async function handleSaveEdits(forcedUpdate?: TransactionDetailUpdate) {
    if (!editable || !onSave) return;
    setSaving(true);
    setSaveState("saving");
    setSaveError(null);
    try {
      const update = forcedUpdate ?? getPendingUpdate();
      if (Object.keys(update).length === 0) return;
      await onSave(transaction.id, update);
      if (update.custom_fields) {
        baselineCustomFieldsRef.current = { ...editCustomFields };
      }
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      setSaveError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    setEditCategory(transaction.category ?? "");
    setEditScheduleLine(transaction.schedule_c_line ?? "");
    setEditDeductionPct(transaction.deduction_percent ?? 100);
    setEditBusinessPurpose(transaction.business_purpose ?? "");
    setEditNotes(transaction.notes ?? "");
    setEditVendor(transaction.vendor ?? "");
    setEditDate(transaction.date ? transaction.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setEditAmount(String(Math.abs(Number(transaction.amount))));
    setEditTransactionType((transaction.transaction_type === "income" ? "income" : "expense") as "expense" | "income");
    setEditStatus((transaction.status as "pending" | "completed" | "auto_sorted" | "personal") ?? "pending");
    setEditSource((transaction.source === "manual" ? "manual" : "csv_upload") as "csv_upload" | "manual");
    setSaveError(null);
    setSaveState("idle");
  }, [
    transaction.id,
    transaction.category,
    transaction.schedule_c_line,
    transaction.deduction_percent,
    transaction.business_purpose,
    transaction.notes,
    transaction.vendor,
    transaction.date,
    transaction.amount,
    transaction.transaction_type,
    transaction.status,
    transaction.source,
  ]);

  useEffect(() => {
    const cf = (transaction as { custom_fields?: unknown }).custom_fields;
    const parsed =
      cf && typeof cf === "object" && !Array.isArray(cf) ? { ...(cf as Record<string, unknown>) } : {};
    baselineCustomFieldsRef.current = parsed;
    setEditCustomFields(parsed);
  }, [transaction.id]);

  useEffect(() => {
    if (!editable || !onSave || isCollapsed) return;
    const pending = getPendingUpdate();
    if (Object.keys(pending).length === 0) return;
    const timeout = window.setTimeout(() => {
      void handleSaveEdits(pending);
    }, 700);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editable,
    onSave,
    isCollapsed,
    editCategory,
    editScheduleLine,
    editDeductionPct,
    editBusinessPurpose,
    editNotes,
    editVendor,
    editDate,
    editAmount,
    editTransactionType,
    editStatus,
    editSource,
    editCustomFields,
    transaction.id,
  ]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (isEscapedDocked) return;
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setIsEscapedDocked(true);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose, isEscapedDocked]);

  function startResize(e: React.MouseEvent<HTMLButtonElement>) {
    if (isCollapsed) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelWidth;
    function onMove(ev: MouseEvent) {
      const delta = startX - ev.clientX;
      const next = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, startWidth + delta));
      setPanelWidth(next);
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div
      className={`fixed inset-0 min-h-[100dvh] z-50 flex justify-end ${isEscapedDocked ? "pointer-events-none" : ""}`}
    >
      {/* Backdrop */}
      {!isEscapedDocked && <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />}

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative h-full overflow-y-auto border-l border-black/[0.06] bg-white/95 shadow-[-20px_0_60px_-24px_rgba(0,0,0,0.12)] backdrop-blur-xl animate-in pointer-events-auto"
        style={{
          animation: "slideInRight 0.2s ease-out",
          width: isCollapsed ? COLLAPSED_WIDTH : `min(${panelWidth}px, 100vw)`,
          transform: isEscapedDocked ? "translateX(100%)" : "translateX(0)",
          transition: "transform 220ms ease-out",
        }}
      >
        <button
          type="button"
          onMouseDown={startResize}
          className={`absolute left-0 top-0 h-full w-1 -translate-x-1/2 cursor-col-resize bg-transparent ${isCollapsed ? "hidden" : "block"}`}
          aria-label="Resize transaction panel"
        />
        {/* Panel header */}
        <div className="sticky top-0 z-10 space-y-2 border-b border-black/[0.06] bg-white/90 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setIsCollapsed((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100/80 text-[#007aff] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)] transition-colors hover:bg-neutral-100 active:scale-[0.97]"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <span
                className="material-symbols-rounded text-[15px]"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 20" }}
              >
                keyboard_double_arrow_right
              </span>
            </button>
            {!isCollapsed && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    if (!onDelete) return;
                    await onDelete();
                    onClose();
                  }}
                  disabled={!onDelete}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100/80 text-red-600 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)] transition-colors hover:bg-red-50 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35"
                  title="Delete transaction"
                >
                  <span
                    className="material-symbols-rounded text-[14px]"
                    style={{ fontVariationSettings: "'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 20" }}
                  >
                    delete
                  </span>
                </button>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <div className="flex items-start gap-2 pt-4">
              {editable && onSave ? (
                <input
                  type="text"
                  value={editVendor}
                  onChange={(e) => setEditVendor(e.target.value)}
                  placeholder="New transaction"
                  className="w-full min-w-0 appearance-none bg-transparent text-2xl leading-tight font-semibold font-sans text-mono-dark placeholder:text-neutral-400 border-0 p-0 shadow-none outline-none focus:outline-none focus:ring-0"
                  aria-label="Transaction title"
                />
              ) : (
                <h2 className="text-2xl leading-tight font-semibold font-sans text-mono-dark truncate">
                  {transaction.vendor || "New transaction"}
                </h2>
              )}
            </div>
          )}
        </div>
        {/* Properties */}
        {!isCollapsed && <div className="px-4 py-3 sm:px-5">
          <NotionStylePropertyRow icon={CORE_FIELD_ICONS.vendor} label="Vendor" immutable>
            {editable && onSave ? (
              <input
                type="text"
                value={editVendor}
                onChange={(e) => setEditVendor(e.target.value)}
                placeholder="Empty"
                className="w-full min-w-0 rounded-md border border-[#F0F1F7] bg-white px-2 py-1 text-sm focus:border-mono-medium/25 focus:outline-none"
              />
            ) : transaction.vendor ? (
              <span className="font-medium">{transaction.vendor}</span>
            ) : (
              <span className="text-mono-light text-xs italic">Empty</span>
            )}
          </NotionStylePropertyRow>

          <NotionStylePropertyRow icon={CORE_FIELD_ICONS.date} label="Date" immutable>
            {editable && onSave ? (
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full min-w-0 rounded-md border border-[#F0F1F7] bg-white px-2 py-1 text-sm focus:border-mono-medium/25 focus:outline-none"
              />
            ) : (
              formatDate(transaction.date)
            )}
          </NotionStylePropertyRow>

          <NotionStylePropertyRow icon={CORE_FIELD_ICONS.amount} label="Amount" immutable>
            {editable && onSave ? (
              <input
                type="number"
                step="any"
                min="0"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                placeholder="0.00"
                className="w-full min-w-0 rounded-md border border-[#F0F1F7] bg-white px-2 py-1 text-sm tabular-nums focus:border-mono-medium/25 focus:outline-none"
              />
            ) : (
              <span className="font-semibold tabular-nums">
                {"$" +
                  Math.abs(amount).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
              </span>
            )}
          </NotionStylePropertyRow>

          <NotionStylePropertyRow icon={CORE_FIELD_ICONS.transaction_type} label="Flow" immutable>
            {editable && onSave ? (
              <select
                value={editTransactionType}
                onChange={(e) => setEditTransactionType(e.target.value as "expense" | "income")}
                className="w-full min-w-0 rounded-md border border-[#F0F1F7] bg-white px-2 py-1 text-sm focus:border-mono-medium/25 focus:outline-none"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            ) : (
              <NotionValuePill tone="neutral">
                {transaction.transaction_type === "income" ? "Income" : "Expense"}
              </NotionValuePill>
            )}
          </NotionStylePropertyRow>

          <NotionStylePropertyRow icon={CORE_FIELD_ICONS.status} label="Status" immutable>
            {editable && onSave ? (
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as "pending" | "completed" | "auto_sorted" | "personal")}
                className="w-full min-w-0 rounded-md border border-[#F0F1F7] bg-white px-2 py-1 text-sm focus:border-mono-medium/25 focus:outline-none"
              >
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="auto_sorted">Auto-sorted</option>
                <option value="personal">Personal</option>
              </select>
            ) : (
              (() => {
                const v = statusVariant(transaction.status);
                const tone = v === "sage" ? "sage" : v === "amber" || v === "red" ? "amber" : "neutral";
                return (
                  <NotionValuePill tone={tone}>
                    {transaction.status === "auto_sorted" ? "Auto-sorted" : (transaction.status ?? "Pending")}
                  </NotionValuePill>
                );
              })()
            )}
          </NotionStylePropertyRow>

          <NotionStylePropertyRow icon={CORE_FIELD_ICONS.category} label="Category" immutable>
            {editable && onSave ? (
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full min-w-0 rounded-md border border-[#F0F1F7] bg-white px-2 py-1 text-sm focus:border-mono-medium/25 focus:outline-none"
              >
                <option value="">Uncategorized</option>
                {SCHEDULE_C_LINES.map((l) => (
                  <option key={l.line} value={l.label}>
                    {l.label}
                  </option>
                ))}
              </select>
            ) : transaction.category ? (
              <NotionValuePill tone="sage">{transaction.category}</NotionValuePill>
            ) : (
              <span className="text-mono-light text-xs italic">Empty</span>
            )}
          </NotionStylePropertyRow>

          <NotionStylePropertyRow icon={CORE_FIELD_ICONS.schedule_c_line} label="Schedule C" immutable>
            {editable && onSave ? (
              <select
                value={editScheduleLine}
                onChange={(e) => setEditScheduleLine(e.target.value)}
                className="w-full min-w-0 rounded-md border border-[#F0F1F7] bg-white px-2 py-1 text-sm focus:border-mono-medium/25 focus:outline-none"
              >
                <option value="">—</option>
                {SCHEDULE_C_LINES.map((l) => (
                  <option key={l.line} value={l.line}>
                    Line {l.line} — {l.label}
                  </option>
                ))}
              </select>
            ) : transaction.schedule_c_line ? (
              <span className="text-xs">{transaction.schedule_c_line}</span>
            ) : (
              <span className="text-mono-light text-xs italic">Empty</span>
            )}
          </NotionStylePropertyRow>

          <NotionStylePropertyRow icon={CORE_FIELD_ICONS.deduction} label="Deduction" alignTop immutable>
            {editable && onSave ? (
              <div className="flex flex-wrap items-center gap-2">
                {SNAP_POINTS.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setEditDeductionPct(pct)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium tabular-nums transition ${
                      editDeductionPct === pct
                        ? "bg-mono-dark text-white"
                        : "border border-bg-tertiary/80 text-mono-medium hover:bg-bg-secondary"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
                <span className="text-xs text-mono-light">
                  (${((amount * editDeductionPct) / 100).toFixed(2)} deductible)
                </span>
              </div>
            ) : (
              <div>
                <span className="font-semibold tabular-nums">{deductionPct}%</span>
                <span className="text-xs text-mono-light ml-2">
                  (${deductibleAmount.toFixed(2)} deductible, saves ~${(deductibleAmount * taxRate).toFixed(2)})
                </span>
              </div>
            )}
          </NotionStylePropertyRow>

          {confPct != null && (
            <NotionStylePropertyRow icon={CORE_FIELD_ICONS.ai_confidence} label="AI %" alignTop immutable>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-cool-stock">
                  <div
                    className="h-full rounded-full bg-frost transition-all"
                    style={{ width: `${confPct}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums">{confPct}%</span>
              </div>
            </NotionStylePropertyRow>
          )}

          {transaction.ai_reasoning != null && transaction.ai_reasoning !== "" && (
            <NotionStylePropertyRow icon={CORE_FIELD_ICONS.ai_reasoning} label="AI note" alignTop immutable>
              <p className="text-xs text-mono-medium leading-relaxed">{transaction.ai_reasoning}</p>
            </NotionStylePropertyRow>
          )}

          <NotionStylePropertyRow icon={CORE_FIELD_ICONS.business_purpose} label="Purpose" alignTop immutable>
            {editable && onSave ? (
              <textarea
                value={editBusinessPurpose}
                onChange={(e) => setEditBusinessPurpose(e.target.value)}
                placeholder="Empty"
                rows={2}
                className="w-full min-w-0 resize-none rounded-md border border-[#F0F1F7] bg-white px-2 py-1 text-sm focus:border-mono-medium/25 focus:outline-none"
              />
            ) : transaction.business_purpose ? (
              <p className="text-xs">{transaction.business_purpose}</p>
            ) : (
              <span className="text-mono-light text-xs italic">Empty</span>
            )}
          </NotionStylePropertyRow>

          {transaction.quick_label != null && transaction.quick_label !== "" && (
            <NotionStylePropertyRow icon={CORE_FIELD_ICONS.quick_label} label="Label" immutable>
              <NotionValuePill tone="sage">{transaction.quick_label}</NotionValuePill>
            </NotionStylePropertyRow>
          )}

          {transaction.description != null && transaction.description !== "" && (
            <NotionStylePropertyRow icon={CORE_FIELD_ICONS.description} label="Description" alignTop immutable>
              <p className="text-xs text-mono-medium">{transaction.description}</p>
            </NotionStylePropertyRow>
          )}

          <NotionStylePropertyRow icon={CORE_FIELD_ICONS.notes} label="Notes" alignTop immutable>
            {editable && onSave ? (
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Empty"
                rows={2}
                className="w-full min-w-0 resize-none rounded-md border border-[#F0F1F7] bg-white px-2 py-1 text-sm focus:border-mono-medium/25 focus:outline-none"
              />
            ) : transaction.notes ? (
              <p className="text-xs text-mono-medium">{transaction.notes}</p>
            ) : (
              <span className="text-mono-light text-xs italic">Empty</span>
            )}
          </NotionStylePropertyRow>

          <NotionStylePropertyRow icon={CORE_FIELD_ICONS.source} label="Source" immutable>
            {transaction.source === "data_feed" ? (
              <NotionValuePill tone="neutral">Direct Feed</NotionValuePill>
            ) : editable && onSave ? (
              <select
                value={editSource}
                onChange={(e) => setEditSource(e.target.value as "csv_upload" | "manual")}
                className="w-full min-w-0 rounded-md border border-[#F0F1F7] bg-white px-2 py-1 text-sm focus:border-mono-medium/25 focus:outline-none"
              >
                <option value="csv_upload">Uploaded via CSV</option>
                <option value="manual">Entered manually</option>
              </select>
            ) : (
              <NotionValuePill tone="neutral">
                {transaction.source === "manual"
                  ? "Entered manually"
                  : transaction.source === "csv_upload" || !transaction.source
                  ? "Uploaded via CSV"
                  : transaction.source}
              </NotionValuePill>
            )}
          </NotionStylePropertyRow>

          {(() => {
            const id = transaction.data_source_id ?? null;
            if (!id) return null;
            const accountName = dataSourceNameById?.[id] ?? "Account";
            const accountHex = brandColorHex(dataSourceBrandColorIdById?.[id]);
            return (
              <NotionStylePropertyRow icon="database" label="Account" immutable>
                <span
                  className="inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: rgba(accountHex, 0.14),
                    color: accountHex,
                  }}
                >
                  {accountName}
                </span>
              </NotionStylePropertyRow>
            );
          })()}

          <TransactionDetailCustomFields
            definitions={transactionProperties}
            transaction={{
              id: transaction.id,
              user_id: transaction.user_id ?? "",
              created_at: transaction.created_at ?? new Date().toISOString(),
              updated_at: transaction.updated_at ?? new Date().toISOString(),
              data_source_id: transaction.data_source_id ?? null,
            }}
            editable={Boolean(editable && onSave)}
            editCustomFields={editCustomFields}
            setEditCustomFields={setEditCustomFields}
            memberDisplayById={memberDisplayById}
            orgMembers={orgMembers}
            dataSourceNameById={dataSourceNameById}
          />

          {editable && onSave && onRefreshTransactionProperties && (
            <TransactionPropertySidebarCreate onRefresh={onRefreshTransactionProperties} />
          )}
        </div>}

        {/* Autosave status */}
        {editable && onSave && (
          <div className="px-6 py-3 space-y-1">
            {saveError && (
              <p className="text-xs text-red-600">{saveError}</p>
            )}
            {!saveError && (
              <p className="text-xs text-mono-medium">
                {saveState === "saving" || saving
                  ? "Saving changes..."
                  : saveState === "saved"
                  ? "All changes auto-saved"
                  : ""}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        {!isCollapsed && <div className="px-6 py-4 space-y-2">
          {onReanalyze && (
            <button
              type="button"
              onClick={() => onReanalyze(transaction.id)}
              className="w-full flex items-center gap-2.5 rounded-none border border-bg-tertiary px-4 py-2.5 text-xs font-medium text-mono-medium hover:bg-bg-secondary transition"
            >
              <span className="material-symbols-rounded text-[16px]">auto_awesome</span>
              Re-analyze with AI
            </button>
          )}
        </div>}
      </div>
    </div>
  );
}
