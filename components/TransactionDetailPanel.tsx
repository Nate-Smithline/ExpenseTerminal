"use client";

import { useEffect, useRef, useState } from "react";
import type { Database } from "@/lib/types/database";
import { SCHEDULE_C_LINES } from "@/lib/tax/schedule-c-lines";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

/** Partial transaction shape from tax details summary (no description, ai_* etc.) */
export type PartialTransaction = Pick<
  TransactionRow,
  "id" | "vendor" | "amount" | "date" | "status" | "transaction_type" | "category" | "schedule_c_line" | "deduction_percent" | "business_purpose" | "quick_label" | "notes" | "is_meal" | "is_travel"
> & {
  ai_confidence?: number | null;
  ai_reasoning?: string | null;
  description?: string | null;
  source?: string | null;
  vendor_normalized?: string | null;
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
};

interface TransactionDetailPanelProps {
  transaction: TransactionRow | PartialTransaction;
  onClose: () => void;
  onReanalyze?: (id: string) => Promise<void>;
  onMarkPersonal?: () => Promise<void>;
  onDelete?: () => Promise<void>;
  /** When set, show editable tax fields and call onSave when user saves */
  editable?: boolean;
  onSave?: (id: string, update: TransactionDetailUpdate) => Promise<void>;
  taxRate?: number;
}

const PANEL_MIN_WIDTH = 360;
const PANEL_MAX_WIDTH = 500;
const COLLAPSED_WIDTH = 72;

function formatDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function PropertyRow({ label, children, alignTop = false }: { label: string; children: React.ReactNode; alignTop?: boolean }) {
  return (
    <div className={`flex gap-4 py-2.5 ${alignTop ? "items-start" : "items-center"}`}>
      <span className={`text-xs text-mono-light w-28 shrink-0 ${alignTop ? "pt-0.5" : ""}`}>{label}</span>
      <div className="flex-1 min-w-0 text-sm text-mono-dark">{children}</div>
    </div>
  );
}

function Tag({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "sage" | "amber" | "red" }) {
  const colors = {
    default: "bg-bg-tertiary/40 text-mono-medium",
    sage: "bg-accent-sage/10 text-accent-sage",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-600",
  };
  return (
    <span className={`inline-flex items-center rounded-none px-2 py-0.5 text-xs font-medium ${colors[variant]}`}>
      {children}
    </span>
  );
}

const SNAP_POINTS = [0, 25, 50, 75, 100];

