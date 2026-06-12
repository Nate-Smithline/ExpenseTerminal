"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MarkerPill, type Marker } from "@/components/MarkerPill";
import { MarkerEditor } from "@/components/MarkerEditor";
import { PartialDial } from "@/components/PartialDial";
import { IChevronD, IChevronR, IChevronU, IDrag, IPlus, IClose, ISearch, IExport, ISpark2, ITrash } from "@/components/ui/icons";
import { planLineMove, sortBudgetGroups, sortBudgetLines } from "@/lib/budget/line-order";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Txn {
  id: string;
  date: string;
  vendor: string;
  description: string | null;
  amount: number;
  transaction_type: "income" | "expense";
  marker: Marker;
  business_pct: number | null;
  business_purpose?: string | null;
  hint_vendor: string | null;
  category: string | null;
  schedule_c_line: string | null;
  status: string | null;
}

interface BudgetLineData {
  id: string;
  name: string;
  allocated: number | null;
  rolled_over: number;
  position: number;
  notes?: string | null;
  default_marker?: "Business" | "Personal" | "Partial" | null;
  default_business_pct?: number | null;
  budget_line_transactions: { transaction_id: string }[];
  actual?: number;
}

interface BudgetGroupData {
  id: string;
  name: string;
  position: number;
  kind?: "income" | "expense";
  budget_lines: BudgetLineData[];
}

interface BudgetData {
  month_id: string | null;
  groups: BudgetGroupData[];
  stats: { income: number; spending: number };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtMoney(n: number, showSign = false): string {
  const abs = Math.abs(n);
  const str = abs.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
  if (showSign && n < 0) return `−${str}`;
  if (showSign && n > 0) return `+${str}`;
  return str;
}

// Format a net total that can legitimately go negative (e.g. a refund netted
// against spending). Shows a leading minus for negatives, no plus for positives.
function fmtNet(n: number): string {
  return n < 0 ? `−${fmtMoney(Math.abs(n))}` : fmtMoney(n);
}

function fmtDate(iso: string): { day: string; mon: string } {
  const d = new Date(iso + "T12:00:00");
  return {
    day: String(d.getDate()),
    mon: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
  };
}

function monthLabel(key: string): { month: string; year: string } {
  const d = new Date(key + "-01T12:00:00");
  return {
    month: d.toLocaleString("en-US", { month: "long" }),
    year: String(d.getFullYear()),
  };
}

function prevMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 2);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function budgetLineIdAtPoint(x: number, y: number): string | null {
  for (const el of document.elementsFromPoint(x, y)) {
    if (!(el instanceof HTMLElement)) continue;
    const lineEl = el.closest("[data-budget-line-id]");
    if (lineEl instanceof HTMLElement) {
      const id = lineEl.dataset.budgetLineId;
      if (id) return id;
    }
  }
  return null;
}

function nearestLineInGroup(
  groupId: string,
  clientY: number
): { lineId: string; before: boolean } | null {
  const groupEl = document.querySelector(`[data-budget-group-id="${groupId}"]`);
  if (!groupEl) return null;
  const lineEls = groupEl.querySelectorAll<HTMLElement>("[data-budget-line-id]");
  if (lineEls.length === 0) return null;

  for (const el of lineEls) {
    const rect = el.getBoundingClientRect();
    if (clientY >= rect.top && clientY <= rect.bottom) {
      return {
        lineId: el.dataset.budgetLineId!,
        before: clientY < rect.top + rect.height / 2,
      };
    }
  }

  let best: { lineId: string; before: boolean; dist: number } | null = null;
  for (const el of lineEls) {
    const rect = el.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const dist = Math.abs(clientY - mid);
    const before = clientY < mid;
    if (!best || dist < best.dist) {
      best = { lineId: el.dataset.budgetLineId!, before, dist };
    }
  }
  return best;
}

