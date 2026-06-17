"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Database } from "@/lib/types/database";
import { SCHEDULE_C_LINES } from "@/lib/tax/schedule-c-lines";
import { MEAL_50_PCT_TOOLTIP } from "@/lib/tax/disclaimer";
import { HelpTooltip } from "@/components/HelpTooltip";
import { IBolt } from "@/components/ui/icons";
import { transactionDeductibleAmount } from "@/lib/tax/form-calculations";
import { panelChipDeductionPercent } from "@/lib/triage/deduction-percent";
import {
  categoryLabelForLine,
  formatScheduleCLineShort,
} from "@/lib/triage/schedule-c-display";
import { categoryForTaxDraftLine, normalizedTaxDraftLine } from "@/lib/triage/tax-draft";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

/** Partial transaction shape from tax details summary (no description, ai_* etc.) */
export type PartialTransaction = Pick<
  TransactionRow,
  "id" | "vendor" | "amount" | "date" | "status" | "transaction_type" | "category" | "schedule_c_line" | "deduction_percent" | "business_purpose" | "quick_label" | "notes" | "is_meal" | "is_travel" | "marker" | "business_pct"
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
  business_pct?: number | null;
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
  /** Tax page: triage-card layout, fixed viewport sidebar */
  variant?: "default" | "tax";
  /** Pre-select chip % (e.g. from tax list row display_percent) */
  initialDeductionPercent?: number | null;
}

const PANEL_MIN_WIDTH = 360;
const PANEL_MAX_WIDTH = 500;
const COLLAPSED_WIDTH = 72;

function formatDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function formatShortDate(dateStr: string): string {
  const iso = dateStr.length <= 10 ? `${dateStr}T12:00:00` : dateStr;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPanelAmount(value: number, income: boolean): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return income ? `+$${formatted}` : `−$${formatted}`;
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

function panelScheduleLine(transaction: TransactionRow | PartialTransaction): string {
  return normalizedTaxDraftLine(transaction.schedule_c_line) ?? "";
}

function panelDeductionPercent(
  transaction: TransactionRow | PartialTransaction,
  initialPercent?: number | null,
): number {
  if (initialPercent != null && Number.isFinite(initialPercent)) {
    return Math.min(100, Math.max(0, Math.round(initialPercent)));
  }
  return panelChipDeductionPercent(transaction);
}

function baselineChipPercent(transaction: TransactionRow | PartialTransaction): number {
  return panelChipDeductionPercent(transaction);
}

export function TransactionDetailPanel({
  transaction,
  onClose,
  onReanalyze,
  onMarkPersonal,
  onDelete,
  editable = false,
  onSave,
  taxRate = 0.24,
  variant = "default",
  initialDeductionPercent,
}: TransactionDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isTaxVariant = variant === "tax";
  const [taxEditing, setTaxEditing] = useState<"schedule" | "reason" | null>(null);
  const [customReason, setCustomReason] = useState("");

  const [editCategory, setEditCategory] = useState(
    () => transaction.category ?? categoryForTaxDraftLine(transaction.schedule_c_line) ?? "",
  );
  const [editScheduleLine, setEditScheduleLine] = useState(() => panelScheduleLine(transaction));
  const [editDeductionPct, setEditDeductionPct] = useState(() =>
    panelDeductionPercent(transaction, initialDeductionPercent),
  );
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!onDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete();
      setConfirmingDelete(false);
      onClose();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Couldn't delete the transaction. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  const amount = Math.abs(Number(transaction.amount));
  const resolveMealFlag = (scheduleLine: string | null, category: string | null) =>
    !transaction.is_travel &&
    (Boolean(transaction.is_meal) ||
      scheduleLine === "24b" ||
      String(category ?? "").toLowerCase().includes("meal"));
  const deductionPct = panelDeductionPercent(transaction, initialDeductionPercent);
  const deductibleForPercent = (chipPercent: number) => {
    const scheduleLine = editScheduleLine || panelScheduleLine(transaction) || transaction.schedule_c_line;
    const category = editCategory || transaction.category;
    const isPartial = transaction.marker === "Partial";
    return transactionDeductibleAmount({
      amount: transaction.amount,
      transaction_type: transaction.transaction_type ?? "expense",
      schedule_c_line: scheduleLine,
      category,
      is_meal: resolveMealFlag(scheduleLine, category),
      is_travel: transaction.is_travel ?? null,
      deduction_percent: isPartial
        ? (transaction.deduction_percent ?? 100)
        : chipPercent,
      date: transaction.date,
      status: transaction.status,
      quick_label: transaction.quick_label,
      business_purpose: transaction.business_purpose,
      marker: transaction.marker ?? null,
      business_pct: isPartial ? chipPercent : (transaction.business_pct ?? 100),
    });
  };
  const deductibleAmount = deductibleForPercent(deductionPct);
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
    if (editScheduleLine !== panelScheduleLine(transaction)) {
      update.schedule_c_line = editScheduleLine || null;
    }
    if (editDeductionPct !== baselineChipPercent(transaction)) {
      if (transaction.marker === "Partial") {
        update.business_pct = editDeductionPct;
      } else {
        update.deduction_percent = editDeductionPct;
      }
    }
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
    const line = panelScheduleLine(transaction);
    setEditCategory(transaction.category ?? categoryForTaxDraftLine(line) ?? "");
    setEditScheduleLine(line);
    setEditDeductionPct(panelDeductionPercent(transaction, initialDeductionPercent));
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
    transaction.marker,
    transaction.business_pct,
    transaction.business_purpose,
    transaction.notes,
    transaction.vendor,
    transaction.date,
    transaction.amount,
    transaction.transaction_type,
    transaction.status,
    transaction.source,
    transaction.is_meal,
    transaction.is_travel,
    initialDeductionPercent,
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
    setTaxEditing(null);
    setCustomReason("");
  }, [transaction.id]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (isEscapedDocked) return;
      if (confirmingDelete) return;
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (confirmingDelete) {
          if (!deleting) setConfirmingDelete(false);
          return;
        }
        if (isTaxVariant) {
          onClose();
          return;
        }
        setIsEscapedDocked(true);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose, isEscapedDocked, confirmingDelete, deleting, isTaxVariant]);

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

  const isIncome = transaction.transaction_type === "income";
  const reasonChips = [
    ...new Set(
      [transaction.quick_label, transaction.business_purpose, editBusinessPurpose].filter(
        (s): s is string => Boolean(s?.trim()),
      ),
    ),
  ].slice(0, 4);

  function applyScheduleLine(line: string) {
    const label = categoryLabelForLine(line);
    setEditScheduleLine(line);
    if (label) setEditCategory(label);
    setTaxEditing(null);
  }

  function applyReason(text: string) {
    const trimmed = text.trim();
    setEditBusinessPurpose(trimmed);
    setTaxEditing(null);
    setCustomReason("");
  }

  const showMealCap =
    !transaction.is_travel &&
    (transaction.is_meal ||
      editScheduleLine === "24b" ||
      (transaction.category ?? "").toLowerCase().includes("meal"));

  const taxPanel = isTaxVariant ? (
    <div className="txpanel-root">
      <div className="txpanel-backdrop" aria-hidden onClick={onClose} />
      <aside ref={panelRef} className="txpanel txpanel--tax" role="dialog" aria-modal="true">
        <article className="tcard tcard--panel">
          <div className="tcard__head">
            <span className="tcard__cat">{editCategory || transaction.category || "Uncategorized"}</span>
            <button type="button" className="txpanel__close" onClick={onClose} aria-label="Close">
              <span className="material-symbols-rounded text-[20px]">close</span>
            </button>
          </div>

          <div className="tcard__vendor">{transaction.vendor || "Unknown"}</div>
          <div className="tcard__date">{formatShortDate(transaction.date)}</div>
          <div className={`tcard__amount tcard__amount--panel${isIncome ? " is-in" : ""}`}>
            {formatPanelAmount(amount, isIncome)}
          </div>

          {!isIncome && (
            <div className="tcard__ai tcard__ai--panel" data-suggest="business">
              <div className="tcard__ai-head">
                <span className="tcard__ai-tag">
                  <IBolt size={11} /> Tax details
                </span>
              </div>

              <div className="tcard__ai-tax">
                {showMealCap && (
                  <div className="tcard__meal-cap">
                    <span className="schedline__cap-badge">50%</span>
                    <span className="tcard__meal-cap-text">Meal deduction cap</span>
                    <HelpTooltip text={MEAL_50_PCT_TOOLTIP} label="Meal deduction limit" />
                  </div>
                )}

                {taxEditing === "schedule" ? (
                  <div className="tcard__ai-tax tcard__ai-tax--edit">
                    <select
                      className="tcard__ai-tax-select"
                      value={editScheduleLine}
                      onChange={(e) => applyScheduleLine(e.target.value)}
                      autoFocus
                    >
                      <option value="">Schedule C line…</option>
                      {SCHEDULE_C_LINES.map((l) => (
                        <option key={l.line} value={l.line}>
                          {l.line} — {l.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="tcard__ai-tax-btn"
                      onClick={() => setTaxEditing(null)}
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <div className="tcard__ai-tax-line">
                    <span className="tcard__ai-tax-k">Sch.&nbsp;C</span>
                    <span className="tcard__ai-tax-v">
                      {editScheduleLine
                        ? formatScheduleCLineShort(editScheduleLine)
                        : "—"}
                    </span>
                    {editable && onSave && (
                      <button
                        type="button"
                        className="tcard__ai-tax-btn"
                        onClick={() => setTaxEditing("schedule")}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}

                {taxEditing === "reason" ? (
                  <div className="tcard__ai-tax tcard__ai-tax--edit tcard__ai-tax--reason">
                    {reasonChips.length > 0 && (
                      <div className="tcard__ai-tax-chips">
                        {reasonChips.map((label) => (
                          <button
                            key={label}
                            type="button"
                            className={`tcard__ai-tax-chip${
                              editBusinessPurpose === label ? " is-active" : ""
                            }`}
                            onClick={() => applyReason(label)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="tcard__ai-tax-reason-row">
                      <input
                        type="text"
                        className="tcard__ai-tax-input"
                        placeholder="Custom reason"
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            applyReason(customReason);
                          }
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="tcard__ai-tax-btn"
                        onClick={() => applyReason(customReason || editBusinessPurpose)}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="tcard__ai-tax-line">
                    <span className="tcard__ai-tax-k">Reason</span>
                    <span className="tcard__ai-tax-v tcard__ai-tax-v--reason">
                      {editBusinessPurpose?.trim() || <em>—</em>}
                    </span>
                    {editable && onSave && (
                      <button
                        type="button"
                        className="tcard__ai-tax-btn"
                        onClick={() => {
                          setCustomReason(editBusinessPurpose ?? "");
                          setTaxEditing("reason");
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}

                <div className="tcard__ai-tax-line tcard__ai-tax-line--stack">
                  <span className="tcard__ai-tax-k">Deduct</span>
                  <div className="tcard__ai-tax-v tcard__ai-tax-v--deduct">
                    {editable && onSave ? (
                      <>
                        <div className="tcard__ai-tax-chips">
                          {SNAP_POINTS.map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              className={`tcard__ai-tax-chip${
                                editDeductionPct === pct ? " is-active" : ""
                              }`}
                              onClick={() => setEditDeductionPct(pct)}
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>
                        <span className="tcard__deduct-note">
                          ${deductibleForPercent(editDeductionPct).toFixed(2)} deductible
                          {showMealCap ? " before meal cap" : ""}
                        </span>
                      </>
                    ) : (
                      <span>
                        {deductionPct}% · ${deductibleAmount.toFixed(2)} deductible
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {editable && onSave && (
            <div className="txpanel__save">
              {saveError ? (
                <p className="txpanel__save-err">{saveError}</p>
              ) : (
                <p className="txpanel__save-ok">
                  {saveState === "saving" || saving
                    ? "Saving…"
                    : saveState === "saved"
                      ? "Saved"
                      : "Changes save automatically"}
                </p>
              )}
            </div>
          )}
        </article>
      </aside>
    </div>
  ) : null;

  const defaultPanel = !isTaxVariant ? (
    <div
      className={`txpanel-root ${isEscapedDocked ? "pointer-events-none" : ""}`}
    >
      {!isEscapedDocked && <div className="txpanel-backdrop" aria-hidden onClick={onClose} />}

      <div
        ref={panelRef}
        className="txpanel txpanel--default"
        style={{
          width: isCollapsed ? COLLAPSED_WIDTH : `min(${panelWidth}px, 100vw)`,
          transform: isEscapedDocked ? "translateX(100%)" : "translateX(0)",
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
            {!isCollapsed && (onMarkPersonal || onDelete) && (
              <div className="flex items-center gap-2">
                {onMarkPersonal && (
                  <button
                    type="button"
                    onClick={() => void onMarkPersonal()}
                    className="h-8 px-3 border border-warm-stock text-black text-xs font-medium flex items-center justify-center transition hover:bg-warm-stock"
                    title="Mark as personal"
                  >
                    Mark Personal
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setConfirmingDelete(true);
                    }}
                    className="h-8 w-8 text-black flex items-center justify-center transition hover:bg-warm-stock"
                    title="Delete transaction"
                  >
                    <span className="material-symbols-rounded text-[12px]">delete</span>
                  </button>
                )}
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
                  (${deductibleForPercent(editDeductionPct).toFixed(2)} deductible)
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
  ) : null;

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {taxPanel}
      {defaultPanel}

    {confirmingDelete && (
      <div
        data-tx-confirm
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tx-delete-title"
        aria-describedby="tx-delete-desc"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !deleting) setConfirmingDelete(false);
        }}
      >
        <div className="w-full max-w-sm bg-white border border-[#F0F1F7] shadow-xl">
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <span className="material-symbols-rounded text-[18px]">delete</span>
              </span>
              <div className="min-w-0">
                <h2 id="tx-delete-title" className="text-base font-semibold text-mono-dark">
                  Delete this transaction?
                </h2>
                <p id="tx-delete-desc" className="mt-1.5 text-sm text-mono-medium leading-relaxed">
                  {transaction.vendor ? `“${transaction.vendor}” ` : "This transaction "}
                  will be deleted. This can’t be undone.
                </p>
              </div>
            </div>
            {deleteError && <p className="mt-3 text-sm text-red-600">{deleteError}</p>}
          </div>
          <div className="flex justify-end gap-2 px-5 pb-5">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="h-9 px-4 border border-warm-stock text-sm font-medium text-mono-dark transition hover:bg-warm-stock disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="h-9 px-4 bg-red-600 text-white text-sm font-medium transition hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>,
    document.body,
  );
}