export function TransactionDetailPanel({
  transaction,
  onClose,
  onReanalyze,
  onMarkPersonal,
  onDelete,
  editable = false,
  onSave,
  taxRate = 0.24,
}: TransactionDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

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
        className="relative bg-white border-l border-[#F0F1F7] shadow-xl h-full overflow-y-auto animate-in pointer-events-auto"
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
        <div className="sticky top-0 z-10 bg-white px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setIsCollapsed((v) => !v)}
              className="h-8 w-8 text-black flex items-center justify-center transition hover:bg-warm-stock"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <span className="material-symbols-rounded text-[18px] text-mono-medium">keyboard_double_arrow_right</span>
            </button>
            {!isCollapsed && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void onMarkPersonal?.()}
                  className="h-8 px-3 border border-warm-stock text-black text-xs font-medium flex items-center justify-center transition hover:bg-warm-stock"
                  title="Mark as personal"
                >
                  Mark Personal
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!onDelete) return;
                    await onDelete();
                    onClose();
                  }}
                  disabled={!onDelete}
                  className="h-8 w-8 text-black flex items-center justify-center transition hover:bg-warm-stock disabled:opacity-40"
                  title="Delete transaction"
                >
                  <span className="material-symbols-rounded text-[12px]">delete</span>
                </button>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <div className="flex items-start gap-2 pt-4">
              <h2 className="text-2xl leading-tight font-semibold font-sans text-mono-dark truncate">{transaction.vendor || "New transaction"}</h2>
            </div>
          )}
        </div>
        {/* Properties */}
        {!isCollapsed && <div className="px-6 py-4">
          <PropertyRow label="Vendor">
            {editable && onSave ? (
              <input
                type="text"
                value={editVendor}
                onChange={(e) => setEditVendor(e.target.value)}
                placeholder="Transaction name / vendor"
                className="w-full border border-[#F0F1F7] rounded-none px-2 py-1.5 text-sm bg-white"
              />
            ) : (
              <span className="font-medium">{transaction.vendor || "—"}</span>
            )}
          </PropertyRow>

          <PropertyRow label="Date">
            {editable && onSave ? (
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full border border-[#F0F1F7] rounded-none px-2 py-1.5 text-sm bg-white"
              />
            ) : (
              formatDate(transaction.date)
            )}
          </PropertyRow>

          <PropertyRow label="Amount">
            {editable && onSave ? (
              <input
                type="number"
                step="any"
                min="0"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                placeholder="0.00"
                className="w-full border border-[#F0F1F7] rounded-none px-2 py-1.5 text-sm bg-white tabular-nums"
              />
            ) : (
              <span className="font-semibold tabular-nums">${amount.toFixed(2)}</span>
            )}
          </PropertyRow>

          <PropertyRow label="Type">
            {editable && onSave ? (
              <select
                value={editTransactionType}
                onChange={(e) => setEditTransactionType(e.target.value as "expense" | "income")}
                className="w-full border border-[#F0F1F7] rounded-none px-2 py-1.5 text-sm bg-white"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            ) : (
              <Tag>{transaction.transaction_type === "income" ? "Income" : "Expense"}</Tag>
            )}
          </PropertyRow>

          <PropertyRow label="Status">
            {editable && onSave ? (
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as "pending" | "completed" | "auto_sorted" | "personal")}
                className="w-full border border-[#F0F1F7] rounded-none px-2 py-1.5 text-sm bg-white"
              >
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="auto_sorted">Auto-sorted</option>
                <option value="personal">Personal</option>
              </select>
            ) : (
              <Tag variant={statusVariant(transaction.status)}>
                {transaction.status === "auto_sorted" ? "Auto-sorted" : (transaction.status ?? "Pending")}
              </Tag>
            )}
          </PropertyRow>

          <PropertyRow label="Category">
            {editable && onSave ? (
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full border border-[#F0F1F7] rounded-none px-2 py-1.5 text-sm bg-white"
              >
                <option value="">Uncategorized</option>
                {SCHEDULE_C_LINES.map((l) => (
                  <option key={l.line} value={l.label}>
                    {l.label}
                  </option>
                ))}
              </select>
            ) : transaction.category ? (
              <Tag variant="sage">{transaction.category}</Tag>
            ) : (
              <span className="text-mono-light text-xs">Uncategorized</span>
            )}
          </PropertyRow>

          <PropertyRow label="Schedule C Line">
            {editable && onSave ? (
              <select
                value={editScheduleLine}
                onChange={(e) => setEditScheduleLine(e.target.value)}
                className="w-full border border-[#F0F1F7] rounded-none px-2 py-1.5 text-sm bg-white"
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
              <span className="text-mono-light text-xs">—</span>
            )}
          </PropertyRow>

          <PropertyRow label="Deduction" alignTop>
            {editable && onSave ? (
              <div className="flex items-center gap-2 flex-wrap">
                {SNAP_POINTS.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setEditDeductionPct(pct)}
                    className={`px-2 py-1 text-xs font-medium tabular-nums border ${
                      editDeductionPct === pct
                        ? "bg-warm-stock border-warm-stock text-mono-dark"
                        : "border-bg-tertiary hover:bg-bg-secondary"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
                <span className="text-xs text-mono-light ml-1">
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
          </PropertyRow>

          {confPct != null && (
            <PropertyRow label="AI Confidence" alignTop>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-20 bg-cool-stock overflow-hidden">
                  <div
                    className="h-full bg-frost transition-all"
                    style={{ width: `${confPct}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums">{confPct}%</span>
              </div>
            </PropertyRow>
          )}

          {transaction.ai_reasoning != null && transaction.ai_reasoning !== "" && (
            <PropertyRow label="AI Reasoning" alignTop>
              <p className="text-xs text-mono-medium leading-relaxed">{transaction.ai_reasoning}</p>
            </PropertyRow>
          )}

          <PropertyRow label="Business Purpose" alignTop>
            {editable && onSave ? (
              <textarea
                value={editBusinessPurpose}
                onChange={(e) => setEditBusinessPurpose(e.target.value)}
                placeholder="Business purpose"
                rows={2}
                className="w-full border border-[#F0F1F7] rounded-none px-2 py-1.5 text-sm bg-white resize-none"
              />
            ) : transaction.business_purpose ? (
              <p className="text-xs">{transaction.business_purpose}</p>
            ) : (
              <span className="text-mono-light text-xs">—</span>
            )}
          </PropertyRow>

          {transaction.quick_label != null && transaction.quick_label !== "" && (
            <PropertyRow label="Label">
              <Tag variant="sage">{transaction.quick_label}</Tag>
            </PropertyRow>
          )}

          {transaction.description != null && transaction.description !== "" && (
            <PropertyRow label="Description" alignTop>
              <p className="text-xs text-mono-medium">{transaction.description}</p>
            </PropertyRow>
          )}

          <PropertyRow label="Notes" alignTop>
            {editable && onSave ? (
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Notes"
                rows={2}
                className="w-full border border-[#F0F1F7] rounded-none px-2 py-1.5 text-sm bg-white resize-none"
              />
            ) : transaction.notes ? (
              <p className="text-xs text-mono-medium">{transaction.notes}</p>
            ) : (
              <span className="text-mono-light text-xs">—</span>
            )}
          </PropertyRow>

          <PropertyRow label="Data source">
            {transaction.source === "data_feed" ? (
              <span className="text-xs text-mono-medium">
                Direct Feed
              </span>
            ) : editable && onSave ? (
              <select
                value={editSource}
                onChange={(e) => setEditSource(e.target.value as "csv_upload" | "manual")}
                className="w-full border border-[#F0F1F7] rounded-none px-2 py-1.5 text-sm bg-white"
              >
                <option value="csv_upload">Uploaded via CSV</option>
                <option value="manual">Entered manually</option>
              </select>
            ) : (
              <span className="text-xs text-mono-medium">
                {transaction.source === "manual"
                  ? "Entered manually"
                  : transaction.source === "csv_upload" || !transaction.source
                  ? "Uploaded via CSV"
                  : transaction.source}
              </span>
            )}
          </PropertyRow>

          {transaction.vendor_normalized != null && transaction.vendor_normalized !== "" && (
            <PropertyRow label="Vendor Key">
              <span className="text-xs text-mono-light font-mono">{transaction.vendor_normalized}</span>
            </PropertyRow>
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