function resolveLineTarget(
  e: React.DragEvent,
  groupId: string
): { lineId: string; before: boolean } | null {
  const direct = budgetLineIdAtPoint(e.clientX, e.clientY);
  if (direct) {
    const el = document.querySelector<HTMLElement>(`[data-budget-line-id="${direct}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      return {
        lineId: direct,
        before: e.clientY < rect.top + rect.height / 2,
      };
    }
  }
  return nearestLineInGroup(groupId, e.clientY);
}

function applyLineUpdates(
  data: BudgetData,
  updates: { id: string; budget_group_id: string; position: number }[]
): BudgetData {
  const lineMap = new Map<string, BudgetLineData>();
  for (const g of data.groups) {
    for (const l of g.budget_lines) lineMap.set(l.id, { ...l });
  }
  const affected = new Set(updates.map((u) => u.budget_group_id));
  for (const u of updates) {
    const line = lineMap.get(u.id);
    if (line) lineMap.set(u.id, { ...line, position: u.position });
  }
  return {
    ...data,
    groups: data.groups.map((g) => {
      const lines = affected.has(g.id)
        ? updates
            .filter((u) => u.budget_group_id === g.id)
            .map((u) => lineMap.get(u.id)!)
            .filter(Boolean)
        : [...g.budget_lines];
      return {
        ...g,
        budget_lines: [...lines].sort((a, b) =>
          a.position !== b.position ? a.position - b.position : a.id.localeCompare(b.id)
        ),
      };
    }),
  };
}

// ─── Main component ────────────────────────────────────────────────────────

export function BudgetPageClient() {
  const [month, setMonth] = useState(currentMonthKey);
  const [data, setData] = useState<BudgetData | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"summary" | "transactions">("transactions");
  const [searchQ, setSearchQ] = useState("");
  const [txnMarkerFilter, setTxnMarkerFilter] = useState<"all" | "unset" | "business" | "personal" | "partial">("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [lineActivityTxns, setLineActivityTxns] = useState<Txn[]>([]);
  const [lineActivityLoading, setLineActivityLoading] = useState(false);

  // "Other months" sidebar section: unassigned transactions from outside the
  // selected budget month, shown collapsed underneath the current month's.
  const [otherMonthsTxns, setOtherMonthsTxns] = useState<Txn[]>([]);
  const [showOtherMonths, setShowOtherMonths] = useState(false);
  const [otherMonthsLoading, setOtherMonthsLoading] = useState(false);

  // Inline editing
  const [editingPlanned, setEditingPlanned] = useState<{ lineId: string; value: string } | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<{ groupId: string; value: string } | null>(null);
  const [editingLineName, setEditingLineName] = useState<{ lineId: string; value: string } | null>(null);
  const [addGroupMode, setAddGroupMode] = useState<"closed" | "choose">("closed");
  const [initializing, setInitializing] = useState<"init" | "copy_last" | "copy_from" | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  // Copy-from month picker (used in both empty state and reset modal)
  const [copyMonths, setCopyMonths] = useState<string[]>([]);
  const [copyMonthsLoading, setCopyMonthsLoading] = useState(false);
  const [copyFromMonth, setCopyFromMonth] = useState<string>("");

  // Reset modal
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetAction, setResetAction] = useState<"init" | "copy_from">("copy_from");
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [pendingDeleteTxId, setPendingDeleteTxId] = useState<string | null>(null);
  const [deletingTxn, setDeletingTxn] = useState(false);
  const [addingLineTo, setAddingLineTo] = useState<string | null>(null); // groupId
  const [newLineValue, setNewLineValue] = useState("");

  // Scroll container for the groups/lines column (used for drag auto-scroll).
  const budgetMainRef = useRef<HTMLElement | null>(null);

  // Drag state (transactions → line assignment; lines → reorder / move group)
  const [draggingTxId, setDraggingTxId] = useState<string | null>(null);
  const [dropTargetLineId, setDropTargetLineId] = useState<string | null>(null);
  const [draggingLineId, setDraggingLineId] = useState<string | null>(null);
  const [lineDropTarget, setLineDropTarget] = useState<{ groupId: string; index: number } | null>(null);

  // Marker editor popover
  const [markerPopTxId, setMarkerPopTxId] = useState<string | null>(null);

  // Second column toggle: show Remaining or Actual (Received/Spent)
  const [secondCol, setSecondCol] = useState<"remaining" | "actual">("remaining");

  // ── Data loading ────────────────────────────────────────────────────────

  const loadBudget = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const [budgetRes, txnRes] = await Promise.all([
        fetch(`/api/budget?month=${m}`),
        fetch(`/api/budget/transactions?month=${m}&assigned=false`),
      ]);
      const budgetRaw = await budgetRes.json().catch(() => ({}));
      if (!budgetRes.ok) {
        console.error("Budget load error", budgetRaw?.error);
        setData({
          month_id: budgetRaw?.month_id ?? null,
          groups: [],
          stats: { income: 0, spending: 0 },
        });
        return;
      }
      const budget: BudgetData = {
        month_id: budgetRaw?.month_id ?? null,
        groups: sortBudgetGroups<BudgetGroupData>(
          Array.isArray(budgetRaw?.groups) ? (budgetRaw.groups as BudgetGroupData[]) : []
        ),
        stats: budgetRaw?.stats ?? { income: 0, spending: 0 },
      };
      const { transactions } = await txnRes.json();
      setData(budget);
      setTxns(transactions ?? []);
      // Auto-expand all groups on first load
      if (budget.groups.length > 0) {
        setExpandedGroups(new Set(budget.groups.map((g) => g.id)));
      }
    } catch (err) {
      console.error("Budget load error", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBudget(month);
    setSelectedLineId(null);
    // Reset copy-months when switching months so stale options don't show
    setCopyMonths([]);
    setCopyFromMonth("");
  }, [month, loadBudget]);

  // Load the list of months that have at least one group (for the copy picker)
  const loadCopyMonths = useCallback(async () => {
    setCopyMonthsLoading(true);
    try {
      const res = await fetch("/api/budget/months-with-groups");
      const body = await res.json().catch(() => ({}));
      const months: string[] = body.months ?? [];
      setCopyMonths(months);
      // Default selection: prefer the previous calendar month if it has groups,
      // otherwise fall back to the most recent month that does.
      const prev = prevMonth(month);
      const defaultMonth = months.includes(prev) ? prev : (months[0] ?? "");
      setCopyFromMonth(defaultMonth);
    } catch {
      setCopyMonths([]);
    } finally {
      setCopyMonthsLoading(false);
    }
  }, [month]);

  // Auto-load available months when the empty state becomes visible
  const hasBudgetSetupForEffect = !loading && (data?.groups?.length ?? 0) === 0;
  useEffect(() => {
    if (hasBudgetSetupForEffect) {
      loadCopyMonths();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBudgetSetupForEffect]);

  // Load transactions assigned to the selected line (line detail sidebar)
  useEffect(() => {
    if (!selectedLineId) {
      setLineActivityTxns([]);
      return;
    }
    let cancelled = false;
    setLineActivityLoading(true);
    fetch(`/api/budget/transactions?budget_line_id=${selectedLineId}`)
      .then(r => r.json())
      .then(({ transactions }) => {
        if (!cancelled) setLineActivityTxns(transactions ?? []);
      })
      .catch(() => {
        if (!cancelled) setLineActivityTxns([]);
      })
      .finally(() => {
        if (!cancelled) setLineActivityLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedLineId, month, data]);

  useEffect(() => {
    if (!selectedLineId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setSelectedLineId(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedLineId]);

  useEffect(() => {
    if (addGroupMode !== "choose") return;

    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "Escape") { setAddGroupMode("closed"); return; }
      if (e.key === "i" || e.key === "I") { addGroup("income"); return; }
      if (e.key === "e" || e.key === "E") { addGroup("expense"); return; }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addGroupMode]);

  // Reload txn rail when search changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loading) {
        const url = searchQ
          ? `/api/budget/transactions?month=${month}&assigned=false&search=${encodeURIComponent(searchQ)}`
          : `/api/budget/transactions?month=${month}&assigned=false`;
        fetch(url).then(r => r.json()).then(({ transactions }) => setTxns(transactions ?? []));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQ, month, loading]);

  // Load unassigned transactions from OTHER months for the collapsible section.
  const loadOtherMonths = useCallback(async (m: string, q: string) => {
    setOtherMonthsLoading(true);
    try {
      const url = `/api/budget/transactions?month=${m}&assigned=false&other_months=true${
        q ? `&search=${encodeURIComponent(q)}` : ""
      }`;
      const res = await fetch(url);
      const { transactions } = await res.json();
      setOtherMonthsTxns(transactions ?? []);
    } catch {
      setOtherMonthsTxns([]);
    } finally {
      setOtherMonthsLoading(false);
    }
  }, []);

  // (Re)load the other-months list whenever the section is open and the
  // month/search changes. Collapsing clears it so stale rows don't linger.
  useEffect(() => {
    if (!showOtherMonths) {
      setOtherMonthsTxns([]);
      return;
    }
    const timer = setTimeout(() => loadOtherMonths(month, searchQ), 300);
    return () => clearTimeout(timer);
  }, [showOtherMonths, month, searchQ, loadOtherMonths]);

  // Auto-scroll the groups/lines column when dragging a transaction or line
  // near its top/bottom edge, so you can reach off-screen groups mid-drag.
  const dragActive = draggingTxId != null || draggingLineId != null;
  useEffect(() => {
    if (!dragActive) return;
    const EDGE = 96;       // px from an edge where scrolling begins
    const MAX_SPEED = 20;  // px per animation frame at the very edge
    let pointerX = 0;
    let pointerY = 0;
    let raf = 0;

    const onDragOver = (e: DragEvent) => {
      pointerX = e.clientX;
      pointerY = e.clientY;
    };

    const step = () => {
      const el = budgetMainRef.current;
      // Prefer the groups column when it actually scrolls; otherwise fall back
      // to the window (mobile / short viewports where the page itself scrolls).
      const useColumn = !!el && el.scrollHeight > el.clientHeight + 1;
      if (pointerY > 0) {
        if (useColumn && el) {
          const rect = el.getBoundingClientRect();
          const withinX = pointerX >= rect.left && pointerX <= rect.right;
          if (withinX) {
            const topDist = pointerY - rect.top;
            const botDist = rect.bottom - pointerY;
            if (topDist < EDGE) {
              el.scrollTop -= MAX_SPEED * Math.min(1, Math.max(0, (EDGE - topDist) / EDGE));
            } else if (botDist < EDGE) {
              el.scrollTop += MAX_SPEED * Math.min(1, Math.max(0, (EDGE - botDist) / EDGE));
            }
          }
        } else {
          const vh = window.innerHeight;
          if (pointerY < EDGE) {
            window.scrollBy(0, -MAX_SPEED * Math.min(1, (EDGE - pointerY) / EDGE));
          } else if (vh - pointerY < EDGE) {
            window.scrollBy(0, MAX_SPEED * Math.min(1, (EDGE - (vh - pointerY)) / EDGE));
          }
        }
      }
      raf = requestAnimationFrame(step);
    };

    window.addEventListener("dragover", onDragOver);
    raf = requestAnimationFrame(step);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      cancelAnimationFrame(raf);
    };
  }, [dragActive]);

  // ── Derived state ───────────────────────────────────────────────────────

  const { month: monthName, year } = monthLabel(month);

  // Map transaction_id → txn for quick lookup (all txns including assigned)
  const txnMap = useRef<Map<string, Txn>>(new Map());
  useEffect(() => {
    txns.forEach(t => txnMap.current.set(t.id, t));
  }, [txns]);

  const { income = 0, spending = 0 } = data?.stats ?? {};

  // Left-to-allocate is based on planned amounts, not actual transactions:
  // sum of income-group planned lines minus sum of expense-group planned lines
  const plannedIncome = (data?.groups ?? [])
    .filter(g => g.kind === "income")
    .reduce((sum, g) => sum + g.budget_lines.reduce((s, l) => s + (l.allocated ?? 0), 0), 0);
  const plannedExpenses = (data?.groups ?? [])
    .filter(g => g.kind !== "income")
    .reduce((sum, g) => sum + g.budget_lines.reduce((s, l) => s + (l.allocated ?? 0), 0), 0);
  const leftToAllocate = plannedIncome - plannedExpenses;

  const bannerClass =
    leftToAllocate < 0 ? "alloc-banner--over"
    : leftToAllocate === 0 ? "alloc-banner--balanced"
    : "alloc-banner--open";

  const bannerLabel =
    leftToAllocate < 0 ? "Over budget"
    : leftToAllocate === 0 ? "Balanced"
    : "Left to allocate";

  const matchesMarkerFilter = (t: Txn) => {
    if (txnMarkerFilter === "all") return true;
    if (txnMarkerFilter === "unset") return !t.marker;
    if (txnMarkerFilter === "business") return t.marker === "Business";
    if (txnMarkerFilter === "personal") return t.marker === "Personal";
    if (txnMarkerFilter === "partial") return t.marker === "Partial";
    return true;
  };

  const filteredTxns = txns.filter(matchesMarkerFilter);
  const filteredOtherMonths = otherMonthsTxns.filter(matchesMarkerFilter);

  type SelectedLineCtx = { line: BudgetLineData; group: BudgetGroupData };
  const selectedLineCtx: SelectedLineCtx | null = (() => {
    if (!selectedLineId || !data?.groups) return null;
    for (const group of data.groups) {
      const line = group.budget_lines.find(l => l.id === selectedLineId);
      if (line) return { line, group };
    }
    return null;
  })();

  // ── Export ─────────────────────────────────────────────────────────────────

  async function exportBudgetCsv() {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch(`/api/budget/export?month=${encodeURIComponent(month)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setExportError(typeof body?.error === "string" ? body.error : "Export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `budget-transactions-${month}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Export failed. Check your connection and try again.");
    } finally {
      setExporting(false);
    }
  }

  // ── Budget initialization ────────────────────────────────────────────────

  async function initBudget(action: "init" | "copy_from", sourceMonth?: string) {
    setInitializing(action);
    setInitError(null);
    try {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          action,
          ...(action === "copy_from" ? { source_month: sourceMonth } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInitError(typeof body?.error === "string" ? body.error : "Could not set up this month’s budget.");
        return;
      }
      if (action === "init" && (body.groups_created ?? 0) === 0) {
        setInitError("Budget month was created but groups could not be added. Try again or contact support.");
        return;
      }
      await loadBudget(month);
      if (action === "copy_from" && body.copied === false) {
        setInitError("No budget groups found for that month. Choose a different month or start from scratch.");
      } else {
        setInitError(null);
      }
    } catch {
      setInitError("Could not set up this month’s budget. Check your connection and try again.");
    } finally {
      setInitializing(null);
    }
  }

  // ── Reset budget ─────────────────────────────────────────────────────

  async function openResetModal() {
    setResetModalOpen(true);
    setResetError(null);
    setResetAction("copy_from");
    await loadCopyMonths();
  }

  async function confirmReset() {
    setResetting(true);
    setResetError(null);
    try {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          action: resetAction,
          ...(resetAction === "copy_from" ? { source_month: copyFromMonth } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResetError(typeof body?.error === "string" ? body.error : "Could not reset the budget.");
        return;
      }
      if (resetAction === "copy_from" && body.copied === false) {
        setResetError("No budget groups found for that month. Choose a different month.");
        return;
      }
      setResetModalOpen(false);
      await loadBudget(month);
    } catch {
      setResetError("Could not reset the budget. Check your connection and try again.");
    } finally {
      setResetting(false);
    }
  }

  // ── Group actions ────────────────────────────────────────────────────────

  async function addGroup(kind: "income" | "expense") {
    const name = kind === "income" ? "Untitled Income" : "Untitled Expense";
    setAddGroupMode("closed");

    // Auto-create the budget month if it doesn't exist yet
    let monthId = data?.month_id;
    if (!monthId) {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, action: "init_empty" }),
      });
      const body = await res.json();
      monthId = body.month_id ?? null;
      if (!monthId) return;
    }

    const currentGroups = data?.groups ?? [];

    // "Income" groups get inserted at the top — shift existing positions down.
    if (kind === "income") {
      const ordered = [...currentGroups].sort((a, b) => a.position - b.position);
      await Promise.all(
        ordered.map((g) =>
          fetch("/api/budget/groups", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: g.id, position: g.position + 1 }),
          })
        )
      );
    }

    const pos = kind === "income" ? 0 : currentGroups.length;
    const groupRes = await fetch("/api/budget/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budget_month_id: monthId, name, position: pos, kind }),
    });
    const { group } = await groupRes.json();

    // Create 3 untitled lines inside the new group
    if (group?.id) {
      await Promise.all(
        [0, 1, 2].map((i) =>
          fetch("/api/budget/lines", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ budget_group_id: group.id, name: "Untitled", position: i }),
          })
        )
      );
    }

    await loadBudget(month);
    // Auto-focus the new group's name so the user can type immediately
    if (group?.id) {
      setEditingGroupName({ groupId: group.id, value: name });
    }
  }

  async function renameGroup(id: string, name: string) {
    await fetch("/api/budget/groups", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    });
    setEditingGroupName(null);
    loadBudget(month);
  }

  async function confirmDeleteGroup() {
    if (!deleteGroupId) return;
    await fetch("/api/budget/groups", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: deleteGroupId }),
    });
    setDeleteGroupId(null);
    loadBudget(month);
  }

  // ── Line actions ─────────────────────────────────────────────────────────

  async function addLine(groupId: string) {
    const group = data?.groups.find(g => g.id === groupId);
    const pos = group?.budget_lines.length ?? 0;
    const res = await fetch("/api/budget/lines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budget_group_id: groupId, name: "New line", position: pos }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.line) {
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          groups: prev.groups.map(g =>
            g.id === groupId
              ? { ...g, budget_lines: sortBudgetLines([...g.budget_lines, { ...body.line, actual: 0, budget_line_transactions: [] }]) }
              : g
          ),
        };
      });
      // Immediately put the new line's name into edit mode so user can type the name
      setEditingLineName({ lineId: body.line.id, value: "New line" });
    } else {
      loadBudget(month);
    }
  }

  async function savePlanned(lineId: string, value: string) {
    const num = parseFloat(value.replace(/[^0-9.-]/g, ""));
    const allocated = isNaN(num) ? null : num;
    await fetch("/api/budget/lines", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lineId, allocated }),
    });
    setEditingPlanned(null);
    loadBudget(month);
  }

  async function renameLine(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        groups: prev.groups.map(g => ({
          ...g,
          budget_lines: g.budget_lines.map(l => (l.id === id ? { ...l, name: trimmed } : l)),
        })),
      };
    });
    setEditingLineName(null);
    const res = await fetch("/api/budget/lines", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: trimmed }),
    });
    if (!res.ok) loadBudget(month);
  }

  async function deleteLine(id: string) {
    await fetch("/api/budget/lines", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (selectedLineId === id) setSelectedLineId(null);
    loadBudget(month);
  }

  // ── Drag and drop ────────────────────────────────────────────────────────

  const draggingLineKind = draggingLineId
    ? (data?.groups.find((g) => g.budget_lines.some((l) => l.id === draggingLineId))?.kind ?? "expense")
    : null;

  function clearLineDrag() {
    setDraggingLineId(null);
    setLineDropTarget(null);
  }

  function computeLineInsertIndex(
    group: BudgetGroupData,
    dragLineId: string,
    overLineId: string,
    before: boolean
  ): number {
    const without = group.budget_lines.filter((l) => l.id !== dragLineId);
    const idx = without.findIndex((l) => l.id === overLineId);
    if (idx < 0) return without.length;
    return before ? idx : idx + 1;
  }

  async function reorderLine(lineId: string, toGroupId: string, toIndex: number) {
    if (!data) return;
    const plan = planLineMove(data.groups, lineId, toGroupId, toIndex);
    if (plan.error || plan.updates.length === 0) return;

    const snapshot = data;
    setData(applyLineUpdates(data, plan.updates));

    const res = await fetch("/api/budget/lines/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ line_id: lineId, to_group_id: toGroupId, to_index: toIndex }),
    });
    if (!res.ok) setData(snapshot);
  }

  function handleLineDragStart(e: React.DragEvent, lineId: string) {
    e.dataTransfer.setData("budgetLineId", lineId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingLineId(lineId);
    setDropTargetLineId(null);
  }

  function handleLineDragEnd() {
    clearLineDrag();
  }

  function handleLineDragOverGroup(e: React.DragEvent, groupId: string, index: number, groupKind?: string) {
    if (!draggingLineId) return;
    e.preventDefault();
    if (groupKind && draggingLineKind && groupKind !== draggingLineKind) return;
    e.dataTransfer.dropEffect = "move";
    setLineDropTarget({ groupId, index });
  }

  async function handleLineDrop(e: React.DragEvent, groupId: string, toIndex: number, groupKind?: string) {
    e.preventDefault();
    const lineId = e.dataTransfer.getData("budgetLineId") || draggingLineId;
    if (!lineId) return;
    if (groupKind && draggingLineKind && groupKind !== draggingLineKind) {
      clearLineDrag();
      return;
    }
    await reorderLine(lineId, groupId, toIndex);
    clearLineDrag();
  }

  async function deleteTxn(txId: string) {
    setTxns(prev => prev.filter(t => t.id !== txId));
    setOtherMonthsTxns(prev => prev.filter(t => t.id !== txId));
    setLineActivityTxns(prev => prev.filter(t => t.id !== txId));
    await fetch("/api/transactions/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: txId }),
    });
    loadBudget(month);
  }

  function requestDeleteTxn(txId: string) {
    setPendingDeleteTxId(txId);
  }

  async function confirmDeleteTxn() {
    if (!pendingDeleteTxId) return;
    setDeletingTxn(true);
    try {
      await deleteTxn(pendingDeleteTxId);
      setPendingDeleteTxId(null);
    } finally {
      setDeletingTxn(false);
    }
  }

  async function assignTxn(txId: string, lineId: string) {
    // Resolve the transaction from whatever list it was dragged out of
    // (unassigned sidebar, the open line's activity, or the lookup cache).
    const txn =
      txns.find(t => t.id === txId) ??
      otherMonthsTxns.find(t => t.id === txId) ??
      lineActivityTxns.find(t => t.id === txId) ??
      txnMap.current.get(txId) ??
      null;

    // ── Optimistic UI: reflect the move instantly, reconcile on reload ──
    // Remove from the unassigned sidebar (current month + other-months section).
    setTxns(prev => prev.filter(t => t.id !== txId));
    setOtherMonthsTxns(prev => prev.filter(t => t.id !== txId));

    // Move it within the open line's activity list (remove from source / add to target).
    setLineActivityTxns(prev => {
      const without = prev.filter(t => t.id !== txId);
      return selectedLineId === lineId && txn ? [txn, ...without] : without;
    });

    // Re-point the assignment and re-net each affected line's actual.
    if (txn) {
      const absAmt = Math.abs(Number(txn.amount));
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          groups: prev.groups.map(g => {
            const kind = g.kind === "income" ? "income" : "expense";
            const contribution = txn.transaction_type === kind ? absAmt : -absAmt;
            const lines = g.budget_lines.map(l => {
              const has = l.budget_line_transactions?.some(bt => bt.transaction_id === txId) ?? false;
              if (l.id === lineId) {
                return has
                  ? l
                  : {
                      ...l,
                      actual: (l.actual ?? 0) + contribution,
                      budget_line_transactions: [
                        ...(l.budget_line_transactions ?? []),
                        { transaction_id: txId },
                      ],
                    };
              }
              if (has) {
                return {
                  ...l,
                  actual: (l.actual ?? 0) - contribution,
                  budget_line_transactions: (l.budget_line_transactions ?? []).filter(
                    bt => bt.transaction_id !== txId
                  ),
                };
              }
              return l;
            });
            return { ...g, budget_lines: lines };
          }),
        };
      });
    }

    const res = await fetch("/api/budget/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transaction_id: txId, budget_line_id: lineId }),
    });

    // Reconcile with server truth either way (also reverts the optimistic update
    // if the assignment failed).
    loadBudget(month);
    if (showOtherMonths) loadOtherMonths(month, searchQ);
  }

  function handleDragStart(e: React.DragEvent, txId: string) {
    e.dataTransfer.setData("txId", txId);
    setDraggingTxId(txId);
  }

  function handleDragEnd() {
    setDraggingTxId(null);
    setDropTargetLineId(null);
  }

  function handleDragOverLine(
    e: React.DragEvent,
    lineId: string,
    groupId: string,
    groupKind?: string
  ) {
    e.preventDefault();
    if (draggingLineId) {
      if (groupKind && draggingLineKind && groupKind !== draggingLineKind) return;
      const group = data?.groups.find((g) => g.id === groupId);
      if (!group) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      const toIndex = computeLineInsertIndex(group, draggingLineId, lineId, before);
      e.dataTransfer.dropEffect = "move";
      setLineDropTarget({ groupId, index: toIndex });
      return;
    }
    e.dataTransfer.dropEffect = "copy";
    setDropTargetLineId(lineId);
  }

  function handleDropOnLine(
    e: React.DragEvent,
    lineId: string,
    groupId: string,
    groupKind?: string
  ) {
    e.preventDefault();
    const lineDragId = e.dataTransfer.getData("budgetLineId");
    if (lineDragId || draggingLineId) {
      if (groupKind && draggingLineKind && groupKind !== draggingLineKind) {
        clearLineDrag();
        return;
      }
      const group = data?.groups.find((g) => g.id === groupId);
      const dragId = lineDragId || draggingLineId;
      if (!group || !dragId) {
        clearLineDrag();
        return;
      }
      const resolved = resolveLineTarget(e, groupId);
      const targetLineId = resolved?.lineId ?? lineId;
      let before = resolved?.before;
      if (before == null) {
        const el = document.querySelector<HTMLElement>(
          `[data-budget-line-id="${targetLineId}"]`
        );
        const rect = el?.getBoundingClientRect();
        before = rect ? e.clientY < rect.top + rect.height / 2 : false;
      }
      const toIndex = computeLineInsertIndex(group, dragId, targetLineId, before);
      void handleLineDrop(e, groupId, toIndex, groupKind);
      return;
    }
    const txId = e.dataTransfer.getData("txId") || draggingTxId;
    const targetLineId =
      resolveLineTarget(e, groupId)?.lineId ?? lineId ?? dropTargetLineId;
    if (txId && targetLineId) {
      assignTxn(txId, targetLineId);
    }
    setDropTargetLineId(null);
    setDraggingTxId(null);
  }

  function handleDragOverGroupBody(
    e: React.DragEvent,
    groupId: string,
    groupKind?: string
  ) {
    e.preventDefault();
    if (draggingLineId) {
      if (groupKind && draggingLineKind && groupKind !== draggingLineKind) return;
      const target = resolveLineTarget(e, groupId);
      const group = data?.groups.find((g) => g.id === groupId);
      if (target && group) {
        const toIndex = computeLineInsertIndex(
          group,
          draggingLineId,
          target.lineId,
          target.before
        );
        e.dataTransfer.dropEffect = "move";
        setLineDropTarget({ groupId, index: toIndex });
      } else {
        handleLineDragOverGroup(
          e,
          groupId,
          group?.budget_lines.length ?? 0,
          groupKind
        );
      }
      return;
    }
    if (draggingTxId) {
      const target = resolveLineTarget(e, groupId);
      if (target) {
        e.dataTransfer.dropEffect = "copy";
        setDropTargetLineId(target.lineId);
      }
    }
  }

  function handleDropOnGroupBody(
    e: React.DragEvent,
    groupId: string,
    groupKind?: string
  ) {
    e.preventDefault();
    const lineDragId = e.dataTransfer.getData("budgetLineId");
    if (lineDragId || draggingLineId) {
      const group = data?.groups.find((g) => g.id === groupId);
      const dragId = lineDragId || draggingLineId;
      if (!group || !dragId) {
        clearLineDrag();
        return;
      }
      if (groupKind && draggingLineKind && groupKind !== draggingLineKind) {
        clearLineDrag();
        return;
      }
      const target = resolveLineTarget(e, groupId);
      const toIndex = target
        ? computeLineInsertIndex(group, dragId, target.lineId, target.before)
        : group.budget_lines.length;
      void handleLineDrop(e, groupId, toIndex, groupKind);
      return;
    }
    const txId = e.dataTransfer.getData("txId") || draggingTxId;
    const lineId = resolveLineTarget(e, groupId)?.lineId ?? dropTargetLineId;
    if (txId && lineId) {
      assignTxn(txId, lineId);
    }
    setDropTargetLineId(null);
    setDraggingTxId(null);
  }

  // ── Marker updates ────────────────────────────────────────────────────────

  async function saveMarker(
    txId: string,
    marker: Marker,
    businessPct: number,
    opts?: { closePop?: boolean }
  ) {
    const pct =
      marker === "Business" ? 100 : marker === "Personal" ? 0 : businessPct;

    let business_purpose: string | null | undefined = undefined;
    if (marker === "Personal") {
      business_purpose = null;
    } else if (marker === "Business" || marker === "Partial") {
      try {
        const reasonRes = await fetch("/api/transactions/audit-reason", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: txId, marker, business_pct: pct }),
        });
        if (reasonRes.ok) {
          const { reason } = await reasonRes.json();
          business_purpose = reason ?? null;
        }
      } catch {
        // keep existing purpose if AI unavailable
      }
    }

    await fetch("/api/transactions/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: txId,
        marker,
        business_pct: pct,
        ...(business_purpose !== undefined ? { business_purpose } : {}),
      }),
    });

    const patch = {
      marker,
      business_pct: pct,
      ...(business_purpose !== undefined ? { business_purpose } : {}),
    };
    setTxns((prev) => prev.map((t) => (t.id === txId ? { ...t, ...patch } : t)));
    setLineActivityTxns((prev) => prev.map((t) => (t.id === txId ? { ...t, ...patch } : t)));
    if (opts?.closePop !== false) setMarkerPopTxId(null);
  }

  async function quickTagMarker(txId: string, marker: Marker) {
    const tx = txns.find((t) => t.id === txId);
    const pct = tx?.business_pct ?? 50;
    await saveMarker(txId, marker, marker === "Partial" ? pct : marker === "Business" ? 100 : 0, {
      closePop: true,
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="page-anim">
        <div style={{ padding: "60px 36px", color: "var(--ink-3)", textAlign: "center" }}>
          Loading budget…
        </div>
      </div>
    );
  }

  const hasBudgetSetup = (data?.groups?.length ?? 0) > 0;
  const showEmptyState = !hasBudgetSetup && addGroupMode === "closed";

  return (
    <div className="page-anim budget-page">
      {/* Sticky header: month title + controls + allocation banner */}
      <div className="budget-sticky-head">
        <header className="pagehead">
          <div>
            <h1 className="pagehead__title">{monthName} <em>{year}</em></h1>
          </div>
          <div className="pagehead__right">
            <button
              className="btn btn--ghost"
              onClick={() => { setAddGroupMode("choose"); }}
            >
              <IPlus size={14} /> Add group
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={exportBudgetCsv}
              disabled={exporting}
              title={exportError ?? undefined}
            >
              <IExport size={14} /> {exporting ? "Exporting…" : "Export"}
            </button>
            {/* Period switcher */}
            <div className="period">
              <button className="period__btn" onClick={() => setMonth(prevMonth(month))}>‹</button>
              <div className="period__label">
                {monthName.slice(0, 3).toUpperCase()}<em>{year}</em>
              </div>
              <button className="period__btn" onClick={() => setMonth(nextMonth(month))}>›</button>
            </div>
          </div>
        </header>

        {/* Allocation status bar */}
        {hasBudgetSetup && (
          <div className={`alloc-banner ${bannerClass}`}>
            <div className="alloc-banner__label">
              {bannerLabel}:{" "}
              <strong style={{ fontWeight: 700 }}>
                {leftToAllocate === 0 ? "All dollars allocated" : fmtMoney(Math.abs(leftToAllocate))}
              </strong>
            </div>
          </div>
        )}
      </div>

      <div className="budget-layout">
        {/* ── Left: budget groups ── */}
        <main
          className="budget-main"
          ref={budgetMainRef}
          onDragOver={(e) => {
            if (!draggingTxId) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            const lineId = budgetLineIdAtPoint(e.clientX, e.clientY);
            if (lineId) setDropTargetLineId(lineId);
          }}
          onDrop={(e) => {
            if (!draggingTxId) return;
            const txId = e.dataTransfer.getData("txId") || draggingTxId;
            const lineId =
              budgetLineIdAtPoint(e.clientX, e.clientY) ?? dropTargetLineId;
            if (!txId || !lineId) return;
            e.preventDefault();
            assignTxn(txId, lineId);
            setDropTargetLineId(null);
            setDraggingTxId(null);
          }}
        >
          {showEmptyState ? (
            /* Empty state */
            <div className="card" style={{ padding: "48px 32px", textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                Start {monthName}&apos;s budget
              </div>
              <div style={{ fontSize: 14, color: "var(--ink-3)", maxWidth: 360, margin: "0 auto 28px" }}>
                Set up groups and lines to give every dollar a job. Takes about 3 minutes.
              </div>

              {initializing ? (
                <div className="budget-init-progress" style={{ maxWidth: 320, margin: "0 auto" }}>
                  <div className="budget-init-progress__label">
                    {initializing === "init"
                      ? "Setting up Income, Needs, and Wants…"
                      : "Copying budget groups…"}
                  </div>
                  <div className="budget-init-progress__bar" role="progressbar" aria-busy="true">
                    <span className="budget-init-progress__bar-fill" />
                  </div>
                </div>
              ) : (
                <>
                  {initError && (
                    <p
                      style={{
                        fontSize: 13.5,
                        color: "var(--ember)",
                        maxWidth: 360,
                        margin: "0 auto 20px",
                        lineHeight: 1.5,
                      }}
                    >
                      {initError}
                    </p>
                  )}
                  {/* Copy from month row */}
                  {copyMonths.length > 0 && (
                    <div className="budget-copy-row">
                      <span className="budget-copy-row__label">Copy from</span>
                      <select
                        className="budget-copy-select"
                        value={copyFromMonth}
                        onChange={e => setCopyFromMonth(e.target.value)}
                        disabled={copyMonthsLoading}
                      >
                        {copyMonths.map(mk => {
                          const { month: mn, year: yr } = monthLabel(mk);
                          return (
                            <option key={mk} value={mk}>{mn} {yr}</option>
                          );
                        })}
                      </select>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        disabled={!copyFromMonth || copyMonthsLoading}
                        onClick={() => initBudget("copy_from", copyFromMonth)}
                      >
                        Copy budget
                      </button>
                    </div>
                  )}
                  {copyMonthsLoading && copyMonths.length === 0 && (
                    <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 16 }}>
                      Loading available months…
                    </div>
                  )}
                  {!copyMonthsLoading && copyMonths.length === 0 && (
                    <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 16 }}>
                      No previous budgets to copy from.
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: copyMonths.length > 0 ? 12 : 0 }}>
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => initBudget("init")}
                    >
                      Start from scratch
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Groups */}
              <div className="budget-groups">
                {addGroupMode === "choose" && (
                  <GhostGroupChoose
                    onPickIncome={() => addGroup("income")}
                    onPickExpense={() => addGroup("expense")}
                    onCancel={() => setAddGroupMode("closed")}
                  />
                )}
                {(data?.groups ?? []).map((group) => (
                  <BudgetGroup
                    key={group.id}
                    group={group}
                    expanded={expandedGroups.has(group.id)}
                    onToggle={() => setExpandedGroups(prev => {
                      const next = new Set(prev);
                      next.has(group.id) ? next.delete(group.id) : next.add(group.id);
                      return next;
                    })}
                    selectedLineId={selectedLineId}
                    secondCol={secondCol}
                    onChangeSecondCol={setSecondCol}
                    onSelectLine={(lineId) =>
                      setSelectedLineId(prev => (prev === lineId ? null : lineId))
                    }
                    editingPlanned={editingPlanned}
                    onStartEditPlanned={(lineId, current) =>
                      setEditingPlanned({ lineId, value: current != null ? String(current) : "" })
                    }
                    onChangePlanned={(value) =>
                      setEditingPlanned(prev => prev ? { ...prev, value } : null)
                    }
                    onSavePlanned={savePlanned}
                    editingLineName={editingLineName}
                    onStartEditLineName={(lineId, name) =>
                      setEditingLineName({ lineId, value: name })
                    }
                    onChangeLineName={(value) =>
                      setEditingLineName(prev => prev ? { ...prev, value } : null)
                    }
                    onSaveLineName={renameLine}
                    onCancelEditLineName={() => setEditingLineName(null)}
                    editingGroupName={editingGroupName}
                    onStartEditGroupName={() =>
                      setEditingGroupName({ groupId: group.id, value: group.name })
                    }
                    onChangeGroupName={(value) =>
                      setEditingGroupName(prev => prev ? { ...prev, value } : null)
                    }
                    onSaveGroupName={renameGroup}
                    onCancelEditGroupName={() => setEditingGroupName(null)}
                    onRequestDeleteGroup={setDeleteGroupId}
                    dropTargetLineId={dropTargetLineId}
                    onDragOverLine={handleDragOverLine}
                    onDropOnLine={handleDropOnLine}
                    draggingLineId={draggingLineId}
                    draggingLineKind={draggingLineKind}
                    lineDropTarget={lineDropTarget}
                    onLineDragStart={handleLineDragStart}
                    onLineDragEnd={handleLineDragEnd}
                    onLineDragOverGroup={handleLineDragOverGroup}
                    onLineDrop={handleLineDrop}
                    onDragOverGroupBody={handleDragOverGroupBody}
                    onDropOnGroupBody={handleDropOnGroupBody}
                    onStartAddLine={() => addLine(group.id)}
                  />
                ))}
              </div>

              {/* Add group row */}
              {addGroupMode === "closed" && (
                <button className="budget-addgroup" onClick={() => setAddGroupMode("choose")}>
                  <IPlus size={14} /> Add group
                </button>
              )}

              {/* Reset budget */}
              {addGroupMode === "closed" && (
                <div className="budget-reset-row">
                  <button
                    type="button"
                    className="budget-reset-btn"
                    onClick={openResetModal}
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M13.6 2.4A7 7 0 1 0 15 8h-1.5a5.5 5.5 0 1 1-1.06-3.24L10 7h5V2l-1.4 1.4z" fill="currentColor"/>
                    </svg>
                    Reset budget
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        {/* ── Right rail ── */}
        {selectedLineCtx && createPortal(
          <div className="budget-rail-backdrop" onClick={() => setSelectedLineId(null)} />,
          document.body
        )}
        <aside className={`budget-rail${selectedLineCtx ? " budget-rail--line" : ""}`}>
          {selectedLineCtx ? (
            <LineDetailRail
              line={selectedLineCtx.line}
              group={selectedLineCtx.group}
              activity={lineActivityTxns}
              activityLoading={lineActivityLoading}
              month={month}
              onClose={() => setSelectedLineId(null)}
              onDelete={() => {
                deleteLine(selectedLineCtx.line.id);
                setSelectedLineId(null);
              }}
              onDeleteTxn={requestDeleteTxn}
              onTxnDragStart={handleDragStart}
              onTxnDragEnd={handleDragEnd}
              draggingTxId={draggingTxId}
              onUpdateLine={(lineId, patch) => {
                setData(prev => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    groups: prev.groups.map(g => ({
                      ...g,
                      budget_lines: g.budget_lines.map(l =>
                        l.id === lineId ? { ...l, ...patch } : l
                      ),
                    })),
                  };
                });
              }}
            />
          ) : (
            <>
              <div className="rail-tabs">
                <button
                  className={`rail-tab${activeTab === "summary" ? " is-active" : ""}`}
                  onClick={() => setActiveTab("summary")}
                >
                  Summary
                </button>
                <button
                  className={`rail-tab${activeTab === "transactions" ? " is-active" : ""}`}
                  onClick={() => setActiveTab("transactions")}
                >
                  Transactions
                  {filteredTxns.length > 0 && (
                    <span className="rail-tab__count">{filteredTxns.length}</span>
                  )}
                </button>
              </div>

              {activeTab === "summary" ? (
                <SummaryTab groups={data?.groups ?? []} income={income} spending={spending} />
              ) : (
                <div className="txnlist">
                  <div className="txnlist__search">
                    <ISearch size={14} />
                    <input
                      placeholder="Search transactions…"
                      value={searchQ}
                      onChange={e => setSearchQ(e.target.value)}
                    />
                  </div>

                  {txnMarkerFilter === "partial" && (
                    <button
                      type="button"
                      className="txnlist__filter-back"
                      onClick={() => setTxnMarkerFilter("all")}
                    >
                      ← All transactions
                    </button>
                  )}

                  {txnMarkerFilter !== "partial" && (
                    <div className="txnlist__filters" role="tablist" aria-label="Filter by tag">
                      {(
                        [
                          ["all", "All"],
                          ["unset", "Untagged"],
                          ["business", "Business"],
                          ["personal", "Personal"],
                          ["partial", "Partial"],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          role="tab"
                          aria-selected={txnMarkerFilter === key}
                          className={`txnlist__filter${txnMarkerFilter === key ? " is-active" : ""}`}
                          onClick={() => setTxnMarkerFilter(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="txnlist__items">
                    {filteredTxns.length === 0 ? (
                      <div className="txnlist__empty">
                        <div>{searchQ ? "No matches" : "All transactions assigned"}</div>
                        <div className="txnlist__empty-sub">
                          {searchQ ? "Try a different search" : "Great work"}
                        </div>
                      </div>
                    ) : (
                      filteredTxns.map(tx => (
                        <TxnCard
                          key={tx.id}
                          tx={tx}
                          dragging={draggingTxId === tx.id}
                          markerPopOpen={markerPopTxId === tx.id}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                          onQuickTag={(m) => quickTagMarker(tx.id, m)}
                          onOpenPartialEditor={() =>
                            setMarkerPopTxId(markerPopTxId === tx.id ? null : tx.id)
                          }
                          onCloseMarkerPop={() => setMarkerPopTxId(null)}
                          onSaveMarker={(marker, pct) => saveMarker(tx.id, marker, pct)}
                          onDelete={() => requestDeleteTxn(tx.id)}
                        />
                      ))
                    )}

                    {/* Other months — bring in unassigned transactions from outside this month */}
                    <div className="txnlist__other">
                      <button
                        type="button"
                        className="txnlist__other-toggle"
                        aria-expanded={showOtherMonths}
                        onClick={() => setShowOtherMonths(v => !v)}
                      >
                        {showOtherMonths ? <IChevronD size={13} /> : <IChevronR size={13} />}
                        <span>Other months</span>
                        {showOtherMonths && filteredOtherMonths.length > 0 && (
                          <span className="txnlist__other-count">{filteredOtherMonths.length}</span>
                        )}
                      </button>

                      {showOtherMonths && (
                        otherMonthsLoading ? (
                          <div className="txnlist__other-note">Loading…</div>
                        ) : filteredOtherMonths.length === 0 ? (
                          <div className="txnlist__other-note">
                            {searchQ ? "No matches in other months" : "No unassigned transactions in other months"}
                          </div>
                        ) : (
                          filteredOtherMonths.map(tx => (
                            <TxnCard
                              key={tx.id}
                              tx={tx}
                              showYear
                              dragging={draggingTxId === tx.id}
                              markerPopOpen={markerPopTxId === tx.id}
                              onDragStart={handleDragStart}
                              onDragEnd={handleDragEnd}
                              onQuickTag={(m) => quickTagMarker(tx.id, m)}
                              onOpenPartialEditor={() =>
                                setMarkerPopTxId(markerPopTxId === tx.id ? null : tx.id)
                              }
                              onCloseMarkerPop={() => setMarkerPopTxId(null)}
                              onSaveMarker={(marker, pct) => saveMarker(tx.id, marker, pct)}
                              onDelete={() => requestDeleteTxn(tx.id)}
                            />
                          ))
                        )
                      )}
                    </div>
                  </div>

                  <div className="txnlist__footer">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {filteredTxns.length} unassigned
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                        Drag to assign, or click a line
                      </div>
                    </div>
                    <ISpark2 size={14} />
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      {/* Delete group confirmation */}
      {deleteGroupId && createPortal(
        <div
          className="budget-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="budget-delete-group-title"
          onClick={() => setDeleteGroupId(null)}
        >
          <div className="budget-modal" onClick={e => e.stopPropagation()}>
            <h2 id="budget-delete-group-title" className="budget-modal__title">
              Delete group?
            </h2>
            <p className="budget-modal__body">
              This will permanently delete{" "}
              <strong style={{ color: "var(--ink)" }}>
                {data?.groups.find(g => g.id === deleteGroupId)?.name ?? "this group"}
              </strong>{" "}
              and all of its budget lines. This cannot be undone.
            </p>
            <div className="budget-modal__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setDeleteGroupId(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn--primary" onClick={confirmDeleteGroup}>
                Delete group
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Delete transaction confirmation */}
      {pendingDeleteTxId && createPortal(
        <div
          className="budget-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="budget-delete-txn-title"
          onClick={() => !deletingTxn && setPendingDeleteTxId(null)}
        >
          <div className="budget-modal" onClick={e => e.stopPropagation()}>
            <h2 id="budget-delete-txn-title" className="budget-modal__title">
              Delete this transaction?
            </h2>
            <p className="budget-modal__body">
              {(() => {
                const t =
                  lineActivityTxns.find(x => x.id === pendingDeleteTxId) ??
                  txns.find(x => x.id === pendingDeleteTxId);
                return t?.vendor ? (
                  <>
                    <strong style={{ color: "var(--ink)" }}>{`“${t.vendor}”`}</strong> will be deleted.
                  </>
                ) : (
                  "This transaction will be deleted."
                );
              })()}{" "}
              This can’t be undone.
            </p>
            <div className="budget-modal__actions">
              <button
                type="button"
                className="btn btn--ghost"
                disabled={deletingTxn}
                onClick={() => setPendingDeleteTxId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={deletingTxn}
                onClick={confirmDeleteTxn}
              >
                {deletingTxn ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Reset budget modal */}
      {resetModalOpen && createPortal(
        <div
          className="budget-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="budget-reset-title"
          onClick={() => !resetting && setResetModalOpen(false)}
        >
          <div className="budget-modal budget-modal--reset" onClick={e => e.stopPropagation()}>
            <h2 id="budget-reset-title" className="budget-modal__title">
              Reset budget
            </h2>
            <p className="budget-modal__body">
              This will permanently delete all groups and lines for{" "}
              <strong style={{ color: "var(--ink)" }}>{monthName} {year}</strong>.
              Your transactions won&apos;t be affected.
            </p>

            {/* Action choice */}
            <div className="budget-reset-options">
              <label className={`budget-reset-option${resetAction === "init" ? " is-selected" : ""}`}>
                <input
                  type="radio"
                  name="reset-action"
                  value="init"
                  checked={resetAction === "init"}
                  onChange={() => setResetAction("init")}
                />
                <div className="budget-reset-option__body">
                  <div className="budget-reset-option__title">Start from scratch</div>
                  <div className="budget-reset-option__sub">Creates default Income, Needs, and Wants groups</div>
                </div>
              </label>
              <label className={`budget-reset-option${resetAction === "copy_from" ? " is-selected" : ""}`}>
                <input
                  type="radio"
                  name="reset-action"
                  value="copy_from"
                  checked={resetAction === "copy_from"}
                  onChange={() => setResetAction("copy_from")}
                  disabled={copyMonths.length === 0}
                />
                <div className="budget-reset-option__body">
                  <div className="budget-reset-option__title">Copy from another month</div>
                  {copyMonthsLoading ? (
                    <div className="budget-reset-option__sub">Loading months…</div>
                  ) : copyMonths.length === 0 ? (
                    <div className="budget-reset-option__sub">No previous budgets available</div>
                  ) : (
                    <select
                      className="budget-copy-select budget-copy-select--inline"
                      value={copyFromMonth}
                      onChange={e => { setCopyFromMonth(e.target.value); setResetAction("copy_from"); }}
                      onClick={e => e.stopPropagation()}
                    >
                      {copyMonths
                        .filter(mk => mk !== month)
                        .map(mk => {
                          const { month: mn, year: yr } = monthLabel(mk);
                          return <option key={mk} value={mk}>{mn} {yr}</option>;
                        })}
                    </select>
                  )}
                </div>
              </label>
            </div>

            {resetError && (
              <p className="budget-reset-error">{resetError}</p>
            )}

            {resetting ? (
              <div className="budget-init-progress" style={{ marginTop: 16 }}>
                <div className="budget-init-progress__label">
                  {resetAction === "init" ? "Setting up default groups…" : "Copying budget groups…"}
                </div>
                <div className="budget-init-progress__bar" role="progressbar" aria-busy="true">
                  <span className="budget-init-progress__bar-fill" />
                </div>
              </div>
            ) : (
              <div className="budget-modal__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setResetModalOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={confirmReset}
                  disabled={resetAction === "copy_from" && (!copyFromMonth || copyMonths.filter(m => m !== month).length === 0)}
                >
                  Reset budget
                </button>
              </div>
            )}
          </div>
        </div>
      , document.body)}
    </div>
  );
}

// ─── Ghost group (new group type picker) ─────────────────────────────────────

function GhostGroupChoose({
  onPickIncome,
  onPickExpense,
  onCancel,
}: {
  onPickIncome: () => void;
  onPickExpense: () => void;
  onCancel: () => void;
}) {
  const kbdStyle = {
    marginLeft: 6,
    fontSize: 10,
    fontWeight: 700,
    background: "var(--bone-2)",
    border: "1px solid var(--border)",
    borderRadius: 3,
    padding: "1px 4px",
    lineHeight: 1.4,
    color: "var(--ink-2)",
    fontFamily: "inherit",
  };

  return (
    <div className="group">
      <div className="group__head" style={{ cursor: "default" }} onClick={e => e.stopPropagation()}>
        <div className="group__head-l" style={{ gap: 10, flexWrap: "wrap" }}>
          <div className="group__bar" style={{ background: "var(--ink-4)" }} />
          <span style={{ fontSize: 12.5, color: "var(--ink-3)", fontWeight: 500 }}>
            New group — choose type:
          </span>
          <button type="button" className="btn btn--ghost btn--mini" onClick={onPickIncome}>
            Income <kbd style={kbdStyle}>I</kbd>
          </button>
          <button type="button" className="btn btn--ghost btn--mini" onClick={onPickExpense}>
            Expense <kbd style={kbdStyle}>E</kbd>
          </button>
        </div>
        <div className="group__head-r">
          <button type="button" className="btn btn--ghost btn--mini" onClick={onCancel}>
            Cancel <kbd style={kbdStyle}>Esc</kbd>
          </button>
        </div>
      </div>
      <div className="group__body" style={{ pointerEvents: "none", opacity: 0.35 }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="line__row" style={{ padding: "7px 14px" }}>
            <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Untitled</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Editable inline label ───────────────────────────────────────────────────

function EditableName({
  value,
  editing,
  editValue,
  onStartEdit,
  onChange,
  onSave,
  onCancel,
  className,
}: {
  value: string;
  editing: boolean;
  editValue: string;
  onStartEdit: () => void;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  className?: string;
}) {
  if (editing) {
    return (
      <input
        autoFocus
        className="settings__input"
        value={editValue}
        onChange={e => onChange(e.target.value)}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === "Enter") onSave();
          if (e.key === "Escape") onCancel();
        }}
        onBlur={onSave}
        style={{ width: 180, maxWidth: "100%" }}
      />
    );
  }
  return (
    <button
      type="button"
      className={["editable-name", className].filter(Boolean).join(" ")}
      onClick={e => { e.stopPropagation(); onStartEdit(); }}
    >
      {value}
    </button>
  );
}

// ─── Line detail sidebar (replaces rail when a line is selected) ─────────────

type ActivityMarkerFilter = "all" | "business" | "personal" | "partial" | "unset";

function LineDetailRail({
  line,
  group,
  activity,
  activityLoading,
  month,
  onClose,
  onDelete,
  onDeleteTxn,
  onTxnDragStart,
  onTxnDragEnd,
  draggingTxId,
  onUpdateLine,
}: {
  line: BudgetLineData;
  group: BudgetGroupData;
  activity: Txn[];
  activityLoading: boolean;
  month: string;
  onClose: () => void;
  onDelete: () => void;
  onDeleteTxn: (txId: string) => void;
  onTxnDragStart: (e: React.DragEvent, txId: string) => void;
  onTxnDragEnd: () => void;
  draggingTxId: string | null;
  onUpdateLine: (lineId: string, patch: Partial<BudgetLineData>) => void;
}) {
  const isIncome = group.kind === "income";
  const planned = line.allocated ?? 0;
  const actual = line.actual ?? 0;
  const remaining = planned - actual;
  const hasPlanned = line.allocated != null && planned > 0;

  const [activityFilter, setActivityFilter] = useState<ActivityMarkerFilter>("all");
  const [defaultMarker, setDefaultMarker] = useState<"Business" | "Personal" | "Partial" | null>(
    line.default_marker ?? null
  );
  const [defaultPct, setDefaultPct] = useState<number>(line.default_business_pct ?? 50);
  const [savingMarker, setSavingMarker] = useState(false);
  const [showPartialPop, setShowPartialPop] = useState(false);
  const partialPopRef = useRef<HTMLDivElement>(null);

  // Reset local state when the selected line changes
  useEffect(() => {
    setDefaultMarker(line.default_marker ?? null);
    setDefaultPct(line.default_business_pct ?? 50);
    setShowPartialPop(false);
  }, [line.id, line.default_marker, line.default_business_pct]);

  // Close partial popup on outside click
  useEffect(() => {
    if (!showPartialPop) return;
    function handleOutside(e: MouseEvent) {
      if (partialPopRef.current && !partialPopRef.current.contains(e.target as Node)) {
        setShowPartialPop(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showPartialPop]);

  async function saveDefaultMarker(marker: "Business" | "Personal" | "Partial" | null) {
    // For Partial, open the dial popup instead of saving immediately
    if (marker === "Partial" && defaultMarker !== "Partial") {
      setDefaultMarker("Partial");
      setShowPartialPop(true);
      return;
    }
    setSavingMarker(true);
    const pct = marker === "Business" ? 100 : marker === "Personal" ? 0 : defaultPct;
    setDefaultMarker(marker);
    setShowPartialPop(false);
    try {
      await fetch("/api/budget/lines", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: line.id, default_marker: marker, default_business_pct: pct }),
      });
      onUpdateLine(line.id, { default_marker: marker, default_business_pct: pct });
    } finally {
      setSavingMarker(false);
    }
  }

  async function confirmPartialPct(pct: number) {
    setDefaultPct(pct);
    setShowPartialPop(false);
    setSavingMarker(true);
    try {
      await fetch("/api/budget/lines", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: line.id, default_marker: "Partial", default_business_pct: pct }),
      });
      onUpdateLine(line.id, { default_marker: "Partial", default_business_pct: pct });
    } finally {
      setSavingMarker(false);
    }
  }

  useEffect(() => {
    setActivityFilter("all");
  }, [line.id]);

  const progressLabel = isIncome
    ? `${fmtNet(actual)} received${hasPlanned ? ` of ${fmtMoney(planned)}` : ""}`
    : `${fmtNet(actual)} spent${hasPlanned ? ` of ${fmtMoney(planned)}` : ""}`;

  const remainingLabel = isIncome ? "Left to receive" : "Remaining";
  const remainingValue = hasPlanned ? remaining : null;
  const remainingColor =
    remainingValue == null ? "var(--ink-3)"
    : remainingValue < 0 ? (isIncome ? "var(--forest)" : "var(--ember)")
    : remainingValue === 0 ? "var(--forest)"
    : "var(--ink)";

  const filteredActivity = activity.filter((tx) => {
    if (activityFilter === "all") return true;
    if (activityFilter === "unset") return !tx.marker;
    if (activityFilter === "business") return tx.marker === "Business";
    if (activityFilter === "personal") return tx.marker === "Personal";
    if (activityFilter === "partial") return tx.marker === "Partial";
    return true;
  });

  // Net the activity toward this line's direction: a transaction matching the
  // line's kind adds, an opposite one (e.g. a refund on an expense line) subtracts.
  const activityTotal = filteredActivity.reduce(
    (s, t) => s + (t.transaction_type === (group.kind ?? "expense") ? Math.abs(t.amount) : -Math.abs(t.amount)),
    0
  );

  return (
    <div className="line-rail">
      <div className={`line-rail__hero${isIncome ? " line-rail__hero--income" : " line-rail__hero--expense"}`}>
        <button type="button" className="line-rail__delete" onClick={onDelete} aria-label="Delete line">
          <ITrash size={15} />
        </button>
        <button type="button" className="line-rail__close" onClick={onClose} aria-label="Close">
          <IClose size={16} />
        </button>
      </div>

      <div className="line-rail__scroll">
        <h2 className="line-rail__title">{line.name}</h2>
        <p className={`line-rail__progress${isIncome ? " line-rail__progress--income" : " line-rail__progress--expense"}`}>
          {actual > 0 || hasPlanned ? progressLabel : "No activity this month"}
        </p>

        <div className="line-rail__stat-row">
          <span className="line-rail__stat-label">{remainingLabel}</span>
          <span className="line-rail__stat-value" style={{ color: remainingColor }}>
            {remainingValue != null ? fmtMoney(remainingValue) : "—"}
          </span>
        </div>

        {/* Default marker rule */}
        <div className="line-rail__rule">
          <div className="line-rail__rule-label">
            Deduction classification
            {defaultMarker && (
              <span className="line-rail__rule-badge">
                {defaultMarker === "Partial" ? `${defaultPct}% biz` : defaultMarker}
              </span>
            )}
          </div>
          <p className="line-rail__rule-hint">
            Set a default so every expense here is pre-classified for Schedule C. Business = fully deductible; Partial = pro-rated by percentage; Personal = not deductible.
          </p>
          <div style={{ position: "relative" }}>
            <div className="line-rail__rule-btns">
              {(["Business", "Personal", "Partial"] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  disabled={savingMarker}
                  className={`line-rail__rule-btn line-rail__rule-btn--${m.toLowerCase()}${defaultMarker === m ? " is-active" : ""}`}
                  onClick={() => saveDefaultMarker(defaultMarker === m ? null : m)}
                >
                  {m === "Partial" && defaultMarker === "Partial"
                    ? `${defaultPct}% biz`
                    : m}
                </button>
              ))}
              {defaultMarker && (
                <button
                  type="button"
                  className="line-rail__rule-btn line-rail__rule-btn--clear"
                  disabled={savingMarker}
                  onClick={() => saveDefaultMarker(null)}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Partial dial popup */}
            {showPartialPop && (
              <div className="line-rail__rule-pop" ref={partialPopRef}>
                <PartialDial
                  value={defaultPct}
                  onChange={pct => setDefaultPct(pct)}
                  compact
                />
                <div className="marker-editor__foot" style={{ paddingTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ fontSize: 12.5 }}
                    onClick={() => {
                      setShowPartialPop(false);
                      if (line.default_marker !== "Partial") setDefaultMarker(line.default_marker ?? null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    style={{ fontSize: 12.5 }}
                    onClick={() => confirmPartialPct(defaultPct)}
                  >
                    Accept ↵
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <section className="line-rail__activity">
          <div className="line-rail__activity-head">
            <h3 className="line-rail__activity-title">Activity</h3>
          </div>

          {activityLoading ? (
            <p className="line-rail__activity-empty">Loading…</p>
          ) : activity.length === 0 && !hasPlanned ? (
            <p className="line-rail__activity-empty">No transactions yet.</p>
          ) : filteredActivity.length === 0 ? (
            <p className="line-rail__activity-empty">No transactions match this filter.</p>
          ) : (
            <ul className="line-rail__activity-list">
              {filteredActivity.map(tx => {
                const d = fmtDate(tx.date);
                const label = tx.vendor || tx.description?.trim() || "—";
                const isOtherMonth = tx.date.slice(0, 7) !== month;
                const yearLabel = isOtherMonth
                  ? new Date(tx.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })
                  : null;
                return (
                  <li
                    key={tx.id}
                    className={`line-rail__activity-item${isOtherMonth ? " line-rail__activity-item--other-month" : ""}`}
                    draggable
                    onDragStart={(e) => onTxnDragStart(e, tx.id)}
                    onDragEnd={onTxnDragEnd}
                    title="Drag onto another line to move this transaction"
                    style={{ opacity: draggingTxId === tx.id ? 0.4 : undefined, cursor: "grab" }}
                  >
                    <div className="line-rail__activity-date">
                      <span>{d.mon}</span>
                      <strong>{d.day}</strong>
                      {isOtherMonth && <span className="line-rail__activity-year">{yearLabel}</span>}
                    </div>
                    <div className="line-rail__activity-body">
                      <div className="line-rail__activity-vendor">{label}</div>
                      {tx.description?.trim() && tx.description.trim() !== label && (
                        <div className="line-rail__activity-sub">{tx.description.trim()}</div>
                      )}
                    </div>
                    <div className={`line-rail__activity-amt${tx.transaction_type === "income" ? " line-rail__activity-amt--in" : ""}`}>
                      {tx.transaction_type === "income" ? "+" : "−"}{fmtMoney(Math.abs(tx.amount))}
                    </div>
                    <button
                      type="button"
                      className="line-rail__activity-delete"
                      onClick={() => onDeleteTxn(tx.id)}
                      title="Delete transaction"
                    >
                      <ITrash size={12} />
                    </button>
                  </li>
                );
              })}
              {hasPlanned && actual < planned && (
                <li className="line-rail__activity-item line-rail__activity-item--planned">
                  <div className="line-rail__activity-body">
                    <div className="line-rail__activity-vendor">Planned this month</div>
                  </div>
                  <div className="line-rail__activity-amt line-rail__activity-amt--planned">
                    {fmtMoney(planned - actual)}
                  </div>
                </li>
              )}
            </ul>
          )}

          {filteredActivity.length > 0 && (
            <div className="line-rail__activity-foot">
              {fmtNet(activityTotal)} {isIncome ? "received" : "spent"}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── BudgetGroup ────────────────────────────────────────────────────────────

interface BudgetGroupProps {
  group: BudgetGroupData;
  expanded: boolean;
  onToggle: () => void;
  selectedLineId: string | null;
  onSelectLine: (id: string) => void;
  editingPlanned: { lineId: string; value: string } | null;
  onStartEditPlanned: (lineId: string, current: number | null) => void;
  onChangePlanned: (value: string) => void;
  onSavePlanned: (lineId: string, value: string) => void;
  editingLineName: { lineId: string; value: string } | null;
  onStartEditLineName: (lineId: string, name: string) => void;
  onChangeLineName: (value: string) => void;
  onSaveLineName: (lineId: string, name: string) => void;
  onCancelEditLineName: () => void;
  editingGroupName: { groupId: string; value: string } | null;
  onStartEditGroupName: () => void;
  onChangeGroupName: (value: string) => void;
  onSaveGroupName: (groupId: string, name: string) => void;
  onCancelEditGroupName: () => void;
  onRequestDeleteGroup: (groupId: string) => void;
  dropTargetLineId: string | null;
  onDragOverLine: (e: React.DragEvent, lineId: string, groupId: string, groupKind?: string) => void;
  onDropOnLine: (e: React.DragEvent, lineId: string, groupId: string, groupKind?: string) => void;
  draggingLineId: string | null;
  draggingLineKind: string | null;
  lineDropTarget: { groupId: string; index: number } | null;
  onLineDragStart: (e: React.DragEvent, lineId: string) => void;
  onLineDragEnd: () => void;
  onLineDragOverGroup: (e: React.DragEvent, groupId: string, index: number, groupKind?: string) => void;
  onLineDrop: (e: React.DragEvent, groupId: string, index: number, groupKind?: string) => void;
  onDragOverGroupBody: (e: React.DragEvent, groupId: string, groupKind?: string) => void;
  onDropOnGroupBody: (e: React.DragEvent, groupId: string, groupKind?: string) => void;
  onStartAddLine: () => void;
  secondCol: "remaining" | "actual";
  onChangeSecondCol: (v: "remaining" | "actual") => void;
}

function BudgetGroup({
  group, expanded, onToggle,
  selectedLineId, onSelectLine,
  editingPlanned, onStartEditPlanned, onChangePlanned, onSavePlanned,
  editingLineName, onStartEditLineName, onChangeLineName, onSaveLineName, onCancelEditLineName,
  editingGroupName, onStartEditGroupName, onChangeGroupName, onSaveGroupName, onCancelEditGroupName,
  onRequestDeleteGroup,
  dropTargetLineId, onDragOverLine, onDropOnLine,
  draggingLineId, draggingLineKind, lineDropTarget,
  onLineDragStart, onLineDragEnd, onLineDragOverGroup, onLineDrop,
  onDragOverGroupBody, onDropOnGroupBody,
  onStartAddLine,
  secondCol, onChangeSecondCol,
}: BudgetGroupProps) {
  const isEditingThisGroup = editingGroupName?.groupId === group.id;
  const totalAllocated = group.budget_lines.reduce((s, l) => s + (l.allocated ?? 0), 0);
  const totalActual = group.budget_lines.reduce((s, l) => s + (l.actual ?? 0), 0);
  const barColor = group.kind === "income" ? "var(--forest)" : "var(--clay)";
  const groupKind = group.kind ?? "expense";
  const isIncome = group.kind === "income";
  const actualLabel = isIncome ? "Received" : "Spent";
  const [colDropOpen, setColDropOpen] = useState(false);
  const colDropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!colDropOpen) return;
    function handleOut(e: MouseEvent) {
      if (colDropRef.current && !colDropRef.current.contains(e.target as Node)) setColDropOpen(false);
    }
    document.addEventListener("mousedown", handleOut);
    return () => document.removeEventListener("mousedown", handleOut);
  }, [colDropOpen]);
  const canAcceptLineDrop =
    !!draggingLineId && (!draggingLineKind || draggingLineKind === groupKind);
  const isGroupDropAppend =
    canAcceptLineDrop &&
    lineDropTarget?.groupId === group.id &&
    lineDropTarget.index === group.budget_lines.length;

  return (
    <div
      className={`group${canAcceptLineDrop ? " group--line-drop-ok" : ""}${draggingLineId && !canAcceptLineDrop ? " group--line-drop-no" : ""}`}
      data-budget-group-id={group.id}
    >
      {/* Group header */}
      <div className="group__head" onClick={!isEditingThisGroup ? onToggle : undefined}>
        <div className="group__head-l">
          <div className="group__bar" style={{ background: barColor }} />
          <EditableName
            className="group__name"
            value={group.name}
            editing={isEditingThisGroup}
            editValue={editingGroupName?.value ?? group.name}
            onStartEdit={onStartEditGroupName}
            onChange={onChangeGroupName}
            onSave={() => onSaveGroupName(group.id, editingGroupName!.value)}
            onCancel={() => {
              onChangeGroupName(group.name);
              onCancelEditGroupName();
            }}
          />
        </div>
        <div className="group__head-r">
          <span className="group__chev" onClick={(e) => { e.stopPropagation(); onRequestDeleteGroup(group.id); }}>
            <IClose size={13} />
          </span>
          <span className="group__chev">
            {expanded ? <IChevronD size={14} /> : <IChevronR size={14} />}
          </span>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div
          className="group__body"
          onDragOver={e => onDragOverGroupBody(e, group.id, groupKind)}
          onDrop={e => onDropOnGroupBody(e, group.id, groupKind)}
        >
          {/* Column headers */}
          {group.budget_lines.length > 0 && (
            <div className="group__columns">
              <div>Line</div>
              <div className="group__columns-num">Planned</div>
              <div className="group__columns-num" ref={colDropRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  className="group__col-toggle"
                  onClick={() => setColDropOpen(p => !p)}
                >
                  {secondCol === "remaining" ? "Remaining" : actualLabel}
                  {colDropOpen
                    ? <IChevronU size={12} className="group__col-toggle-chev" />
                    : <IChevronD size={12} className="group__col-toggle-chev" />}
                </button>
                {colDropOpen && (
                  <div className="group__col-drop">
                    {(["remaining", "actual"] as const).map(opt => (
                      <button
                        key={opt}
                        type="button"
                        className={`group__col-drop-item${secondCol === opt ? " is-active" : ""}`}
                        onClick={() => { onChangeSecondCol(opt); setColDropOpen(false); }}
                      >
                        <span className="group__col-drop-check">{secondCol === opt ? "✓" : ""}</span>
                        {opt === "remaining" ? "Remaining" : actualLabel}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lines */}
          {group.budget_lines.map((line, lineIndex) => (
            <BudgetLine
              key={line.id}
              line={line}
              selected={selectedLineId === line.id}
              isIncome={group.kind === "income"}
              onSelect={() => onSelectLine(line.id)}
              isDragging={draggingLineId === line.id}
              isDropTarget={!draggingLineId && dropTargetLineId === line.id}
              isLineDropBefore={
                lineDropTarget?.groupId === group.id && lineDropTarget.index === lineIndex
              }
              isLineDropAfter={
                lineDropTarget?.groupId === group.id && lineDropTarget.index === lineIndex + 1
              }
              onDragOver={e => onDragOverLine(e, line.id, group.id, groupKind)}
              onDrop={e => onDropOnLine(e, line.id, group.id, groupKind)}
              onLineDragStart={onLineDragStart}
              onLineDragEnd={onLineDragEnd}
              editingPlanned={editingPlanned?.lineId === line.id ? editingPlanned : null}
              onStartEditPlanned={() => onStartEditPlanned(line.id, line.allocated)}
              onChangePlanned={onChangePlanned}
              onSavePlanned={(val) => onSavePlanned(line.id, val)}
              editingLineName={editingLineName?.lineId === line.id ? editingLineName : null}
              onStartEditLineName={() => onStartEditLineName(line.id, line.name)}
              onChangeLineName={onChangeLineName}
              onSaveLineName={(name) => onSaveLineName(line.id, name)}
              onCancelEditLineName={onCancelEditLineName}
              secondCol={secondCol}
            />
          ))}

          {draggingLineId && (
            <div
              className={`group__line-drop${isGroupDropAppend ? " is-active" : ""}`}
              onDragOver={e => onLineDragOverGroup(e, group.id, group.budget_lines.length, groupKind)}
              onDrop={e => onLineDrop(e, group.id, group.budget_lines.length, groupKind)}
            >
              Drop here to add to end of group
            </div>
          )}

          {/* Add line */}
          <div className="group__add-row">
            <button type="button" className="group__additem" onClick={onStartAddLine}>
              <IPlus size={12} /> Add line
            </button>
          </div>

          {/* Group footer totals */}
          {group.budget_lines.length > 0 && (
            <div className="group__foot">
              <div className="group__foot-label">Total</div>
              <div className="group__foot-num">{totalAllocated > 0 ? fmtMoney(totalAllocated) : "—"}</div>
              <div className="group__foot-num">
                {secondCol === "actual"
                  ? fmtNet(totalActual)
                  : totalAllocated > 0 ? fmtMoney(totalAllocated - totalActual) : "—"}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── BudgetLine ─────────────────────────────────────────────────────────────

interface BudgetLineProps {
  line: BudgetLineData;
  selected: boolean;
  isIncome: boolean;
  onSelect: () => void;
  isDragging: boolean;
  isDropTarget: boolean;
  isLineDropBefore: boolean;
  isLineDropAfter: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onLineDragStart: (e: React.DragEvent, lineId: string) => void;
  onLineDragEnd: () => void;
  editingPlanned: { lineId: string; value: string } | null;
  onStartEditPlanned: () => void;
  onChangePlanned: (v: string) => void;
  onSavePlanned: (v: string) => void;
  editingLineName: { lineId: string; value: string } | null;
  onStartEditLineName: () => void;
  onChangeLineName: (v: string) => void;
  onSaveLineName: (name: string) => void;
  onCancelEditLineName: () => void;
  secondCol: "remaining" | "actual";
}

function BudgetLine({
  line, selected, isIncome, onSelect,
  isDragging, isDropTarget, isLineDropBefore, isLineDropAfter,
  onDragOver, onDrop, onLineDragStart, onLineDragEnd,
  editingPlanned, onStartEditPlanned, onChangePlanned, onSavePlanned,
  editingLineName, onStartEditLineName, onChangeLineName, onSaveLineName, onCancelEditLineName,
  secondCol,
}: BudgetLineProps) {
  const actual = line.actual ?? 0;
  const planned = line.allocated ?? 0;
  const remaining = planned - actual;
  // Mirror the alloc-banner: wheat-deep=has room, forest=exact, ember=over
  const remainingColor =
    line.allocated == null ? "var(--ink-4)"
    : remaining < 0 ? "var(--ember)"
    : remaining === 0 ? "var(--forest)"
    : "var(--wheat-deep)";
  const secondColValue = secondCol === "actual"
    ? (actual !== 0 ? fmtNet(actual) : "—")
    : (line.allocated != null ? fmtMoney(remaining) : "—");
  const secondColColor = secondCol === "actual" ? "var(--ink-2)" : remainingColor;

  return (
    <div
      className={`line${selected ? " is-active" : ""}${isDropTarget ? " is-drop-target" : ""}${isDragging ? " is-line-dragging" : ""}${isLineDropBefore ? " is-line-drop-before" : ""}${isLineDropAfter ? " is-line-drop-after" : ""}`}
      data-kind={isIncome ? "income" : "expense"}
      data-budget-line-id={line.id}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div
        className="line__row"
        onClick={onSelect}
        onDragOver={e => e.preventDefault()}
      >
        <button
          type="button"
          className="line__drag"
          draggable
          title="Drag to reorder or move to another group"
          onClick={e => e.stopPropagation()}
          onDragStart={e => {
            e.stopPropagation();
            onLineDragStart(e, line.id);
          }}
          onDragEnd={e => {
            e.stopPropagation();
            onLineDragEnd();
          }}
        >
          <IDrag size={12} />
        </button>
        {/* Name */}
        <div className="line__name">
          <EditableName
            value={line.name}
            editing={!!editingLineName}
            editValue={editingLineName?.value ?? line.name}
            onStartEdit={onStartEditLineName}
            onChange={onChangeLineName}
            onSave={() => onSaveLineName(editingLineName!.value)}
            onCancel={onCancelEditLineName}
          />
        </div>

        {/* Planned */}
        <div className="line__planned" onClick={(e) => { e.stopPropagation(); onStartEditPlanned(); }}>
          {editingPlanned ? (
            <input
              autoFocus
              className="line__plan-input"
              value={editingPlanned.value}
              onChange={e => onChangePlanned(e.target.value)}
              onClick={e => e.stopPropagation()}
              onKeyDown={e => {
                if (e.key === "Enter") onSavePlanned(editingPlanned.value);
                if (e.key === "Escape") onSavePlanned(editingPlanned.value);
              }}
              onBlur={() => onSavePlanned(editingPlanned.value)}
            />
          ) : (
            <span style={{ color: line.allocated == null ? "var(--ink-4)" : "var(--ink)" }}>
              {line.allocated != null ? fmtMoney(line.allocated) : "—"}
            </span>
          )}
        </div>

        {/* Second column — Remaining or Actual */}
        <div className="line__second-col" style={{ color: secondColColor }}>
          {secondColValue}
        </div>
      </div>
    </div>
  );
}

// ─── TxnCard ────────────────────────────────────────────────────────────────

interface TxnCardProps {
  tx: Txn;
  dragging: boolean;
  markerPopOpen: boolean;
  showYear?: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onQuickTag: (marker: Marker) => void;
  onOpenPartialEditor: () => void;
  onCloseMarkerPop: () => void;
  onSaveMarker: (marker: Marker, businessPct: number) => void;
  onDelete: () => void;
}

function TxnCard({
  tx,
  dragging,
  markerPopOpen,
  showYear = false,
  onDragStart,
  onDragEnd,
  onQuickTag,
  onOpenPartialEditor,
  onCloseMarkerPop,
  onSaveMarker,
  onDelete,
}: TxnCardProps) {
  const { day, mon } = fmtDate(tx.date);
  const year = showYear ? new Date(tx.date + "T12:00:00").getFullYear() : null;
  const isPos = tx.transaction_type === "income";

  return (
    <div
      className="txn"
      draggable
      onDragStart={e => onDragStart(e, tx.id)}
      onDragEnd={onDragEnd}
      style={{ opacity: dragging ? 0.4 : 1 }}
    >
      <div className="txn__row">
        {/* Date chip */}
        <div className="txn__date">
          <em>{mon}</em>
          {day}
          {year != null && <span className="txn__date-year">{year}</span>}
        </div>

        {/* Vendor + hint */}
        <div>
          <div className="txn__vendor">{tx.vendor || "—"}</div>
          {tx.category && (
            <div className="txn__hint">
              <span>{tx.category}</span>
            </div>
          )}
        </div>

        {/* Amount */}
        <div className={`txn__amount${isPos ? " is-pos" : ""}`}>
          {isPos ? "+" : "−"}{fmtMoney(Math.abs(tx.amount))}
        </div>

        {/* Drag handle */}
        <div className="txn__drag">
          <IDrag size={12} />
        </div>

        {/* Delete */}
        <button
          type="button"
          className="txn__delete"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Delete transaction"
        >
          <ITrash size={13} />
        </button>
      </div>

      {/* Quick tag + optional partial editor */}
      <div className="txn__marker-row">
        <div className="txn__quick-tags">
          <button
            type="button"
            className={`txn__quick-tag txn__quick-tag--personal${tx.marker === "Personal" ? " is-active" : ""}`}
            onClick={() => onQuickTag("Personal")}
          >
            <span className="pdot" />
            Personal
          </button>
          <button
            type="button"
            className={`txn__quick-tag txn__quick-tag--business${tx.marker === "Business" ? " is-active" : ""}`}
            onClick={() => onQuickTag("Business")}
          >
            <span className="pdot" />
            Business
          </button>
          <button
            type="button"
            className={`txn__quick-tag txn__quick-tag--partial${tx.marker === "Partial" ? " is-active" : ""}`}
            onClick={async () => {
              if (tx.marker !== "Partial") await onQuickTag("Partial");
              onOpenPartialEditor();
            }}
          >
            <span className="psplit">
              <span className="s-per" style={{ width: `${100 - (tx.business_pct ?? 50)}%` }} />
              <span className="s-biz" style={{ width: `${tx.business_pct ?? 50}%` }} />
            </span>
            {tx.marker === "Partial" ? `${tx.business_pct ?? 50}% biz · edit` : "Partial"}
          </button>
        </div>
        {tx.business_purpose && (
          <p className="txn__audit-reason" title="Audit reason">
            {tx.business_purpose}
          </p>
        )}
        {markerPopOpen && (
          <div className="txn__marker-anchor">
            <div className="txn__marker-pop">
              <MarkerEditor
                marker={tx.marker ?? "Partial"}
                businessPct={tx.business_pct ?? 50}
                onSave={onSaveMarker}
                onClose={onCloseMarkerPop}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SummaryTab ─────────────────────────────────────────────────────────────

// Distinct color palettes that stay visually separate for income vs expense
const INCOME_HUES  = [142, 162, 122, 170, 135, 155];
const EXPENSE_HUES = [22, 210, 340, 48, 280, 190, 15, 260];

function incomeColor(i: number)  { return `hsl(${INCOME_HUES[i % INCOME_HUES.length]}, 52%, 42%)`; }
function expenseColor(i: number) { return `hsl(${EXPENSE_HUES[i % EXPENSE_HUES.length]}, 62%, 52%)`; }

interface DonutSegment { value: number; color: string; }

function DonutChart({ segments, centerLabel, centerValue }: {
  segments: DonutSegment[];
  centerLabel: string;
  centerValue: string;
}) {
  const R = 40;
  const C = 2 * Math.PI * R;
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (total === 0) return null;

  let accumulated = 0;
  return (
    <div className="summary__donut-wrap" style={{ width: 120, height: 120, flexShrink: 0 }}>
      <svg width="120" height="120" viewBox="0 0 100 100" aria-hidden="true">
        {/* Track */}
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--bone-3)" strokeWidth="13" />
        {segments.map((seg, i) => {
          const v = Math.max(0, seg.value);
          if (v === 0) return null;
          const dash = (v / total) * C;
          const offset = C / 4 - accumulated;
          accumulated += dash;
          return (
            <circle
              key={i}
              cx="50" cy="50" r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth="13"
              strokeDasharray={`${dash} ${C}`}
              strokeDashoffset={offset}
            />
          );
        })}
      </svg>
      <div className="summary__donut-center">
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-3)" }}>
          {centerLabel}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--ink)", marginTop: 1 }}>
          {centerValue}
        </div>
      </div>
    </div>
  );
}

function SummaryGroupTable({ title, groups, colors, total }: {
  title: string;
  groups: BudgetGroupData[];
  colors: string[];
  total: number;
}) {
  return (
    <div className="summary__table">
      <div className="summary__table-section">{title}</div>
      <div className="summary__table-head">
        <div>Group</div>
        <div className="summary__table-col">Budget</div>
        <div className="summary__table-col">%</div>
      </div>
      {groups.map((g, i) => {
        const gTotal = g.budget_lines.reduce((s, l) => s + (l.allocated ?? 0), 0);
        const pct = total > 0 ? Math.round((gTotal / total) * 100) : 0;
        return (
          <div key={g.id} className="summary__row">
            <div className="summary__name">
              <div className="summary__dot" style={{ background: colors[i] }} />
              {g.name}
            </div>
            <div className="summary__table-col">{fmtMoney(gTotal)}</div>
            <div className="summary__table-col">{pct}%</div>
          </div>
        );
      })}
      <div className="summary__row summary__row--total">
        <div><strong>Total</strong></div>
        <div className="summary__table-col"><strong>{fmtMoney(total)}</strong></div>
        <div className="summary__table-col"><strong>100%</strong></div>
      </div>
    </div>
  );
}

function SummaryTab({ groups, income, spending }: { groups: BudgetGroupData[]; income: number; spending: number }) {
  const incomeGroups  = groups.filter(g => g.kind === "income");
  const expenseGroups = groups.filter(g => g.kind !== "income");

  const totalIncomeAllocated  = incomeGroups.reduce((s, g) => s + g.budget_lines.reduce((a, l) => a + (l.allocated ?? 0), 0), 0);
  const totalExpenseAllocated = expenseGroups.reduce((s, g) => s + g.budget_lines.reduce((a, l) => a + (l.allocated ?? 0), 0), 0);

  const incomeColors  = incomeGroups.map((_, i) => incomeColor(i));
  const expenseColors = expenseGroups.map((_, i) => expenseColor(i));

  const incomeSegments  = incomeGroups.map((g, i) => ({
    value: g.budget_lines.reduce((s, l) => s + (l.allocated ?? 0), 0),
    color: incomeColors[i],
  }));
  const expenseSegments = expenseGroups.map((g, i) => ({
    value: g.budget_lines.reduce((s, l) => s + (l.allocated ?? 0), 0),
    color: expenseColors[i],
  }));

  const hasGroups = groups.length > 0;

  return (
    <div className="summary">
      {/* Quick stats */}
      <div className="summary__stats">
        <div className="summary__stat">
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 }}>Income</div>
          <div style={{ fontWeight: 700, fontSize: 17, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
            {fmtMoney(income)}
          </div>
        </div>
        <div className="summary__stat">
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 }}>Budgeted</div>
          <div style={{ fontWeight: 700, fontSize: 17, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
            {fmtMoney(totalExpenseAllocated)}
          </div>
        </div>
        <div className="summary__stat">
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 600 }}>Spending</div>
          <div style={{ fontWeight: 700, fontSize: 17, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
            {fmtMoney(spending)}
          </div>
        </div>
      </div>

      {/* Pie charts */}
      {hasGroups && (expenseGroups.length > 0 || incomeGroups.length > 0) && (
        <div className="summary__donuts">
          {expenseGroups.length > 0 && (
            <div className="summary__donut-block">
              <DonutChart
                segments={expenseSegments}
                centerLabel="Expenses"
                centerValue={fmtMoney(totalExpenseAllocated)}
              />
              <div className="summary__donut-legend">
                {expenseGroups.map((g, i) => (
                  <div key={g.id} className="summary__donut-key">
                    <span className="summary__dot" style={{ background: expenseColors[i], flexShrink: 0 }} />
                    <span className="summary__donut-key-label">{g.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {incomeGroups.length > 0 && (
            <div className="summary__donut-block">
              <DonutChart
                segments={incomeSegments}
                centerLabel="Income"
                centerValue={fmtMoney(totalIncomeAllocated)}
              />
              <div className="summary__donut-legend">
                {incomeGroups.map((g, i) => (
                  <div key={g.id} className="summary__donut-key">
                    <span className="summary__dot" style={{ background: incomeColors[i], flexShrink: 0 }} />
                    <span className="summary__donut-key-label">{g.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expense groups table */}
      {expenseGroups.length > 0 && (
        <SummaryGroupTable
          title="Expenses"
          groups={expenseGroups}
          colors={expenseColors}
          total={totalExpenseAllocated}
        />
      )}

      {/* Income groups table */}
      {incomeGroups.length > 0 && (
        <SummaryGroupTable
          title="Income"
          groups={incomeGroups}
          colors={incomeColors}
          total={totalIncomeAllocated}
        />
      )}

      {!hasGroups && (
        <div style={{ textAlign: "center", padding: "32px 0", color: "var(--ink-3)", fontSize: 13 }}>
          Add groups to see a summary
        </div>
      )}
    </div>
  );
}
