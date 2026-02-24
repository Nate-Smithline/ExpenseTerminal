"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Database } from "@/lib/types/database";
import { normalizeVendor } from "@/lib/vendor-matching";
import { TaxYearSelector } from "@/components/TaxYearSelector";
import { UploadModal } from "@/components/UploadModal";
import { TransactionCard } from "@/components/TransactionCard";
import type { TransactionUpdate, TransactionCardRef } from "@/components/TransactionCard";
import { TransactionDetailPanel } from "@/components/TransactionDetailPanel";
import { SimilarTransactionsPopup } from "@/components/SimilarTransactionsPopup";

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
  const url = `/api/transactions?${qs}`;
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  // #region agent log
  fetch("http://127.0.0.1:7865/ingest/9d58918a-6794-4604-b799-6ec1d4d0bcb4", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c912a5" },
    body: JSON.stringify({
      sessionId: "c912a5",
      runId: "pre-fix",
      hypothesisId: "H3",
      location: "InboxPageClient:fetchTransactions",
      message: "client_fetch_transactions_result",
      data: { ok: res.ok, status: res.status, dataLength: (body.data ?? []).length },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  if (!res.ok) return [];
  return body.data ?? [];
}

async function fetchCount(params: Record<string, string>): Promise<number> {
  const qs = new URLSearchParams({ ...params, count_only: "true" }).toString();
  const url = `/api/transactions?${qs}`;
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  // #region agent log
  fetch("http://127.0.0.1:7865/ingest/9d58918a-6794-4604-b799-6ec1d4d0bcb4", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c912a5" },
    body: JSON.stringify({
      sessionId: "c912a5",
      runId: "pre-fix",
      hypothesisId: "H3",
      location: "InboxPageClient:fetchCount",
      message: "client_fetch_count_result",
      data: { ok: res.ok, status: res.status, count: body.count ?? 0 },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  if (!res.ok) return 0;
  return body.count ?? 0;
}

async function fetchUnanalyzedIds(params: Record<string, string>): Promise<string[]> {
  const limit = 1000;
  let offset = 0;
  const allIds: string[] = [];

  // Fetch in batches until fewer than `limit` rows are returned
  // or we hit the offset ceiling enforced by the API.
  // This ensures we analyze all remaining transactions, not just the first page.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const qs = new URLSearchParams({
      ...params,
      analyzed_only: "false",
      limit: String(limit),
      offset: String(offset),
    }).toString();
    const res = await fetch(`/api/transactions?${qs}`);
    if (!res.ok) {
      throw new Error("Failed to load unanalyzed transactions");
    }
    const body = await res.json();
    const data = (body.data ?? []) as { id: string }[];
    const batchIds = data.map((t) => t.id);
    allIds.push(...batchIds);
    if (batchIds.length < limit) break;
    offset += limit;
  }

  return allIds;
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
  const [similarPopup, setSimilarPopup] = useState<{
    transaction: Transaction;
    update: TransactionUpdate;
    similarTransactions: Transaction[];
  } | null>(null);
  const [applyingSimilar, setApplyingSimilar] = useState(false);

  const [undoState, setUndoState] = useState<{
    id: string;
    previous: Transaction;
    expiresAt: number;
  } | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);

  const [dismissedDuplicateKeys, setDismissedDuplicateKeys] = useState<Set<string>>(new Set());

  const [aiProgress, setAiProgress] = useState<{ completed: number; total: number; current: string } | null>(null);
  const [aiStalled, setAiStalled] = useState(false);

  const cardRefs = useRef<Map<string, TransactionCardRef>>(new Map());

  useEffect(() => {
    if (!undoState) {
      setUndoSecondsLeft(0);
      return;
    }

    // #region agent log
    fetch("http://127.0.0.1:7865/ingest/9d58918a-6794-4604-b799-6ec1d4d0bcb4", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "4318a3",
      },
      body: JSON.stringify({
        sessionId: "4318a3",
        runId: "pre-fix",
        hypothesisId: "H1",
        location: "InboxPageClient:undoEffect",
        message: "undo_effect_start",
        data: {
          hasUndoState: !!undoState,
          expiresAt: undoState.expiresAt,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    const expiresAt = undoState.expiresAt;

    function tick() {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setUndoSecondsLeft(remaining);
      if (remaining <= 0) {
        setUndoState(null);
      }
    }

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [undoState]);

  function duplicateKey(t: Transaction): string {
    return `${t.date}|${t.amount}|${t.vendor ?? ""}`;
  }

  const duplicateGroups = (() => {
    const byKey = new Map<string, Transaction[]>();
    for (const t of transactions) {
      const key = duplicateKey(t);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(t);
    }
    const groups: Transaction[][] = [];
    for (const [, group] of byKey) {
      if (group.length >= 2) {
        const sorted = [...group].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
        groups.push(sorted);
      }
    }
    return groups;
  })();

  const visibleDuplicateGroups = duplicateGroups.filter(
    (group) => group.length >= 2 && !dismissedDuplicateKeys.has(duplicateKey(group[0])),
  );

  const reloadInbox = useCallback(async () => {
    // #region agent log
    fetch("http://127.0.0.1:7865/ingest/9d58918a-6794-4604-b799-6ec1d4d0bcb4", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c912a5" },
      body: JSON.stringify({
        sessionId: "c912a5",
        runId: "pre-fix",
        hypothesisId: "H4",
        location: "InboxPageClient:reloadInbox_start",
        message: "reload_inbox_start",
        data: { selectedYear },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
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
    // #region agent log
    fetch("http://127.0.0.1:7865/ingest/9d58918a-6794-4604-b799-6ec1d4d0bcb4", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c912a5" },
      body: JSON.stringify({
        sessionId: "c912a5",
        runId: "pre-fix",
        hypothesisId: "H4",
        location: "InboxPageClient:reloadInbox_done",
        message: "reload_inbox_done",
        data: { txsLength: txs.length, count, unanalyzed },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    setTransactions(txs);
    setPendingCount(count);
    setUnanalyzedCount(unanalyzed);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("inbox-count-changed"));
    }
  }, [selectedYear]);

  function runBackgroundAI(txIds: string[]): Promise<{ ok: boolean; error?: string }> {
    if (txIds.length === 0) return Promise.resolve({ ok: true });

    setAiProgress({ completed: 0, total: txIds.length, current: "Starting..." });
    const lastEventAt = { current: Date.now() };
    const stalledCheckRef = { id: null as ReturnType<typeof setInterval> | null };

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
          setAiStalled(false);
          if (stalledCheckRef.id != null) clearInterval(stalledCheckRef.id);
          setToast(msg);
          setTimeout(() => setToast(null), 5000);
          return { ok: false, error: msg };
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // Stall detection: if no event for 90s, show "taking longer" and offer refresh
        stalledCheckRef.id = setInterval(() => {
          if (Date.now() - lastEventAt.current > 90_000) {
            setAiStalled(true);
            if (stalledCheckRef.id != null) {
              clearInterval(stalledCheckRef.id);
              stalledCheckRef.id = null;
            }
          }
        }, 10_000);

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            lastEventAt.current = Date.now();
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const event = JSON.parse(line) as Record<string, unknown>;
                if (event.type === "progress") {
                  setAiProgress((prev) => {
                    const completed = (event.completed as number) ?? 0;
                    const total = (event.total as number) ?? txIds.length;
                    const current = (event.current as string) ?? "";
                    return {
                      completed: prev ? Math.max(prev.completed, completed) : completed,
                      total,
                      current,
                    };
                  });
                } else if (event.type === "success") {
                  setAiProgress((prev) =>
                    prev
                      ? {
                          ...prev,
                          completed: Math.min(prev.completed + 1, prev.total),
                          current: prev.current || "Categorizing...",
                        }
                      : null,
                  );
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
                  if (stalledCheckRef.id != null) {
                    clearInterval(stalledCheckRef.id);
                    stalledCheckRef.id = null;
                  }
                  setAiStalled(false);
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
        if (stalledCheckRef.id != null) {
          clearInterval(stalledCheckRef.id);
        }
        setAiStalled(false);
        setAiProgress(null);
        return { ok: true };
      } catch (e) {
        setAiStalled(false);
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
      const allIds = await fetchUnanalyzedIds({
        tax_year: String(selectedYear),
        status: "pending",
        transaction_type: "expense",
      });
      if (allIds.length === 0) {
        setToast("No transactions need analysis");
        setTimeout(() => setToast(null), 3000);
        return;
      }
      const batchSize = 1000;
      for (let i = 0; i < allIds.length; i += batchSize) {
        const batch = allIds.slice(i, i + batchSize);
        const result = await runBackgroundAI(batch);
        if (!result.ok) {
          setToast(result.error ?? "Bulk analysis failed");
          setTimeout(() => setToast(null), 5000);
          break;
        }
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

  function notifyInboxCountChanged() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("inbox-count-changed"));
    }
  }

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

    // Set undo window for this save (5 seconds, last transaction only)
    setUndoState({
      id,
      previous: tx,
      expiresAt: Date.now() + 5000,
    });
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setPendingCount((prev) => Math.max(prev - 1, 0));
    (async () => {
      try {
        const res = await fetch("/api/transactions/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...update }),
        });
        if (!res.ok) {
          let message = "Failed to save";
          try {
            const body = (await res.json()) as { error?: string };
            message = body.error ?? res.statusText ?? message;
          } catch {
            message = res.statusText || message;
          }
          throw new Error(message);
        }
        if (opts?.applyToSimilar) {
          await handleApplyToAllSimilar(tx, update);
        } else {
          const similar = await handleCheckSimilar(tx.vendor, id);
          if (similar.length > 0) {
            setSimilarPopup({
              transaction: tx,
              update,
              similarTransactions: similar,
            });
          }
        }
        notifyInboxCountChanged();
      } catch (e) {
        setUndoState(null);
        setTransactions((prev) => [...prev, tx]);
        setPendingCount((prev) => prev + 1);
        const message = e instanceof Error ? e.message : "Failed to save";
        // eslint-disable-next-line no-console
        console.warn("[inbox] save failed", { id, update, error: message });
        setToast(message);
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
        if (!res.ok) {
          let message = "Failed to delete";
          try {
            const body = (await res.json()) as { error?: string };
            message = body.error ?? res.statusText ?? message;
          } catch {
            message = res.statusText || message;
          }
          throw new Error(message);
        }
        notifyInboxCountChanged();
      } catch (e) {
        setTransactions((prev) => {
          const next = [...prev];
          next.splice(idx, 0, tx);
          return next;
        });
        setPendingCount((prev) => prev + 1);
        const message = e instanceof Error ? e.message : "Failed to delete";
        // eslint-disable-next-line no-console
        console.warn("[inbox] delete failed", { id, error: message });
        setToast(message);
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
      const isPersonal = data.quick_label === "Personal" || (data.deduction_percent === 0);
      const quickLabel = isPersonal
        ? "Personal"
        : (data.quick_label || data.business_purpose || "Business expense");
      const res = await fetch("/api/transactions/auto-sort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorNormalized: transaction.vendor_normalized ?? normalizeVendor(transaction.vendor),
          quickLabel,
          businessPurpose: isPersonal ? "" : (data.business_purpose ?? ""),
          category: data.category ?? transaction.category ?? undefined,
          taxYear: selectedYear,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; updatedCount?: number };
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to apply to all");
      }
      setToast(`${body.updatedCount ?? 0} transaction${(body.updatedCount ?? 0) === 1 ? "" : "s"} auto-sorted`);
      setTimeout(() => setToast(null), 4000);
      await reloadInbox();
    },
    [selectedYear, reloadInbox],
  );

  const handleUndoLast = useCallback(async () => {
    if (!undoState) return;
    const { previous, id } = undoState;
    setUndoState(null);

    setTransactions((prev) => [previous, ...prev]);
    setPendingCount((prev) => prev + 1);

    try {
      const body: Record<string, unknown> = { id };
      if (previous.quick_label != null) body.quick_label = previous.quick_label;
      if (previous.business_purpose != null) body.business_purpose = previous.business_purpose;
      if (previous.notes != null) body.notes = previous.notes;
      if (previous.status != null) body.status = previous.status;
      if (previous.deduction_percent != null) body.deduction_percent = previous.deduction_percent;
      if (previous.category !== undefined) body.category = previous.category ?? null;
      if (previous.schedule_c_line !== undefined) body.schedule_c_line = previous.schedule_c_line ?? null;

      const res = await fetch("/api/transactions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let message = "Failed to undo";
        try {
          const body = (await res.json()) as { error?: string };
          message = body.error ?? res.statusText ?? message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      notifyInboxCountChanged();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to undo";
      // eslint-disable-next-line no-console
      console.warn("[inbox] undo failed", { id, error: message });
      setToast(message);
      setTimeout(() => setToast(null), 4000);
    }
  }, [undoState, notifyInboxCountChanged, setTransactions, setPendingCount]);

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
        case "z":
          if (undoState) {
            e.preventDefault();
            void handleUndoLast();
          }
          break;
        case "d":
          e.preventDefault();
          activeCard?.cycleDeduction();
          break;
        case "u":
          e.preventDefault();
          setUploadOpen(true);
          break;
        case "e":
          e.preventDefault();
          if (unanalyzedCount > 0 && !bulkAnalyzing) runBulkAnalyze();
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
  }, [activeIdx, transactions, manageTx, unanalyzedCount, bulkAnalyzing, undoState, handleUndoLast]);

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
        <TaxYearSelector
          value={selectedYear}
          onChange={(y) => setSelectedYear(y)}
          label="Tax year"
          compact={false}
        />
        <button
          onClick={() => setUploadOpen(true)}
          className="btn-primary"
        >
          Upload CSV
          <kbd className="kbd-hint ml-1.5">u</kbd>
        </button>
        <button
          onClick={() => setShowShortcuts((v) => !v)}
          type="button"
          className="inline-flex items-center text-sm text-mono-medium hover:text-mono-dark"
          title="Keyboard shortcuts"
        >
          <kbd className="kbd-hint mr-1.5">?</kbd> Shortcuts
        </button>
      </div>

      {/* Background AI progress banner */}
      {aiProgress && (
        <div className="card px-5 py-3 flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <div className="h-2 flex-1 rounded-full bg-bg-tertiary overflow-hidden">
              <div
                className="h-full bg-accent-sage transition-all duration-500 ease-out"
                style={{ width: `${aiProgress.total > 0 ? Math.round((aiProgress.completed / aiProgress.total) * 100) : 0}%` }}
              />
            </div>
            <span className="text-xs text-accent-sage font-medium shrink-0 tabular-nums">
              AI: {aiProgress.completed}/{aiProgress.total}
            </span>
            <span className="text-xs text-mono-light truncate max-w-[200px]">{aiProgress.current}</span>
          </div>
          {aiStalled && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-bg-tertiary/40">
              <span className="text-xs text-mono-medium">This is taking longer than usual. You can refresh and run examination again, or keep waiting.</span>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="text-xs font-medium text-accent-sage hover:underline"
              >
                Refresh page
              </button>
              <button
                type="button"
                onClick={() => setAiStalled(false)}
                className="text-xs font-medium text-mono-medium hover:text-mono-dark"
              >
                Keep waiting
              </button>
            </div>
          )}
        </div>
      )}

      {/* Unanalyzed: need AI before they appear in inbox */}
      {!loading && unanalyzedCount > 0 && !aiProgress && (
        <div className="rounded-xl border border-bg-tertiary/40 bg-white p-6 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-mono-dark mb-1">
              AI categorization needed
            </h3>
            <p className="text-sm text-mono-medium">
              <strong>{unanalyzedCount}</strong> transaction{unanalyzedCount === 1 ? "" : "s"} need examination before they appear in the inbox.
            </p>
          </div>
          <div className="pt-1">
            <button
              type="button"
              onClick={runBulkAnalyze}
              disabled={bulkAnalyzing}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-sage px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-sage/90 transition disabled:opacity-40"
            >
              {bulkAnalyzing ? "Analyzing…" : "Start examination"}
              <kbd className="kbd-hint ml-1.5 !bg-white/20 !text-white !border-white/30">e</kbd>
            </button>
          </div>
        </div>
      )}

      {/* Undo + Toast */}
      <div className="space-y-3">
        {undoState && (
          <div className="flex items-center justify-between rounded-lg bg-mono-dark px-4 py-2.5 text-sm text-white">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span>Last sort saved.</span>
              {undoSecondsLeft > 0 && (
                <span className="text-white/70">
                  Undo available for {undoSecondsLeft}s.
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleUndoLast()}
              className="inline-flex items-center gap-1 rounded-full border border-white/40 px-3 py-1.5 text-xs font-semibold hover:bg-white/10 transition"
            >
              Undo
              <kbd className="kbd-hint kbd-on-primary ml-1">z</kbd>
            </button>
          </div>
        )}

        {toast && (
          <div className="rounded-lg bg-accent-sage px-4 py-2.5 text-sm font-medium text-white">
            {toast}
          </div>
        )}
      </div>

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
              ["z", "Undo last sort (5s)"],
              ["⌫ / Del", "Delete transaction"],
              ["u", "Upload CSV"],
              ["e", "Start examination (when unanalyzed)"],
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

      {/* Possible duplicates */}
      {!loading && visibleDuplicateGroups.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-mono-dark">Possible duplicates</h3>
          {visibleDuplicateGroups.map((group) => {
            const key = duplicateKey(group[0]);
            const first = group[0];
            return (
              <div
                key={key}
                className="rounded-xl border border-bg-tertiary/60 bg-white p-4 space-y-3"
              >
                <p className="text-xs text-mono-medium">
                  {group.length} transactions with same date, amount, and vendor
                </p>
                <ul className="text-xs text-mono-dark space-y-1">
                  {group.map((t) => (
                    <li key={t.id}>
                      {t.vendor} — {t.date} — ${Number(t.amount).toFixed(2)}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleDelete(first.id);
                    }}
                    className="rounded-lg px-3 py-2 text-xs font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition"
                  >
                    Mark as duplicate (remove first)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDismissedDuplicateKeys((prev) => new Set(prev).add(key));
                    }}
                    className="rounded-lg px-3 py-2 text-xs font-medium bg-bg-secondary text-mono-medium border border-bg-tertiary hover:bg-bg-tertiary/60 transition"
                  >
                    Not a duplicate (keep all)
                  </button>
                </div>
              </div>
            );
          })}
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
              ? "Start examination above to categorize them, or upload a CSV."
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

      {/* Similar transactions popup (after save without "apply to similar") */}
      {similarPopup && (
        <SimilarTransactionsPopup
          vendor={similarPopup.transaction.vendor}
          transactions={similarPopup.similarTransactions}
          quickLabel={similarPopup.update.quick_label ?? ""}
          businessPurpose={similarPopup.update.business_purpose ?? ""}
          deductionPercent={similarPopup.update.deduction_percent ?? null}
          onCancel={() => setSimilarPopup(null)}
          onJustThisOne={() => setSimilarPopup(null)}
          onApplyToAll={async () => {
            setApplyingSimilar(true);
            try {
              await handleApplyToAllSimilar(similarPopup.transaction, similarPopup.update);
              setSimilarPopup(null);
            } catch (err) {
              const message = err instanceof Error ? err.message : "Apply to all failed";
              setToast(message);
              setTimeout(() => setToast(null), 5000);
            } finally {
              setApplyingSimilar(false);
            }
          }}
          applying={applyingSimilar}
        />
      )}
    </div>
  );
}
