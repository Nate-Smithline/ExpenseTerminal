"use client";

import { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import type { Database } from "@/lib/types/database";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

export interface TransactionUpdate {
  quick_label?: string;
  business_purpose?: string;
  notes?: string;
  deduction_percent?: number;
  category?: string | null;
  schedule_c_line?: string | null;
}

interface TransactionCardProps {
  transaction: Transaction;
  onSave: (data: TransactionUpdate, opts?: { applyToSimilar?: boolean }) => void | Promise<void>;
  onMarkPersonal: () => Promise<void>;
  onDelete?: () => Promise<void>;
  onCheckSimilar: (vendor: string, excludeId: string) => Promise<Transaction[]>;
  onApplyToAllSimilar: (transaction: Transaction, data: TransactionUpdate) => Promise<void>;
  onOpenManage?: (transaction: Transaction) => void;
  isActive?: boolean;
  onFocus?: () => void;
  taxRate?: number;
}

export interface TransactionCardRef {
  selectLabel: (index: number) => void;
  markPersonal: () => void;
  focusBusiness: () => void;
  save: () => void;
  cycleDeduction: () => void;
  expand: () => void;
  nextStep: () => void;
  setDeductionPercent: (pct: number) => void;
  toggleApplyToSimilar: () => void;
  deleteTransaction: () => void;
}

function formatDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const SNAP_POINTS = [0, 25, 50, 75, 100];

/** Schedule C expense categories (line: display name) for dropdown */
const EXPENSE_CATEGORIES: { line: string; name: string }[] = [
  { line: "8", name: "Advertising" },
  { line: "9", name: "Car/truck" },
  { line: "10", name: "Commissions/fees" },
  { line: "11", name: "Contract labor" },
  { line: "13", name: "Depreciation" },
  { line: "15", name: "Insurance" },
  { line: "16b", name: "Other interest" },
  { line: "17", name: "Legal/professional" },
  { line: "18", name: "Office expense" },
  { line: "21", name: "Rent/lease" },
  { line: "22", name: "Repairs" },
  { line: "23", name: "Supplies" },
  { line: "24a", name: "Travel" },
  { line: "24b", name: "Meals" },
  { line: "25", name: "Utilities" },
  { line: "26", name: "Wages" },
  { line: "27a", name: "Other expenses" },
];

export const TransactionCard = forwardRef<TransactionCardRef, TransactionCardProps>(
  function TransactionCard(
    { transaction, onSave, onMarkPersonal, onDelete, onCheckSimilar, onApplyToAllSimilar, onOpenManage, isActive, onFocus, taxRate = 0.24 },
    ref,
  ) {
    const [step, setStep] = useState<1 | 2>(1);
    const [selectedLabel, setSelectedLabel] = useState(transaction.quick_label ?? "");
    const [businessPurpose, setBusinessPurpose] = useState(transaction.business_purpose ?? "");
    const [notes, setNotes] = useState(transaction.notes ?? "");
    const [deductionPct, setDeductionPct] = useState(
      transaction.deduction_percent ?? 100
    );
    const [saving, setSaving] = useState(false);
    const [showWriteIn, setShowWriteIn] = useState(false);
    const [similarTransactions, setSimilarTransactions] = useState<Transaction[]>([]);
    const [autoSort, setAutoSort] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(transaction.category ?? null);
    const [selectedScheduleLine, setSelectedScheduleLine] = useState<string | null>(transaction.schedule_c_line ?? null);
    const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
    const [categoryHighlightIdx, setCategoryHighlightIdx] = useState(0);

    const businessRef = useRef<HTMLTextAreaElement>(null);
    const categoryListRef = useRef<HTMLDivElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    const suggestions: string[] = Array.isArray(transaction.ai_suggestions)
      ? (transaction.ai_suggestions as string[])
      : [];

    const isMeal = transaction.is_meal || (transaction.category?.toLowerCase().includes("meal") ?? false);
    const isTravel = transaction.is_travel ?? false;
    const confidence = transaction.ai_confidence != null ? Number(transaction.ai_confidence) : null;
    const confPct = confidence != null ? Math.round(confidence * 100) : null;
    const amount = Math.abs(Number(transaction.amount));
    const deductibleAmount = (amount * deductionPct / 100);

    useEffect(() => {
      onCheckSimilar(transaction.vendor, transaction.id).then((list) => {
        setSimilarTransactions(list ?? []);
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      if (isMeal && !isTravel && transaction.deduction_percent === null) {
        setDeductionPct(50);
      }
    }, [isMeal, isTravel, transaction.deduction_percent]);

    useImperativeHandle(ref, () => ({
      selectLabel(index: number) {
        if (step === 2) {
          const allLabels = [...suggestions.filter((s) => s !== "Personal"), "Personal"];
          if (index < allLabels.length) {
            handleQuickAction(allLabels[index]);
          }
        }
      },
      markPersonal() {
        if (step === 1) onMarkPersonal();
        else handleQuickAction("Personal");
      },
      focusBusiness() {
        if (step === 1) setStep(2);
        setShowWriteIn(true);
        setTimeout(() => businessRef.current?.focus(), 50);
      },
      save() { handleNext(); },
      nextStep() { handleNext(); },
      cycleDeduction() {
        setDeductionPct((prev) => {
          const idx = SNAP_POINTS.indexOf(prev);
          return SNAP_POINTS[(idx + 1) % SNAP_POINTS.length];
        });
      },
      expand() {
        if (onOpenManage) onOpenManage(transaction);
      },
      setDeductionPercent(pct: number) {
        if (SNAP_POINTS.includes(pct)) setDeductionPct(pct);
      },
      toggleApplyToSimilar() {
        setAutoSort((prev) => !prev);
      },
      deleteTransaction() {
        if (onDelete) onDelete();
      },
    }));

    const handleQuickAction = useCallback(
      (label: string) => {
        setSelectedLabel(label);
        if (!businessPurpose && label !== "Personal") {
          setBusinessPurpose(`${label} expense`);
        }
        if (label === "Personal") {
          setDeductionPct(0);
        }
      },
      [businessPurpose],
    );

    const saveData: TransactionUpdate = {
      quick_label: selectedLabel,
      business_purpose: selectedLabel === "Personal" ? "" : businessPurpose,
      notes,
      deduction_percent: deductionPct,
      category: selectedCategory,
      schedule_c_line: selectedScheduleLine,
    };

    function handleNext() {
      if (step === 1) {
        setStep(2);
        return;
      }
      handleApprove();
    }

    function handleApprove() {
      if (!selectedLabel && !businessPurpose && deductionPct === 100) {
        return;
      }
      onSave(saveData, { applyToSimilar: autoSort && similarTransactions.length > 0 });
    }

    async function handleMarkPersonalClick() {
      setSaving(true);
      await onMarkPersonal();
      setSaving(false);
    }

    useEffect(() => {
      if (isActive && cardRef.current) {
        cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, [isActive]);

    // Category picker: arrows, Enter, Escape, c (when open)
    useEffect(() => {
      if (!isActive || !categoryPickerOpen) return;
      function handleKey(e: KeyboardEvent) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        const key = e.key;
        if (key === "ArrowDown") {
          e.preventDefault();
          e.stopImmediatePropagation();
          setCategoryHighlightIdx((i) => (i + 1) % EXPENSE_CATEGORIES.length);
          return;
        }
        if (key === "ArrowUp") {
          e.preventDefault();
          e.stopImmediatePropagation();
          setCategoryHighlightIdx((i) => (i - 1 + EXPENSE_CATEGORIES.length) % EXPENSE_CATEGORIES.length);
          return;
        }
        if (key === "Enter") {
          e.preventDefault();
          e.stopImmediatePropagation();
          const c = EXPENSE_CATEGORIES[categoryHighlightIdx];
          if (c) {
            setSelectedScheduleLine(c.line);
            setSelectedCategory(c.name);
            setCategoryPickerOpen(false);
          }
          return;
        }
        if (key === "Escape" || key === "c" || key === "C") {
          e.preventDefault();
          e.stopImmediatePropagation();
          setCategoryPickerOpen(false);
        }
      }
      window.addEventListener("keydown", handleKey, true);
      return () => window.removeEventListener("keydown", handleKey, true);
    }, [isActive, categoryPickerOpen, categoryHighlightIdx]);

    // Scroll highlighted category into view
    useEffect(() => {
      if (!categoryPickerOpen || !categoryListRef.current) return;
      const el = categoryListRef.current.querySelector(`[role="option"]:nth-child(${categoryHighlightIdx + 1})`);
      (el as HTMLElement)?.scrollIntoView({ block: "nearest" });
    }, [categoryPickerOpen, categoryHighlightIdx]);

    // Click outside to close category picker
    useEffect(() => {
      if (!categoryPickerOpen) return;
      function handleClick(e: MouseEvent) {
        if (categoryListRef.current?.contains(e.target as Node) || (e.target as HTMLElement)?.closest?.("[data-category-trigger]")) return;
        setCategoryPickerOpen(false);
      }
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [categoryPickerOpen]);

    // Step 1 keyboard shortcuts: 0,1,2,5,7 = %, a = apply to similar, c = category, Backspace/Delete = delete
    useEffect(() => {
      if (!isActive || step !== 1 || categoryPickerOpen) return;
      function handleKey(e: KeyboardEvent) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        const key = e.key;
        if (key === "0" || key === "1" || key === "2" || key === "5" || key === "7") {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (key === "0") setDeductionPct(0);
          else if (key === "1") setDeductionPct(100);
          else if (key === "2") setDeductionPct(25);
          else if (key === "5") setDeductionPct(50);
          else if (key === "7") setDeductionPct(75);
          return;
        }
        if (key === "c" || key === "C") {
          e.preventDefault();
          e.stopImmediatePropagation();
          setCategoryPickerOpen(true);
          setCategoryHighlightIdx(EXPENSE_CATEGORIES.findIndex((c) => c.line === (selectedScheduleLine ?? transaction.schedule_c_line ?? "")) >= 0 ? EXPENSE_CATEGORIES.findIndex((c) => c.line === (selectedScheduleLine ?? transaction.schedule_c_line ?? "")) : 0);
          return;
        }
        if (key === "a" || key === "A") {
          e.preventDefault();
          e.stopImmediatePropagation();
          setAutoSort((prev) => !prev);
          return;
        }
        if (key === "Backspace" || key === "Delete") {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (onDelete) onDelete();
        }
      }
      window.addEventListener("keydown", handleKey, true);
      return () => window.removeEventListener("keydown", handleKey, true);
    }, [isActive, step, categoryPickerOpen, onDelete, selectedScheduleLine, transaction.schedule_c_line]);

    const isAiCategorized = transaction.schedule_c_line != null || transaction.ai_confidence != null;
    const displayCategory = selectedCategory ?? transaction.category ?? null;
    const effectiveLine = selectedScheduleLine ?? transaction.schedule_c_line ?? null;
    const displayCategoryName =
      EXPENSE_CATEGORIES.find((c) => c.line === effectiveLine)?.name ?? displayCategory ?? "Uncategorized";

    return (
      <div
        ref={cardRef}
        onClick={() => onFocus?.()}
        className={`card transition-all duration-200 ${
          isActive
            ? "ring-1 ring-accent-sage/20 shadow-md px-6 py-5"
            : "opacity-50 hover:opacity-75 px-6 py-4 cursor-pointer"
        }`}
      >
        {/* Header: vendor name + category + amount */}
        <div className="flex items-center gap-3 mb-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm text-mono-dark">{transaction.vendor}</p>
              <span className="text-[11px] text-mono-light">{formatDate(transaction.date)}</span>
            </div>
            <p className="text-xs text-mono-light mt-0.5">
              {transaction.category ?? "Uncategorized"}
              {confPct != null && (
                <span className="ml-1.5 text-mono-light/50">{confPct}%</span>
              )}
            </p>
          </div>
          <span className="text-sm font-semibold text-mono-dark tabular-nums shrink-0">
            -${amount.toFixed(2)}
          </span>
        </div>

        {/* Only show full content for active card */}
        {!isActive && (
          <div className="mt-2 text-[11px] text-mono-light">
            Click to review
          </div>
        )}

        {isActive && (
          <div className="mt-3">
            {/* Meal cap warning */}
            {isMeal && !isTravel && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200/60 px-2.5 py-1.5 mb-3">
                <span className="text-amber-600 text-xs">!</span>
                <p className="text-[11px] text-amber-800">Meals outside travel typically 50%.</p>
              </div>
            )}

            {/* STEP 1: Deduction Amount */}
            {step === 1 && (
              <div className="space-y-3 animate-in">
                {/* Category: one line */}
                <div className="relative flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-mono-light shrink-0">Category:</span>
                  <span className="text-mono-medium">{displayCategoryName}</span>
                  {isAiCategorized && confPct != null && (
                    <span className="text-accent-sage font-medium">AI {confPct}%</span>
                  )}
                  {!isAiCategorized && (
                    <span className="text-amber-600 text-[11px]">Not yet categorized by AI</span>
                  )}
                  <button
                    type="button"
                    data-category-trigger
                    onClick={() => {
                      setCategoryPickerOpen((o) => !o);
                      if (!categoryPickerOpen) {
                        const idx = EXPENSE_CATEGORIES.findIndex((c) => c.line === (selectedScheduleLine ?? transaction.schedule_c_line ?? ""));
                        setCategoryHighlightIdx(idx >= 0 ? idx : 0);
                      }
                    }}
                    className="px-1 py-0.5 text-[11px] text-mono-medium hover:text-mono-dark transition flex items-center gap-0.5"
                  >
                    <kbd className="kbd-hint text-[10px]">c</kbd>
                    {categoryPickerOpen ? "Close" : "Change"}
                  </button>
                  {categoryPickerOpen && (
                    <div
                      ref={categoryListRef}
                      className="absolute left-0 top-full mt-1 z-10 w-full max-w-sm rounded-lg border border-bg-tertiary bg-white shadow-lg py-1 max-h-56 overflow-auto"
                      role="listbox"
                    >
                      {EXPENSE_CATEGORIES.map((c, i) => (
                        <button
                          key={c.line}
                          type="button"
                          role="option"
                          aria-selected={categoryHighlightIdx === i}
                          onClick={() => {
                            setSelectedScheduleLine(c.line);
                            setSelectedCategory(c.name);
                            setCategoryPickerOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition ${
                            categoryHighlightIdx === i ? "bg-accent-sage/10 text-accent-sage font-medium" : "text-mono-medium hover:bg-bg-secondary"
                          }`}
                        >
                          <span className="text-mono-light w-8">{c.line}</span>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="w-full">
                  <p className="text-xs font-medium text-mono-medium mb-1.5">What percent for business?</p>
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <div className="flex items-center gap-2">
                      {SNAP_POINTS.map((pt) => (
                        <button
                          key={pt}
                          type="button"
                          onClick={() => setDeductionPct(pt)}
                          className={`py-1 text-xs font-medium transition flex items-center gap-2.5 ${
                            pt === 0 ? "pl-0 pr-2" : "px-2"
                          } ${
                            deductionPct === pt
                              ? "text-accent-sage font-semibold"
                              : "text-mono-medium hover:text-mono-dark"
                          }`}
                        >
                          {pt === 0 && <kbd className="kbd-hint">0</kbd>}
                          {pt === 25 && <kbd className="kbd-hint">2</kbd>}
                          {pt === 50 && <kbd className="kbd-hint">5</kbd>}
                          {pt === 75 && <kbd className="kbd-hint">7</kbd>}
                          {pt === 100 && <kbd className="kbd-hint">1</kbd>}
                          {pt}%
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-mono-light tabular-nums shrink-0">
                      ${deductibleAmount.toFixed(2)} deductible (saves ~${(deductibleAmount * taxRate).toFixed(2)})
                    </p>
                  </div>
                  <div className="flex items-center gap-3 w-full">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={deductionPct}
                      onChange={(e) => setDeductionPct(Number(e.target.value))}
                      className="flex-1 min-w-0 h-1.5 accent-accent-sage cursor-pointer"
                    />
                    <span className="text-sm font-semibold text-mono-dark tabular-nums w-12 text-right shrink-0">
                      {deductionPct}%
                    </span>
                  </div>
                </div>

                {/* Auto-sort checkbox */}
                {similarTransactions.length > 0 && (
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={autoSort}
                      onChange={(e) => setAutoSort(e.target.checked)}
                      className="h-4 w-4 rounded border-bg-tertiary text-accent-sage focus:ring-accent-sage/30"
                    />
                    <span className="text-xs text-mono-medium group-hover:text-mono-dark transition">
                      <kbd className="kbd-hint mr-1">a</kbd>
                      Also apply to {similarTransactions.length} other{similarTransactions.length === 1 ? "" : "s"} from {transaction.vendor}
                    </span>
                  </label>
                )}

                {/* Action row: Personal, Next, View details, Delete */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onMarkPersonal()}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-white border border-bg-tertiary px-3 py-2.5 text-xs font-medium text-mono-light hover:text-mono-dark hover:bg-bg-secondary transition"
                    title="Mark as personal (removes from inbox)"
                  >
                    <kbd className="kbd-hint">p</kbd>
                    Personal
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-accent-sage/5 border border-accent-sage/20 px-4 py-2.5 text-xs font-medium text-accent-sage hover:bg-accent-sage/10 transition"
                  >
                    Next
                    <kbd className="kbd-hint ml-1">s</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenManage?.(transaction)}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-white border border-bg-tertiary px-3 py-2.5 text-xs font-medium text-mono-medium hover:bg-bg-secondary transition"
                    title="View details"
                  >
                    <span className="material-symbols-rounded text-[16px]">open_in_new</span>
                    <kbd className="kbd-hint">Enter</kbd>
                  </button>
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete()}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-white border border-red-200 px-3 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                      title="Delete transaction"
                    >
                      <span className="material-symbols-rounded text-[16px]">delete</span>
                      <kbd className="kbd-hint">⌫</kbd>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: Reason / Label */}
            {step === 2 && (
              <div className="space-y-4 animate-in">
                {/* Quick label suggestions with keyboard hints */}
                {suggestions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-mono-medium mb-2">
                      Select a reason
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map((s, i) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleQuickAction(s)}
                          className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition flex items-center gap-1.5 ${
                            selectedLabel === s
                              ? "border-accent-sage bg-accent-sage text-white"
                              : "border-bg-tertiary bg-white text-mono-medium hover:border-accent-sage/40"
                          }`}
                        >
                          <kbd className={`kbd-hint ${selectedLabel === s ? "!bg-white/20 !text-white !border-white/30" : ""}`}>{i + 1}</kbd>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manual write-in */}
                {!showWriteIn ? (
                  <button
                    type="button"
                    onClick={() => { setShowWriteIn(true); setTimeout(() => businessRef.current?.focus(), 50); }}
                    className="flex items-center gap-2 text-xs text-mono-light hover:text-mono-medium transition"
                  >
                    <kbd className="kbd-hint">w</kbd>
                    Click here to manually write in...
                  </button>
                ) : (
                  <div>
                    <textarea
                      ref={businessRef}
                      value={businessPurpose}
                      onChange={(e) => setBusinessPurpose(e.target.value)}
                      placeholder="Write your business purpose..."
                      className="w-full border border-bg-tertiary rounded-lg p-3 text-xs bg-white focus:ring-1 focus:ring-accent-sage/30 focus:border-accent-sage/40 outline-none resize-none"
                      rows={2}
                    />
                  </div>
                )}

                {/* Auto-sort checkbox (carried forward) */}
                {similarTransactions.length > 0 && (
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={autoSort}
                      onChange={(e) => setAutoSort(e.target.checked)}
                      className="h-4 w-4 rounded border-bg-tertiary text-accent-sage focus:ring-accent-sage/30"
                    />
                    <span className="text-xs text-mono-medium group-hover:text-mono-dark transition">
                      Also apply to {similarTransactions.length} other{similarTransactions.length === 1 ? "" : "s"} from {transaction.vendor}
                    </span>
                  </label>
                )}

                {/* Action row */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-white border border-bg-tertiary px-3 py-2.5 text-xs font-medium text-mono-medium hover:bg-bg-secondary transition"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={saving || (!selectedLabel && !businessPurpose)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-accent-sage px-4 py-2.5 text-xs font-medium text-white hover:bg-accent-sage/90 transition disabled:opacity-40"
                  >
                    Next
                    <kbd className="kbd-hint !bg-white/20 !text-white !border-white/30 ml-1">s</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={handleMarkPersonalClick}
                    disabled={saving}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-white border border-bg-tertiary px-3 py-2.5 text-xs font-medium text-mono-light hover:text-mono-dark hover:bg-bg-secondary transition"
                    title="Mark as personal"
                  >
                    <kbd className="kbd-hint">p</kbd>
                    Personal
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);
