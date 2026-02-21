"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Database } from "@/lib/types/database";
import { normalizeVendor } from "@/lib/vendor-matching";
import { persistTaxYear } from "@/lib/tax-year-cookie";
import { UploadModal } from "@/components/UploadModal";
import { TransactionCard } from "@/components/TransactionCard";
import type { TransactionUpdate, TransactionCardRef } from "@/components/TransactionCard";
import { TransactionDetailPanel } from "@/components/TransactionDetailPanel";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

interface InboxPageClientProps {
  initialYear: number;
  initialPendingCount: number;
  initialUnanalyzedCount?: number;
  initialTransactions: Transaction[];
  userId: string;
  taxRate?: number;
}

async function fetchTransactions(params: Record<string, string>): Promise<Transaction[]> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/transactions?${qs}`);
  if (!res.ok) return [];
  const body = await res.json();
  return body.data ?? [];
}

async function fetchCount(params: Record<string, string>): Promise<number> {
  const qs = new URLSearchParams({ ...params, count_only: "true" }).toString();
  const res = await fetch(`/api/transactions?${qs}`);
  if (!res.ok) return 0;
  const body = await res.json();
  return body.count ?? 0;
}

async function fetchUnanalyzedIds(params: Record<string, string>): Promise<string[]> {
  const qs = new URLSearchParams({ ...params, analyzed_only: "false", limit: "500" }).toString();
  const res = await fetch(`/api/transactions?${qs}`);
  if (!res.ok) return [];
  const body = await res.json();
  const data = body.data ?? [];
  return data.map((t: { id: string }) => t.id);
}

export function InboxPageClient({
  initialYear,
  initialPendingCount,
  initialUnanalyzedCount = 0,
  initialTransactions,
  userId,
  taxRate = 0.24,
}: InboxPageClientProps) {
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [pendingCount, setPendingCount] = useState(initialPendingCount);
  const [unanalyzedCount, setUnanalyzedCount] = useState(initialUnanalyzedCount);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [manageTx, setManageTx] = useState<Transaction | null>(null);
  const [bulkAnalyzing, setBulkAnalyzing] = useState(false);

  const [aiProgress, setAiProgress] = useState<{ completed: number; total: number; current: string } | null>(null);

  const cardRefs = useRef<Map<string, TransactionCardRef>>(new Map());

  const reloadInbox = useCallback(async () => {
    const [txs, count, unanalyzed] = await Promise.all([
      fetchTransactions({
        tax_year: String(selectedYear),
        status: "pending",
        transaction_type: "expense",
        limit: "50",
      }),
      fetchCount({
        tax_year: String(selectedYear),
        status: "pending",
        transaction_type: "expense",
      }),
      fetchCount({
        tax_year: String(selectedYear),
        status: "pending",
        transaction_type: "expense",
        analyzed_only: "false",
      }),
    ]);
    setTransactions(txs);
    setPendingCount(count);
    setUnanalyzedCount(unanalyzed);
  }, [selectedYear]);

  function runBackgroundAI(txIds: string[]): Promise<{ ok: boolean; error?: string }> {
    if (txIds.length === 0) return Promise.resolve({ ok: true });

    setAiProgress({ completed: 0, total: txIds.length, current: "Starting..." });

    return (async () => {
      try {
        const res = await fetch("/api/transactions/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionIds: txIds }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const msg = (errBody as { error?: string }).error ?? res.statusText ?? "Analysis failed";
          setAiProgress(null);
          setToast(msg);
          setTimeout(() => setToast(null), 5000);
          return { ok: false, error: msg };
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const event = JSON.parse(line) as Record<string, unknown>;
                if (event.type === "progress") {
                  setAiProgress({
                    completed: (event.completed as number) ?? 0,
                    total: (event.total as number) ?? txIds.length,
                    current: (event.current as string) ?? "",
                  });
                } else if (event.type === "success") {
                  setTransactions((prev) =>
                    prev.map((t) =>
                      t.id === event.id
                        ? {
                            ...t,
                            category: (event.category as string) ?? t.category,
                            schedule_c_line: (event.line as string) ?? t.schedule_c_line,
                            ai_confidence: (event.confidence as number) ?? t.ai_confidence,
                            ai_suggestions: (event.quickLabels as string[]) ?? t.ai_suggestions,
                            deduction_percent: (event.deductionPct as number) ?? t.deduction_percent,
                            is_meal: (event.isMeal as boolean) ?? t.is_meal,
                            is_travel: (event.isTravel as boolean) ?? t.is_travel,
                          }
                        : t,
                    ),
                  );
                } else if (event.type === "done") {
                  setAiProgress(null);
                  const s = (event.successful as number) ?? 0;
                  const c = (event.cachedCount as number) ?? 0;
                  if (c > 0) {
                    setToast(`${s} categorized (${c} from cache)`);
                  } else if (s > 0) {
                    setToast(`${s} categorized by AI`);
                  }
                  setTimeout(() => setToast(null), 4000);
                  await reloadInbox();
                } else if (event.type === "error") {
                  setToast((event.message as string) ?? "AI analysis error");
                  setTimeout(() => setToast(null), 4000);
                }
              } catch { /* skip */ }
            }
          }
        }
        setAiProgress(null);
        return { ok: true };
      } catch (e) {
        setAiProgress(null);
        const msg = e instanceof Error ? e.message : "AI analysis failed";
        setToast(msg);
        setTimeout(() => setToast(null), 5000);
        return { ok: false, error: msg };
      }
    })();
  }

  async function runBulkAnalyze() {
    setBulkAnalyzing(true);
    try {
      const ids = await fetchUnanalyzedIds({
        tax_year: String(selectedYear),
        status: "pending",
        transaction_type: "expense",
      });
      if (ids.length === 0) {
        setToast("No transactions need analysis");
        setTimeout(() => setToast(null), 3000);
        return;
      }
      const result = await runBackgroundAI(ids);
      if (!result.ok) {
        setToast(result.error ?? "Bulk analysis failed");
        setTimeout(() => setToast(null), 5000);
      }
    } finally {
      setBulkAnalyzing(false);
    }
  }

  async function handleReanalyze(id: string) {
    try {
      const res = await fetch("/api/transactions/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionIds: [id] }),
      });
      if (!res.ok) return;

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line) as Record<string, unknown>;
              if (event.type === "success") {
                setToast(`Categorized: ${event.category}`);
                setTimeout(() => setToast(null), 3000);
              }
              if (event.type === "done") await reloadInbox();
            } catch { /* skip */ }
          }
        }
      }
    } catch {
      setToast("Re-analysis failed");
      setTimeout(() => setToast(null), 3000);
    }
  }

  useEffect(() => {
    setLoading(true);
    reloadInbox().finally(() => setLoading(false));
  }, [reloadInbox]);

  function handleSave(
    id: string,
    update: {
      quick_label?: string;
      business_purpose?: string;
      notes?: string;
      status?: "completed" | "personal";
      deduction_percent?: number;
      category?: string | null;
      schedule_c_line?: string | null;
    },
    opts?: { applyToSimilar?: boolean },
  ) {
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setPendingCount((prev) => Math.max(prev - 1, 0));
    (async () => {
      try {
        const res = await fetch("/api/transactions/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...update }),
        });
        if (!res.ok) throw new Error("Update failed");
        if (opts?.applyToSimilar) {
          await handleApplyToAllSimilar(tx, update);
        }
      } catch {
        setTransactions((prev) => [...prev, tx]);
        setPendingCount((prev) => prev + 1);
        setToast("Failed to save");
        setTimeout(() => setToast(null), 4000);
      }
    })();
  }

  async function handleMarkPersonal(id: string) {
    handleSave(id, { status: "personal", deduction_percent: 0 });
  }

  function handleDelete(id: string) {
    const tx = transactions.find((t) => t.id === id);
    const idx = transactions.findIndex((t) => t.id === id);
    if (!tx) return;
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setPendingCount((prev) => Math.max(prev - 1, 0));
    (async () => {
      try {
        const res = await fetch("/api/transactions/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) throw new Error("Delete failed");
      } catch {
        setTransactions((prev) => {
          const next = [...prev];
          next.splice(idx, 0, tx);
          return next;
        });
        setPendingCount((prev) => prev + 1);
        setToast("Failed to delete");
        setTimeout(() => setToast(null), 4000);
      }
    })();
  }

  const handleCheckSimilar = useCallback(
    async (vendor: string, excludeId: string): Promise<Transaction[]> => {
      return fetchTransactions({
        tax_year: String(selectedYear),
        status: "pending",
        transaction_type: "expense",
        vendor_normalized: normalizeVendor(vendor),
        exclude_id: excludeId,
      });
    },
    [selectedYear],
  );

  const handleApplyToAllSimilar = useCallback(
    async (transaction: Transaction, data: TransactionUpdate) => {
      const res = await fetch("/api/transactions/auto-sort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorNormalized: transaction.vendor_normalized ?? normalizeVendor(transaction.vendor),
          quickLabel: data.quick_label,
          businessPurpose: data.business_purpose,
          category: data.category ?? transaction.category ?? undefined,
          deductionPercent: data.deduction_percent,
          taxYear: selectedYear,
        }),
      });
      if (!res.ok) throw new Error("Failed to apply to all");
      const { updatedCount } = await res.json();
      setToast(`${updatedCount} transaction${updatedCount === 1 ? "" : "s"} auto-sorted`);
      setTimeout(() => setToast(null), 4000);
      await reloadInbox();
    },
    [selectedYear, reloadInbox],
  );

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const activeCard = transactions[activeIdx] ? cardRefs.current.get(transactions[activeIdx].id) : null;

      switch (e.key) {
        case "j":
          e.preventDefault();
          setActiveIdx((prev) => Math.min(prev + 1, transactions.length - 1));
          break;
        case "k":
          e.preventDefault();
          setActiveIdx((prev) => Math.max(prev - 1, 0));
          break;
        case "1": case "2": case "3": case "4":
          e.preventDefault();
          activeCard?.selectLabel(Number(e.key) - 1);
          break;
        case "p":
          e.preventDefault();
          activeCard?.markPersonal();
          break;
        case "w":
          e.preventDefault();
          activeCard?.focusBusiness();
          break;
        case "b":
          e.preventDefault();
          activeCard?.focusBusiness();
          break;
        case "s":
          e.preventDefault();
          activeCard?.save();
          break;
        case "d":
          e.preventDefault();
          activeCard?.cycleDeduction();
          break;
        case "u":
          e.preventDefault();
          setUploadOpen(true);
          break;
        case "Enter":
          e.preventDefault();
          activeCard?.expand();
          break;
        case "Backspace":
        case "Delete":
          e.preventDefault();
          activeCard?.deleteTransaction();
          break;
        case "?":
          e.preventDefault();
          setShowShortcuts((v) => !v);
          break;
        case "Escape":
          if (manageTx) {
            setManageTx(null);
          } else {
            setShowShortcuts(false);
          }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIdx, transactions, manageTx]);

  useEffect(() => {
    if (activeIdx >= transactions.length && transactions.length > 0) {
      setActiveIdx(transactions.length - 1);
    }
  }, [transactions.length, activeIdx]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-mono-dark">Inbox</h1>
        <p className="text-sm text-mono-medium mt-1">
          {pendingCount} {pendingCount === 1 ? "item" : "items"} to review
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <select
          value={selectedYear}
          onChange={(e) => {
            const y = parseInt(e.target.value, 10);
            persistTaxYear(y);
            setSelectedYear(y);
          }}
          className="bg-white border border-bg-tertiary/60 rounded-full px-4 py-2 text-sm text-mono-dark"
        >
          {[0, 1, 2].map((i) => {
            const y = new Date().getFullYear() - i;
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>
        <button
          onClick={() => setUploadOpen(true)}
          className="btn-primary"
        >
          Upload CSV
        </button>
        <button
          onClick={() => setShowShortcuts((v) => !v)}
          className="btn-secondary text-xs"
          title="Keyboard shortcuts"
        >
          <kbd className="kbd-hint mr-1.5">?</kbd> Shortcuts
        </button>
      </div>

      {/* Background AI progress banner */}
      {aiProgress && (
        <div className="card px-5 py-3 flex items-center gap-4">
          <div className="h-2 flex-1 rounded-full bg-bg-tertiary overflow-hidden">
            <div
              className="h-full bg-accent-sage transition-all duration-300"
              style={{ width: `${aiProgress.total > 0 ? Math.round((aiProgress.completed / aiProgress.total) * 100) : 0}%` }}
            />
          </div>
          <span className="text-xs text-accent-sage font-medium shrink-0 tabular-nums">
            AI: {aiProgress.completed}/{aiProgress.total}
          </span>
          <span className="text-xs text-mono-light truncate max-w-[200px]">{aiProgress.current}</span>
        </div>
      )}

      {/* Unanalyzed: need AI before they appear in inbox */}
      {!loading && unanalyzedCount > 0 && !aiProgress && (
        <div className="card px-5 py-4 flex flex-wrap items-center justify-between gap-3 bg-amber-50 border border-amber-200/60">
          <p className="text-sm text-amber-900">
            <strong>{unanalyzedCount}</strong> transaction{unanalyzedCount === 1 ? "" : "s"} need AI categorization before they appear in the inbox.
          </p>
          <button
            type="button"
            onClick={runBulkAnalyze}
            disabled={bulkAnalyzing}
            className="btn-primary text-sm py-2"
          >
            {bulkAnalyzing ? "Analyzing…" : "Run AI on all"}
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="rounded-lg bg-accent-sage px-4 py-2.5 text-sm font-medium text-white">
          {toast}
        </div>
      )}

      {/* Keyboard shortcut overlay */}
      {showShortcuts && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-mono-dark">Keyboard Shortcuts</h3>
            <button onClick={() => setShowShortcuts(false)} className="text-xs text-mono-light hover:text-mono-dark">
              Close
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
            {[
              ["j / k", "Navigate up/down"],
              ["Enter", "Open detail panel"],
              ["0, 1, 2, 5, 7", "Set % (0%, 100%, 25%, 50%, 75%)"],
              ["1-4", "Select reason (step 2)"],
              ["c", "Change category (arrows + Enter)"],
              ["p", "Mark as personal"],
              ["a", "Toggle apply to similar"],
              ["w", "Write in purpose"],
              ["d", "Cycle deduction %"],
              ["s", "Next / Save"],
              ["⌫ / Del", "Delete transaction"],
              ["u", "Upload CSV"],
              ["?", "Toggle this help"],
              ["Esc", "Close overlays"],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center gap-3 py-0.5">
                <kbd className="kbd-hint min-w-[2.5rem] text-center">
                  {key}
                </kbd>
                <span className="text-mono-medium">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction list */}
      {loading && (
        <p className="text-sm text-mono-medium py-12 text-center">Loading transactions...</p>
      )}

      {!loading && transactions.length === 0 && (
        <div className="text-center py-20">
          <p className="text-base text-mono-medium mb-2">
            {unanalyzedCount > 0 ? "No transactions ready to review" : "No pending transactions"}
          </p>
          <p className="text-sm text-mono-light">
            {unanalyzedCount > 0
              ? "Run AI on the unanalyzed transactions above to categorize them, or upload a CSV."
              : "Upload a CSV to get started, or check All Activity for reviewed items."}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {transactions.map((t, i) => (
          <TransactionCard
            key={t.id}
            ref={(el) => {
              if (el) cardRefs.current.set(t.id, el);
              else cardRefs.current.delete(t.id);
            }}
            transaction={t}
            isActive={i === activeIdx}
            onFocus={() => setActiveIdx(i)}
            taxRate={taxRate}
            onSave={(data, opts) =>
              handleSave(t.id, {
                quick_label: data.quick_label,
                business_purpose: data.business_purpose,
                notes: data.notes,
                status: data.quick_label === "Personal" ? "personal" : "completed",
                deduction_percent: data.deduction_percent,
                category: data.category,
                schedule_c_line: data.schedule_c_line,
              }, opts)
            }
            onMarkPersonal={async () => handleMarkPersonal(t.id)}
            onDelete={async () => handleDelete(t.id)}
            onCheckSimilar={handleCheckSimilar}
            onApplyToAllSimilar={handleApplyToAllSimilar}
            onOpenManage={(tx) => setManageTx(tx)}
          />
        ))}
      </div>

      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onCompleted={async (result) => {
            setUploadOpen(false);
            if (result?.transactionIds && result.transactionIds.length > 0) {
              await runBackgroundAI(result.transactionIds);
            } else if (result?.imported !== undefined && result.imported === 0) {
              setToast("No transactions to import");
              setTimeout(() => setToast(null), 3000);
            }
            await reloadInbox();
          }}
        />
      )}

      {/* Transaction Detail Panel (Notion-style sidebar) */}
      {manageTx && (
        <TransactionDetailPanel
          transaction={manageTx}
          onClose={() => setManageTx(null)}
          onReanalyze={handleReanalyze}
          onMarkPersonal={async () => {
            await handleMarkPersonal(manageTx.id);
            setManageTx(null);
          }}
          taxRate={taxRate}
        />
      )}
    </div>
  );
}
