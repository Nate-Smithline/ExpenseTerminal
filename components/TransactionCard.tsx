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
  transaction_type?: "income" | "expense";
  status?: "completed" | "auto_sorted" | "personal";
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
  /** When true, card does not handle 'o' or 'y' so Similar Transactions popup can use them */
  similarPopupOpen?: boolean;
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
    { transaction, onSave, onMarkPersonal, onDelete, onCheckSimilar, onApplyToAllSimilar, onOpenManage, isActive, onFocus, taxRate = 0.24, similarPopupOpen = false },
    ref,
  ) {
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
    const [showDeductionControls, setShowDeductionControls] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(transaction.category ?? null);
    const [selectedScheduleLine, setSelectedScheduleLine] = useState<string | null>(transaction.schedule_c_line ?? null);
    const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
    const [categoryHighlightIdx, setCategoryHighlightIdx] = useState(0);
    const [incomeTreatment, setIncomeTreatment] = useState<"business" | "personal" | null>(
      transaction.transaction_type === "income" ? "business" : null,
    );

    const businessRef = useRef<HTMLTextAreaElement>(null);
    const categoryListRef = useRef<HTMLDivElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    const suggestions: string[] = Array.isArray(transaction.ai_suggestions)
      ? (transaction.ai_suggestions as string[])
      : [];

    const isMeal = transaction.is_meal || (transaction.category?.toLowerCase().includes("meal") ?? false);
    const isTravel = transaction.is_travel ?? false;
    const rawAmount = Number(transaction.amount);
    const amount = Math.abs(rawAmount);
    const isIncomeLike = transaction.transaction_type === "income" || rawAmount > 0;
    const deductibleAmount = (amount * deductionPct / 100);
    const recommendedPct = transaction.deduction_percent ?? (isMeal && !isTravel ? 50 : 100);

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
        const allLabels = [...suggestions.filter((s) => s !== "Personal"), "Personal"];
        if (index < allLabels.length) {
          handleQuickAction(allLabels[index]);
        }
      },
      markPersonal() {
        onMarkPersonal();
      },
      focusBusiness() {
        setShowWriteIn(true);
        setTimeout(() => businessRef.current?.focus(), 50);
      },
      save() { handleApprove(); },
      nextStep() { handleApprove(); },
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

    useEffect(() => {
      if (!isActive) return;
      if (selectedLabel) return;
      if (!suggestions.length) return;
      handleQuickAction(suggestions[0]);
    }, [isActive, selectedLabel, suggestions, handleQuickAction]);

    const maxQuickLabel = 500;
    const maxTextField = 2000;
    const normalizedDeduction = Math.min(100, Math.max(0, deductionPct));
    const buildSaveData = (): TransactionUpdate => {
      const data: TransactionUpdate = {
        quick_label: selectedLabel ? selectedLabel.slice(0, maxQuickLabel) : undefined,
        business_purpose:
          selectedLabel === "Personal"
            ? ""
            : businessPurpose
            ? businessPurpose.slice(0, maxTextField)
            : undefined,
        notes: notes ? notes.slice(0, maxTextField) : undefined,
        deduction_percent: normalizedDeduction,
        category: selectedCategory,
        schedule_c_line: selectedScheduleLine,
      };

      const categoryChanged =
        selectedScheduleLine !== (transaction.schedule_c_line ?? null) ||
        selectedCategory !== (transaction.category ?? null);

      if (!isIncomeLike) {
        // Expense: mirror existing behavior — "Personal" label marks personal, otherwise completed
        if (selectedLabel === "Personal") {
          data.status = "personal";
        } else if (categoryChanged || selectedLabel || businessPurpose) {
          data.status = "completed";
        }
      } else {
        // Income-like: classification chooses status / type
        if (incomeTreatment === "business") {
          data.transaction_type = "income";
          data.status = "completed";
        } else if (incomeTreatment === "personal") {
          data.status = "personal";
        }
      }

      return data;
    };

    function handleApprove() {
      const saveData = buildSaveData();
      const hasAnyChange =
        !!saveData.status ||
        !!saveData.transaction_type ||
        !!saveData.quick_label ||
        !!saveData.business_purpose ||
        !!saveData.notes ||
        !!saveData.category ||
        !!saveData.schedule_c_line ||
        saveData.deduction_percent !== undefined;

      if (!hasAnyChange) {
        return;
      }

      onSave(saveData, { applyToSimilar: autoSort && similarTransactions.length > 0 });
    }

    async function handleMarkPersonalClick() {
      // For income-like transactions, "Personal" is just a selection; saving is still done via Save / "s"
      if (isIncomeLike) {
        setIncomeTreatment("personal");
        return;
      }
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
        const digit = key.length === 1 && /^[0-9]$/.test(key) ? key : null;
        if (digit !== null) {
          e.preventDefault();
          e.stopImmediatePropagation();
          const byLine = EXPENSE_CATEGORIES.find((c) => c.line === digit);
          const idx = byLine
            ? EXPENSE_CATEGORIES.indexOf(byLine)
            : digit === "0"
              ? 9
              : parseInt(digit, 10) - 1;
          if (idx >= 0 && idx < EXPENSE_CATEGORIES.length) {
            const c = EXPENSE_CATEGORIES[idx];
            setSelectedScheduleLine(c.line);
            setSelectedCategory(c.name);
            setCategoryPickerOpen(false);
          }
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
      if (!isActive || categoryPickerOpen) return;
      function handleKey(e: KeyboardEvent) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        const key = e.key;
        // Let Similar Transactions popup handle o / y when it is open
        if (similarPopupOpen && (key === "o" || key === "O" || key === "y" || key === "Y")) return;
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
        if (key === "q" || key === "Q" || key === "e" || key === "E" || key === "t" || key === "T" || key === "y" || key === "Y" || key === "u" || key === "U") {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (key === "q" || key === "Q") setDeductionPct(0);
          else if (key === "e" || key === "E") setDeductionPct(25);
          else if (key === "t" || key === "T") setDeductionPct(50);
          else if (key === "y" || key === "Y") setDeductionPct(75);
          else if (key === "u" || key === "U") setDeductionPct(100);
          return;
        }
        if (key === "b" || key === "B") {
          e.preventDefault();
          e.stopImmediatePropagation();
          setShowDeductionControls(true);
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
    }, [isActive, categoryPickerOpen, onDelete, selectedScheduleLine, transaction.schedule_c_line, similarPopupOpen]);

    const isAiCategorized = transaction.schedule_c_line != null || transaction.ai_confidence != null;
    const displayCategory = selectedCategory ?? transaction.category ?? null;
    const effectiveLine = selectedScheduleLine ?? transaction.schedule_c_line ?? null;
    const displayCategoryName =
      EXPENSE_CATEGORIES.find((c) => c.line === effectiveLine)?.name ?? displayCategory ?? "Uncategorized";

    // Keyboard shortcuts for income classification (business vs personal)
    useEffect(() => {
      if (!isActive || !isIncomeLike) return;
      function handleKey(e: KeyboardEvent) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        const key = e.key;
        if (key === "b" || key === "B") {
          e.preventDefault();
          e.stopImmediatePropagation();
          setIncomeTreatment("business");
          return;
        }
        if (key === "p" || key === "P") {
          e.preventDefault();
          e.stopImmediatePropagation();
          setIncomeTreatment("personal");
        }
      }
      window.addEventListener("keydown", handleKey, true);
      return () => window.removeEventListener("keydown", handleKey, true);
    }, [isActive, isIncomeLike]);

    return (
      <div
        ref={cardRef}
        onClick={() => onFocus?.()}
        className={`border border-[#F0F1F7] bg-white transition-all duration-200 ${
          isActive
            ? "ring-1 ring-accent-sage/20 shadow-sm px-6 py-5"
            : "opacity-50 hover:opacity-75 px-6 py-4 cursor-pointer"
        }`}
      >
        {/* Header: vendor name + date + amount */}
        <div className="flex items-center gap-3 mb-0.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm text-mono-dark">{transaction.vendor}</p>
              <span className="text-[11px] text-mono-light">{formatDate(transaction.date)}</span>
            </div>
          </div>
          <span
            className={`text-sm font-semibold tabular-nums shrink-0 ${
              isIncomeLike ? "text-emerald-700" : "text-mono-dark"
            }`}
          >
            {isIncomeLike ? "+" : "-"}${amount.toFixed(2)}
          </span>
        </div>

        {/* Only show full content for active card */}
        {!isActive && (
          <div className="mt-2 text-[11px] text-mono-light">
            Click to review
          </div>
        )}

        {isActive && (
          <div className="mt-1.5 space-y-4">
            {/* Expense details: category + business percent */}
            {!isIncomeLike && (
              <div className="space-y-3 animate-in">
                {/* Category */}
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-medium text-mono-medium">Category</p>
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
                      className="flex items-center gap-1 text-[11px] text-mono-medium hover:text-mono-dark"
                    >
                      <kbd className="kbd-hint mr-1.5 text-[10px]">c</kbd>
                      {categoryPickerOpen ? "Close" : "Change"}
                    </button>
                  </div>
                  <p className="text-[11px] text-mono-medium mb-0.5">
                    {transaction.auto_sort_rule_id != null && "Past sort · "}
                    {displayCategoryName}
                  </p>
                  {!isAiCategorized && transaction.auto_sort_rule_id == null && (
                    <p className="text-[11px] text-amber-600">Not yet categorized by AI</p>
                  )}
                  {categoryPickerOpen && (
                    <div
                      ref={categoryListRef}
                      className="mt-1 z-10 w-full max-w-sm rounded-lg border border-bg-tertiary bg-white shadow-lg py-1 max-h-56 overflow-auto"
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

                {/* Meal cap warning (after category line) */}
                {isMeal && !isTravel && (
                  <div className="flex items-center gap-2 rounded-lg bg-sky-50 border border-sky-200/60 px-2.5 py-1.5 mb-1">
                    <span className="material-symbols-rounded text-sky-600 text-base">info</span>
                    <p className="text-[11px] text-sky-800">Meals outside travel typically 50%.</p>
                  </div>
                )}

                {/* Business percent */}
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-medium text-mono-medium">Business percent</p>
                    {!showDeductionControls && (
                      <button
                        type="button"
                        onClick={() => setShowDeductionControls(true)}
                        className="flex items-center gap-1 text-[11px] text-mono-medium hover:text-mono-dark"
                      >
                        <kbd className="kbd-hint mr-1">b</kbd>
                        Adjust
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-accent-sage font-medium mb-0.5">
                    {deductionPct === recommendedPct ? `Recommended: ${recommendedPct}%` : `Selected: ${deductionPct}%`}
                  </p>
                  <p className="text-[11px] text-mono-light tabular-nums mb-2">
                    Saves ~${(deductibleAmount * taxRate).toFixed(2)} at {deductionPct}% business
                  </p>
                  {showDeductionControls && (
                    <>
                      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                        <div className="flex items-center gap-2">
                          {SNAP_POINTS.map((pt) => {
                            let shortcut: string | null = null;
                            if (pt === 0) shortcut = "q";
                            else if (pt === 25) shortcut = "e";
                            else if (pt === 50) shortcut = "t";
                            else if (pt === 75) shortcut = "y";
                            else if (pt === 100) shortcut = "u";
                            return (
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
                                {shortcut && <kbd className="kbd-hint">{shortcut}</kbd>}
                                {pt}%
                              </button>
                            );
                          })}
                        </div>
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
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Income classification for income-like transactions */}
            {isIncomeLike && (
              <div className="space-y-3 animate-in">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-mono-medium">How should we treat this?</p>
                  <p className="text-xs text-mono-light">
                    This is money coming into your account. Mark business income to include it in your tax totals, or personal/transfer to ignore it.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setIncomeTreatment("business")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-medium transition ${
                      incomeTreatment === "business"
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "bg-white border-bg-tertiary text-mono-medium hover:bg-bg-secondary"
                    }`}
                  >
                    <kbd className="kbd-hint">b</kbd>
                    Business income
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncomeTreatment("personal")}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs font-medium transition ${
                      incomeTreatment === "personal"
                        ? "bg-mono-dark border-mono-dark text-white"
                        : "bg-white border-bg-tertiary text-mono-light hover:text-mono-dark hover:bg-bg-secondary"
                    }`}
                  >
                    <kbd className="kbd-hint">p</kbd>
                    Personal income
                  </button>
                </div>
              </div>
            )}

            {/* Reason / label and actions (shared for both types) */}
            <div className="space-y-4 animate-in">
                {/* Quick label suggestions with keyboard hints */}
                {suggestions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-mono-medium mb-2">
                      {isIncomeLike ? "Where is this income coming from?" : "Select a reason"}
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
                      placeholder={isIncomeLike ? "Who paid you, and what for?" : "Write your business purpose..."}
                      className="w-full border border-bg-tertiary rounded-lg p-3 text-xs bg-white focus:ring-1 focus:ring-accent-sage/30 focus:border-accent-sage/40 outline-none resize-none"
                      rows={2}
                    />
                  </div>
                )}

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
                      Also apply to {similarTransactions.length} other{similarTransactions.length === 1 ? "" : "s"} from {transaction.vendor}
                    </span>
                  </label>
                )}

                {/* Action row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {!isIncomeLike && (
                    <button
                      type="button"
                      onClick={() => onMarkPersonal()}
                      disabled={saving}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-white border border-bg-tertiary px-3 py-2.5 text-xs font-medium text-mono-light hover:text-mono-dark hover:bg-bg-secondary transition disabled:opacity-40"
                      title="Mark as personal (removes from inbox)"
                    >
                      <kbd className="kbd-hint">p</kbd>
                      Personal
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={
                      saving ||
                      (isIncomeLike && incomeTreatment == null) ||
                      (!isIncomeLike && !selectedLabel && !businessPurpose)
                    }
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent-terracotta-dark)] border border-[var(--color-accent-terracotta-dark)]/80 px-4 py-2.5 text-xs font-medium text-white hover:opacity-90 transition disabled:opacity-40"
                  >
                    Save
                    <kbd className="kbd-hint !bg-white/20 !text-white !border-white/30 ml-1">s</kbd>
                  </button>
                  {/* Secondary personal button removed to avoid duplication */}
                  <button
                    type="button"
                    onClick={() => onOpenManage?.(transaction)}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-white border border-bg-tertiary px-3 py-2.5 text-xs font-medium text-mono-medium hover:bg-bg-secondary transition"
                    title="View details"
                  >
                    <span className="material-symbols-rounded text-[16px]">tune</span>
                    <kbd className="kbd-hint">Enter</kbd>
                  </button>
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete()}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-white border border-red-200 px-3 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                      title="Delete transaction"
                    >
                      <span className="material-symbols-rounded text-[16px]">backspace</span>
                      <kbd className="kbd-hint">⌫</kbd>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
      </div>
    );
  },
);
