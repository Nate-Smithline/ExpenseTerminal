"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PageHead } from "@/components/PageHead";
import { PartialDial } from "@/components/PartialDial";
import { MarkerPill, type Marker } from "@/components/MarkerPill";
import { HelpTooltip } from "@/components/HelpTooltip";
import { IBolt, ICheck, IRules, ITax, IReview } from "@/components/ui/icons";
import { RULE_OFFER_TIMEOUT_MS, RULE_SEEN_THRESHOLD } from "@/lib/triage/constants";
import { triageTransactionImpact } from "@/lib/triage/tax-rate";
import { MEAL_50_PCT_TOOLTIP, TAX_GOOD_FAITH_DISCLAIMER } from "@/lib/tax/disclaimer";
import type { TaxDraft, TriageQueueItem } from "@/lib/triage/queue-map";
import { taxDraftFromQueueItem } from "@/lib/triage/queue-map";
import { isExpenseTriageComplete, normalizedTaxDraftLine } from "@/lib/triage/tax-draft";
import {
  formatScheduleCLineShort,
  SCHEDULE_C_LINES,
  categoryLabelForLine,
} from "@/lib/triage/schedule-c-display";
import type { TriageProgressRow } from "@/lib/triage/progress";

const CARD_EXIT_MS = 240;

type Mode = "expenses" | "income";

type Decision = { marker: Marker; pct: number; viaRule?: boolean };

type SessionImpact = {
  taxSaved: number;
  deductions: number;
  excluded: number;
  sorted: number;
};

type HistoryEntry = {
  mode: Mode;
  transactionId: string;
  prevMarker: Marker | null;
  prevPct: number | null;
  decision: Decision;
  ruleVendorKey?: string;
  bulkIds?: string[];
  impact?: SessionImpact;
};

function emptySessionImpact(): SessionImpact {
  return { taxSaved: 0, deductions: 0, excluded: 0, sorted: 0 };
}

function addSessionImpact(a: SessionImpact, b: SessionImpact): SessionImpact {
  return {
    taxSaved: a.taxSaved + b.taxSaved,
    deductions: a.deductions + b.deductions,
    excluded: a.excluded + b.excluded,
    sorted: a.sorted + b.sorted,
  };
}

function subtractSessionImpact(a: SessionImpact, b: SessionImpact): SessionImpact {
  return {
    taxSaved: Math.max(0, a.taxSaved - b.taxSaved),
    deductions: Math.max(0, a.deductions - b.deductions),
    excluded: Math.max(0, a.excluded - b.excluded),
    sorted: Math.max(0, a.sorted - b.sorted),
  };
}

function sessionImpactFromItem(
  amount: number,
  marker: Marker,
  businessPct: number,
  mode: Mode,
): SessionImpact {
  if (!marker) return emptySessionImpact();
  const transactionType = mode === "income" ? "income" : "expense";
  const { deltaDeduction, deltaTax } = triageTransactionImpact(
    amount,
    marker,
    businessPct,
    transactionType,
  );
  if (mode === "income" && marker === "Personal") {
    return { taxSaved: 0, deductions: 0, excluded: amount, sorted: 1 };
  }
  return {
    taxSaved: deltaTax,
    deductions: deltaDeduction,
    excluded: 0,
    sorted: 1,
  };
}

function sessionImpactFromRuleApi(impact: {
  deltaTax: number;
  deltaDeduction: number;
  updatedCount: number;
}): SessionImpact {
  return {
    taxSaved: impact.deltaTax,
    deductions: impact.deltaDeduction,
    excluded: 0,
    sorted: impact.updatedCount,
  };
}

type RuleRow = {
  id: string;
  vendorKey: string;
  vendor: string;
  marker: Marker;
  businessPct: number;
  mode: string;
};

function usd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function markerLabel(m: Marker, pct: number): string {
  if (m === "Partial") return `Partial · ${Math.round(pct)}% biz`;
  if (!m) return "—";
  return m;
}

function dirFor(m: Marker): "left" | "right" | "down" {
  if (m === "Personal") return "left";
  if (m === "Business") return "right";
  return "down";
}

function suggestDataAttr(m: Marker | null): string {
  if (m === "Personal") return "personal";
  if (m === "Business") return "business";
  if (m === "Partial") return "partial";
  return "partial";
}

function formatTriageDate(dateStr: string): string {
  const iso = dateStr.length <= 10 ? `${dateStr}T12:00:00` : dateStr;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TriagePageClient() {
  const [mode, setMode] = useState<Mode>("expenses");
  const [items, setItems] = useState<TriageQueueItem[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const [logIds, setLogIds] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [exiting, setExiting] = useState<{
    id: string;
    dir: "left" | "right" | "down";
  } | null>(null);
  const [partial, setPartial] = useState<number | null>(null);
  const [ruleOffer, setRuleOffer] = useState<{
    vendorKey: string;
    vendor: string;
    marker: Marker;
    pct: number;
    queueCount: number;
    seen: number;
    mode: Mode;
  } | null>(null);
  const [progress, setProgress] = useState<TriageProgressRow | null>(null);
  const [sessionImpact, setSessionImpact] = useState<SessionImpact>(emptySessionImpact);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [taxDrafts, setTaxDrafts] = useState<Record<string, TaxDraft>>({});
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [triageHint, setTriageHint] = useState<string | null>(null);
  const enrichedRef = useRef<Set<string>>(new Set());
  const busy = useRef(false);

  const loadQueue = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setLoadError(null);
    try {
      const [qRes, pRes] = await Promise.all([
        fetch(`/api/triage/queue?mode=${mode === "income" ? "income" : "expense"}`),
        opts?.silent ? Promise.resolve(null) : fetch("/api/triage/progress"),
      ]);
      const qBody = await qRes.json();
      if (!qRes.ok) {
        setLoadError(qBody.error ?? "Could not load triage queue");
        setItems([]);
        setRules([]);
      } else {
        setItems(qBody.items ?? []);
        setRules(qBody.rules ?? []);
      }
      if (pRes) {
        const pBody = pRes.ok ? await pRes.json() : { progress: null };
        if (pBody.progress) setProgress(pBody.progress);
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    setExiting(null);
    setDecisions({});
    setSkipped({});
    setLogIds([]);
    setHistory([]);
    setRuleOffer(null);
    setPartial(null);
    setTaxDrafts({});
    enrichedRef.current = new Set();
    void loadQueue();
  }, [mode, loadQueue]);

  const remaining = useMemo(
    () => items.filter((it) => !decisions[it.id] && !skipped[it.id]),
    [items, decisions, skipped],
  );
  const current = remaining[0];
  const stack = remaining.slice(0, 1);
  const hasPartial = mode === "expenses";
  const done = !loading && remaining.length === 0;
  const currentTaxDraft = current ? taxDrafts[current.id] : undefined;
  const expenseTaxReady =
    mode !== "expenses" || isExpenseTriageComplete(currentTaxDraft);

  useEffect(() => {
    if (expenseTaxReady) setTriageHint(null);
  }, [expenseTaxReady, current?.id]);

  useEffect(() => {
    if (!current || current.transactionType !== "expense") return;
    setTaxDrafts((prev) => {
      if (prev[current.id]) return prev;
      return { ...prev, [current.id]: taxDraftFromQueueItem(current) };
    });
  }, [current]);

  useEffect(() => {
    if (!current || current.transactionType !== "expense") return;
    const hasLine = Boolean(current.scheduleCLine);
    const hasReason =
      Boolean(current.businessPurpose?.trim()) ||
      current.reasonSuggestions.length > 0;
    if (hasLine && hasReason) return;
    if (enrichedRef.current.has(current.id)) return;

    const txnId = current.id;
    let cancelled = false;
    enrichedRef.current.add(txnId);
    setEnrichingId(txnId);

    fetch("/api/triage/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: txnId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || data.error) return;
        setTaxDrafts((prev) => ({
          ...prev,
          [txnId]: {
            scheduleCLine:
              normalizedTaxDraftLine(data.scheduleCLine) ??
              prev[txnId]?.scheduleCLine ??
              null,
            category: data.category ?? prev[txnId]?.category ?? null,
            quickLabel: data.quickLabels?.[0] ?? prev[txnId]?.quickLabel ?? null,
            businessPurpose:
              data.businessPurpose ??
              data.quickLabels?.[0] ??
              prev[txnId]?.businessPurpose ??
              null,
          },
        }));
        setItems((prev) =>
          prev.map((it) =>
            it.id === txnId
              ? {
                  ...it,
                  scheduleCLine: data.scheduleCLine ?? it.scheduleCLine,
                  category: data.category ?? it.category,
                  reasonSuggestions:
                    data.quickLabels?.length > 0
                      ? data.quickLabels
                      : it.reasonSuggestions,
                  businessPurpose: data.businessPurpose ?? it.businessPurpose,
                  deductionPercent: data.deductionPercent ?? it.deductionPercent,
                  isMeal: data.isMeal ?? it.isMeal,
                  isTravel: data.isTravel ?? it.isTravel,
                }
              : it,
          ),
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setEnrichingId(null);
      });

    return () => {
      cancelled = true;
    };
  }, [current]);

  const maybeOfferRule = (cur: TriageQueueItem, dec: Decision) => {
    if (rules.some((r) => r.vendorKey === cur.vendorKey)) return;
    const others = items.filter(
      (it) =>
        it.vendorKey === cur.vendorKey &&
        it.id !== cur.id &&
        !decisions[it.id] &&
        !skipped[it.id],
    );
    const eligible =
      others.length >= 1 || (cur.seen ?? 0) >= RULE_SEEN_THRESHOLD;
    if (eligible) {
      setRuleOffer({
        vendorKey: cur.vendorKey,
        vendor: cur.vendor,
        marker: dec.marker,
        pct: dec.pct,
        queueCount: others.length,
        seen: cur.seen ?? 0,
        mode,
      });
    }
  };

  const persistDecision = async (
    id: string,
    marker: Marker,
    businessPct: number,
    tax: TaxDraft | undefined,
    undo = false,
  ) => {
    const payload: Record<string, unknown> = {
      id,
      marker,
      business_pct: businessPct,
      undo,
    };
    if (tax && marker !== "Personal") {
      payload.schedule_c_line = tax.scheduleCLine;
      payload.category = tax.category;
      payload.quick_label = tax.quickLabel;
      payload.business_purpose = tax.businessPurpose;
    }
    const res = await fetch("/api/triage/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const body = await res.json();
      if (body.progress) setProgress(body.progress);
    }
  };

  const requireExpenseTaxReady = (): boolean => {
    if (expenseTaxReady) return true;
    setTriageHint("Add a Schedule C line and reason before marking as business.");
    return false;
  };

  const decide = (marker: Marker, pct?: number) => {
    if (busy.current || !current || !marker) return;
    if (mode === "expenses" && marker !== "Personal" && !requireExpenseTaxReady()) return;
    const cur = current;
    const businessPct =
      marker === "Business" ? 100 : marker === "Personal" ? 0 : (pct ?? 50);
    const dec: Decision = { marker, pct: businessPct / 100 };
    busy.current = true;
    setExiting({ id: cur.id, dir: dirFor(marker) });
    setPartial(null);
    window.setTimeout(() => {
      const prev = decisions[cur.id];
      const impact = sessionImpactFromItem(
        cur.amount,
        marker,
        businessPct,
        mode,
      );
      setSessionImpact((s) => addSessionImpact(s, impact));
      setHistory((h) => [
        ...h,
        {
          mode,
          transactionId: cur.id,
          prevMarker: prev?.marker ?? null,
          prevPct: prev ? Math.round(prev.pct * 100) : null,
          decision: dec,
          impact,
        },
      ]);
      setDecisions((d) => ({ ...d, [cur.id]: dec }));
      setLogIds((l) => [...l, cur.id]);
      setExiting(null);
      busy.current = false;
      void persistDecision(cur.id, marker, businessPct, taxDrafts[cur.id]);
      maybeOfferRule(cur, dec);
    }, CARD_EXIT_MS);
  };

  const acceptAI = () => {
    if (!current) return;
    const m = current.suggest;
    if (!m) return;
    if (m === "Partial") {
      decide("Partial", Math.round(current.pct * 100));
    } else {
      decide(m);
    }
  };

  const openPartial = () => {
    if (!current || !hasPartial) return;
    setPartial(
      current.suggest === "Partial"
        ? Math.round(current.pct * 100)
        : 50,
    );
  };

  const skip = () => {
    if (busy.current || !current) return;
    const cur = current;
    busy.current = true;
    setExiting({ id: cur.id, dir: "down" });
    window.setTimeout(() => {
      setHistory((h) => [
        ...h,
        {
          mode,
          transactionId: cur.id,
          prevMarker: null,
          prevPct: null,
          decision: { marker: null, pct: 0 },
        },
      ]);
      setSkipped((s) => ({ ...s, [cur.id]: true }));
      setExiting(null);
      busy.current = false;
    }, CARD_EXIT_MS);
  };

  const createRule = async () => {
    const off = ruleOffer;
    if (!off || !off.marker) return;
    const matching = items.filter(
      (it) =>
        it.vendorKey === off.vendorKey &&
        !decisions[it.id] &&
        !skipped[it.id],
    );
    const businessPct =
      off.marker === "Business"
        ? 100
        : off.marker === "Personal"
          ? 0
          : Math.round(off.pct * 100);

    const res = await fetch("/api/triage/rule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorNormalized: off.vendorKey,
        marker: off.marker,
        business_pct: businessPct,
        transactionType: off.mode === "income" ? "income" : "expense",
      }),
    });

    if (res.ok) {
      const body = await res.json();
      if (body.progress) setProgress(body.progress);
      const ruleImpact = body.impact
        ? sessionImpactFromRuleApi(body.impact)
        : emptySessionImpact();
      if (ruleImpact.sorted > 0 || ruleImpact.taxSaved > 0) {
        setSessionImpact((s) => addSessionImpact(s, ruleImpact));
      }
      const dec: Decision = { marker: off.marker, pct: businessPct / 100, viaRule: true };
      const decMap: Record<string, Decision> = {};
      const ids: string[] = [];
      matching.forEach((it) => {
        decMap[it.id] = dec;
        ids.push(it.id);
      });
      setHistory((h) => [
        ...h,
        {
          mode: off.mode,
          transactionId: current?.id ?? ids[0] ?? "",
          prevMarker: null,
          prevPct: null,
          decision: dec,
          ruleVendorKey: off.vendorKey,
          bulkIds: ids,
          impact: ruleImpact,
        },
      ]);
      if (ids.length) {
        setDecisions((d) => ({ ...d, ...decMap }));
        setLogIds((l) => [...l, ...ids]);
      }
      setRules((r) => [
        ...r,
        {
          id: body.ruleId,
          vendorKey: off.vendorKey,
          vendor: off.vendor,
          marker: off.marker,
          businessPct,
          mode: off.mode === "income" ? "income" : "expenses",
        },
      ]);
      setItems((prev) => prev.filter((it) => it.vendorKey !== off.vendorKey));
    }
    setRuleOffer(null);
  };

  const undo = async () => {
    if (busy.current || history.length === 0) return;
    const last = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setRuleOffer(null);
    setPartial(null);
    if (last.impact) {
      setSessionImpact((s) => subtractSessionImpact(s, last.impact!));
    }
    if (last.mode !== mode) setMode(last.mode);

    if (last.bulkIds?.length && last.ruleVendorKey) {
      setDecisions((d) => {
        const n = { ...d };
        last.bulkIds!.forEach((id) => delete n[id]);
        return n;
      });
      setLogIds((l) => l.filter((id) => !last.bulkIds!.includes(id)));
    } else if (last.decision.marker) {
      await persistDecision(
        last.transactionId,
        last.decision.marker,
        Math.round(last.decision.pct * 100),
        undefined,
        true,
      );
      setDecisions((d) => {
        const n = { ...d };
        delete n[last.transactionId];
        return n;
      });
      setLogIds((l) => l.filter((id) => id !== last.transactionId));
    } else {
      setSkipped((s) => {
        const n = { ...s };
        delete n[last.transactionId];
        return n;
      });
    }
  };

  const switchMode = (m: Mode) => {
    setPartial(null);
    setRuleOffer(null);
    setSessionImpact(emptySessionImpact());
    setMode(m);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Sch. C / Reason inline editors — don't trigger sort shortcuts
      if (document.activeElement?.closest(".tcard__ai-tax--edit")) return;
      const k = e.key.toLowerCase();
      if (k === "z") {
        e.preventDefault();
        void undo();
        return;
      }
      if (ruleOffer) {
        if (k === "j") {
          e.preventDefault();
          setRuleOffer(null);
          return;
        }
        if (k === "r" || e.key === "Enter") {
          e.preventDefault();
          void createRule();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setRuleOffer(null);
          return;
        }
        setRuleOffer(null);
      }
      if (done) return;
      if (partial !== null) {
        if (e.key === "Enter") {
          e.preventDefault();
          if (requireExpenseTaxReady()) decide("Partial", partial);
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setPartial(null);
        }
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        decide("Personal");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (requireExpenseTaxReady()) decide("Business");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        openPartial();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (requireExpenseTaxReady()) acceptAI();
      } else if (k === "s") {
        e.preventDefault();
        skip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const sessionStats = useMemo(() => {
    const skips = items.filter((it) => skipped[it.id]).length;
    const queueLeft = items.filter((it) => !decisions[it.id] && !skipped[it.id]).length;
    const total = sessionImpact.sorted + queueLeft + skips;
    return {
      sorted: sessionImpact.sorted,
      total,
      skips,
      primary: sessionImpact.taxSaved,
      found: sessionImpact.deductions,
      excluded: sessionImpact.excluded,
    };
  }, [mode, sessionImpact, decisions, skipped, items]);

  const modeRules = rules.filter((r) =>
    mode === "income" ? r.mode === "income" : r.mode === "expenses",
  );

  return (
    <div className="tax-triage-page page-anim">
      <PageHead
        eyebrow={
          <>
            <span className="triage-eyebrow-icon">
              <IBolt size={12} />
            </span>
            Tax Triage · {remaining.length} left in {mode}
            {progress && progress.current_streak > 0 && (
              <>
                {" "}
                · <strong>{progress.current_streak}-day</strong> streak
              </>
            )}
          </>
        }
        title={<>Tax Triage</>}
        sub="Fly through everything we couldn't auto-sort. AI suggests; you confirm. Catch a repeat vendor and turn one call into a rule — past and future."
        right={
          <div className="seg" role="tablist">
            <button
              type="button"
              className={`seg__btn ${mode === "expenses" ? "is-active" : ""}`}
              onClick={() => switchMode("expenses")}
            >
              Expenses
            </button>
            <button
              type="button"
              className={`seg__btn ${mode === "income" ? "is-active" : ""}`}
              onClick={() => switchMode("income")}
            >
              Income
            </button>
          </div>
        }
      />

      <p className="tax__disclaimer" style={{ margin: "0 36px 0" }}>
        {TAX_GOOD_FAITH_DISCLAIMER}
      </p>

      <div className="triage">
        <section className="triage__main">
          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: "var(--ink-3)" }}>
              Loading queue…
            </div>
          ) : loadError ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <p style={{ color: "var(--ink-2)", marginBottom: 12 }}>{loadError}</p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void loadQueue()}
              >
                Retry
              </button>
            </div>
          ) : done ? (
            <TriageDone
              mode={mode}
              stats={sessionStats}
              ruleCount={modeRules.length}
              progress={progress}
              onReload={loadQueue}
            />
          ) : (
            <>
              <div className="triage__card-area">
                <div className={`tdeck${exiting ? " is-busy" : ""}`}>
                  {stack[0] ? (
                    <TriageCard
                      key={stack[0].id}
                      item={stack[0]}
                      mode={mode}
                      exiting={exiting}
                      partial={partial}
                      onDial={setPartial}
                      taxDraft={taxDrafts[stack[0].id]}
                      onTaxDraftChange={(draft) =>
                        setTaxDrafts((d) => ({ ...d, [stack[0].id]: draft }))
                      }
                      enriching={enrichingId === stack[0].id}
                      reasonSuggestions={stack[0].reasonSuggestions}
                    />
                  ) : null}
                </div>
              </div>

              <div className="triage__dock">
                {triageHint && (
                  <p className="triage__hint">{triageHint}</p>
                )}
                <TriageActions
                  mode={mode}
                  current={current}
                  partial={partial}
                  expenseTaxReady={expenseTaxReady}
                  onPersonal={() => decide("Personal")}
                  onBusiness={() => decide("Business")}
                  onPartialOpen={openPartial}
                  onPartialCommit={() => decide("Partial", partial ?? 50)}
                  onPartialCancel={() => setPartial(null)}
                  onAccept={acceptAI}
                  onSkip={skip}
                />
              </div>
            </>
          )}
        </section>

        <aside className="triage__rail">
          {ruleOffer ? (
            <RuleOffer
              key={`${ruleOffer.vendorKey}-${ruleOffer.marker}`}
              offer={ruleOffer}
              onCreate={() => void createRule()}
              onDismiss={() => setRuleOffer(null)}
            />
          ) : null}
          <TaxMeter mode={mode} stats={sessionStats} progress={progress} />
          {progress && progress.badges.length > 0 && (
            <div className="card triage-badges-card">
              <div className="uppercase-label">Badges</div>
              <div className="triage-badges">
                {progress.badges.map((b) => (
                  <span key={b} className="triage-badge">
                    {b.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}
          <RulesPanel rules={modeRules} />
          <SortedLog
            items={items}
            decisions={decisions}
            logIds={logIds}
            onUndo={() => void undo()}
            canUndo={history.length > 0}
          />
          <KeyLegend hasPartial={hasPartial} hasRuleOffer={!!ruleOffer} />
        </aside>
      </div>
    </div>
  );
}

function TriageTaxDetails({
  draft,
  onDraftChange,
  reasonSuggestions,
  enriching,
  isMeal,
  isTravel,
}: {
  draft: TaxDraft | undefined;
  onDraftChange: (draft: TaxDraft) => void;
  reasonSuggestions: string[];
  enriching: boolean;
  isMeal?: boolean;
  isTravel?: boolean;
}) {
  const [editing, setEditing] = useState<"schedule" | "reason" | null>(null);
  const [customReason, setCustomReason] = useState("");

  useEffect(() => {
    setEditing(null);
    setCustomReason("");
  }, [draft?.scheduleCLine, draft?.businessPurpose]);

  if (!draft) {
    return (
      <div className="tcard__ai-tax">
        <span className="tcard__ai-tax-loading">
          {enriching ? "Suggesting…" : "Loading…"}
        </span>
      </div>
    );
  }

  const chips = [
    ...new Set(
      [
        ...reasonSuggestions,
        draft.quickLabel,
        draft.businessPurpose,
      ].filter((s): s is string => Boolean(s?.trim())),
    ),
  ].slice(0, 4);

  const applyLine = (line: string) => {
    onDraftChange({
      ...draft,
      scheduleCLine: line || null,
      category: categoryLabelForLine(line),
    });
    setEditing(null);
  };

  const applyReason = (text: string) => {
    const t = text.trim();
    onDraftChange({
      ...draft,
      businessPurpose: t || null,
      quickLabel: t || draft.quickLabel,
    });
    setEditing(null);
    setCustomReason("");
  };

  const reasonText = draft.businessPurpose?.trim();
  const showMealCap =
    !isTravel && (isMeal || draft.scheduleCLine === "24b");

  if (editing === "schedule") {
    return (
      <div className="tcard__ai-tax tcard__ai-tax--edit">
        <select
          className="tcard__ai-tax-select"
          value={draft.scheduleCLine ?? ""}
          onChange={(e) => applyLine(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              setEditing(null);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setEditing(null);
            }
          }}
          autoFocus
        >
          <option value="">Schedule C line…</option>
          {SCHEDULE_C_LINES.map((l) => (
            <option key={l.line} value={l.line}>
              {l.line} — {l.label}
            </option>
          ))}
        </select>
        <button type="button" className="tcard__ai-tax-btn" onClick={() => setEditing(null)}>
          Done
        </button>
      </div>
    );
  }

  if (editing === "reason") {
    return (
      <div className="tcard__ai-tax tcard__ai-tax--edit tcard__ai-tax--reason">
        {chips.length > 0 && (
          <div className="tcard__ai-tax-chips">
            {chips.map((label) => (
              <button
                key={label}
                type="button"
                className={`tcard__ai-tax-chip${
                  draft.businessPurpose === label ? " is-active" : ""
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
                e.stopPropagation();
                applyReason(customReason);
              }
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setEditing(null);
              }
            }}
            autoFocus
          />
          <button
            type="button"
            className="tcard__ai-tax-btn"
            onClick={() => applyReason(customReason || reasonText || "")}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tcard__ai-tax">
      {showMealCap && (
        <div className="tcard__meal-cap">
          <span className="schedline__cap-badge">50%</span>
          <span className="tcard__meal-cap-text">Meal deduction cap</span>
          <HelpTooltip text={MEAL_50_PCT_TOOLTIP} label="Meal deduction limit" />
        </div>
      )}
      <div className="tcard__ai-tax-line">
        <span className="tcard__ai-tax-k">Sch.&nbsp;C</span>
        <span className="tcard__ai-tax-v">
          {formatScheduleCLineShort(draft.scheduleCLine)}
        </span>
        <button
          type="button"
          className="tcard__ai-tax-btn"
          onClick={() => setEditing("schedule")}
          aria-label="Change Schedule C line"
        >
          Edit
        </button>
      </div>
      <div className="tcard__ai-tax-line">
        <span className="tcard__ai-tax-k">Reason</span>
        <span className="tcard__ai-tax-v tcard__ai-tax-v--reason">
          {reasonText || (
            <em>{enriching ? "Generating…" : "—"}</em>
          )}
        </span>
        <button
          type="button"
          className="tcard__ai-tax-btn"
          onClick={() => {
            setCustomReason(reasonText ?? "");
            setEditing("reason");
          }}
          aria-label="Change deduction reason"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

const TriageCard = memo(function TriageCard({
  item,
  mode,
  exiting,
  partial,
  onDial,
  taxDraft,
  onTaxDraftChange,
  enriching,
  reasonSuggestions,
}: {
  item: TriageQueueItem;
  mode: Mode;
  exiting: { id: string; dir: string } | null;
  partial: number | null;
  onDial: (v: number) => void;
  taxDraft?: TaxDraft;
  onTaxDraftChange: (draft: TaxDraft) => void;
  enriching: boolean;
  reasonSuggestions: string[];
}) {
  const income = mode === "income";
  const cls = [
    "tcard",
    exiting?.id === item.id ? `is-exit-${exiting.dir}` : "",
    partial !== null ? "is-partial" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const amt =
    (item.amount < 0 ? "−" : "+") +
    "$" +
    Math.abs(item.amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const recurring = (item.seen ?? 0) >= RULE_SEEN_THRESHOLD;

  return (
    <article className={cls}>
      <div className="tcard__head">
        <span className="tcard__cat">{item.cat}</span>
        <div className="tcard__head-r">
          {recurring && (
            <span className="tcard__repeat">↻ {item.seen}× seen</span>
          )}
          <span className="tcard__src mono">{item.source}</span>
        </div>
      </div>
      <div className="tcard__vendor">{item.vendor}</div>
      <div className="tcard__date">{formatTriageDate(item.date)}</div>
      <div className={`tcard__amount ${income ? "is-in" : ""}`}>{amt}</div>
      <div
        className="tcard__ai"
        data-suggest={suggestDataAttr(item.suggest)}
      >
        <div className="tcard__ai-head">
          <span className="tcard__ai-tag">
            <IBolt size={11} /> AI suggests
          </span>
          <MarkerPill
            marker={item.suggest}
            businessPct={Math.round(item.pct * 100)}
          />
          <span className="tcard__ai-conf">
            {Math.round(item.conf * 100)}% sure
          </span>
        </div>
        <div className="tcard__ai-bar">
          <span style={{ width: `${Math.round(item.conf * 100)}%` }} />
        </div>
        {item.why ? <div className="tcard__ai-why">{item.why}</div> : null}
        {!income && onTaxDraftChange ? (
          <TriageTaxDetails
            draft={taxDraft}
            onDraftChange={onTaxDraftChange}
            reasonSuggestions={reasonSuggestions}
            enriching={enriching}
            isMeal={item.isMeal}
            isTravel={item.isTravel}
          />
        ) : null}
      </div>
      {partial !== null && (
        <div className="tcard__partial">
          <div className="uppercase-label" style={{ marginBottom: 8 }}>
            Set the business split
          </div>
          <PartialDial compact value={partial} onChange={onDial} />
        </div>
      )}
    </article>
  );
});

function TriageActions({
  mode,
  current,
  partial,
  expenseTaxReady = true,
  onPersonal,
  onBusiness,
  onPartialOpen,
  onPartialCommit,
  onPartialCancel,
  onAccept,
  onSkip,
}: {
  mode: Mode;
  current?: TriageQueueItem;
  partial: number | null;
  expenseTaxReady?: boolean;
  onPersonal: () => void;
  onBusiness: () => void;
  onPartialOpen: () => void;
  onPartialCommit: () => void;
  onPartialCancel: () => void;
  onAccept: () => void;
  onSkip: () => void;
}) {
  const hasPartial = mode === "expenses";
  const needsTax = mode === "expenses" && !expenseTaxReady;
  const sugLabel = current
    ? markerLabel(current.suggest, Math.round(current.pct * 100))
    : "";

  if (partial !== null) {
    return (
      <div className="triage__actions triage__actions--partial">
        <button type="button" className="tbtn tbtn--ghost" onClick={onPartialCancel}>
          Cancel <kbd>Esc</kbd>
        </button>
        <button
          type="button"
          className="tbtn tbtn--business tbtn--wide"
          onClick={onPartialCommit}
          disabled={needsTax}
        >
          Apply split <kbd>⏎</kbd>
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className={`triage__actions ${hasPartial ? "" : "triage__actions--two"}`}
      >
        <button
          type="button"
          className={`tbtn tbtn--personal${current?.suggest === "Personal" ? " is-suggested" : ""}`}
          onClick={onPersonal}
        >
          <kbd>←</kbd>
          <span className="tbtn__lbl">
            <span className="tbtn__dot" />
            Personal
          </span>
        </button>
        {hasPartial && (
          <button
            type="button"
            className={`tbtn tbtn--partial${current?.suggest === "Partial" ? " is-suggested" : ""}`}
            onClick={onPartialOpen}
            disabled={needsTax}
          >
            <kbd>↓</kbd>
            <span className="tbtn__lbl">Partial</span>
          </button>
        )}
        <button
          type="button"
          className={`tbtn tbtn--business${current?.suggest === "Business" ? " is-suggested" : ""}`}
          onClick={onBusiness}
          disabled={needsTax}
        >
          <span className="tbtn__lbl">
            Business
            <span className="tbtn__dot" />
          </span>
          <kbd>→</kbd>
        </button>
      </div>
      <div className="triage__accept">
        <button
          type="button"
          className="triage__accept-btn"
          onClick={onAccept}
          disabled={needsTax}
        >
          <IBolt size={12} /> Accept AI — <strong>{sugLabel}</strong> <kbd>⏎</kbd>
        </button>
        <button type="button" className="triage__skip" onClick={onSkip}>
          Skip <kbd>S</kbd>
        </button>
      </div>
    </>
  );
}

function RuleOffer({
  offer,
  onCreate,
  onDismiss,
}: {
  offer: {
    vendor: string;
    marker: Marker;
    pct: number;
    queueCount: number;
    seen: number;
  };
  onCreate: () => void;
  onDismiss: () => void;
}) {
  const tone =
    offer.marker === "Business"
      ? "forest"
      : offer.marker === "Personal"
        ? "clay"
        : "ink";
  const [remainingMs, setRemainingMs] = useState(RULE_OFFER_TIMEOUT_MS);
  const dismissedRef = useRef(false);

  const dismissOnce = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    dismissedRef.current = false;
    const started = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const left = Math.max(0, RULE_OFFER_TIMEOUT_MS - (now - started));
      setRemainingMs(left);
      if (left <= 0) {
        dismissOnce();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [offer.vendor, offer.marker, dismissOnce]);

  const timerPct = (remainingMs / RULE_OFFER_TIMEOUT_MS) * 100;
  const secs = Math.max(1, Math.ceil(remainingMs / 1000));

  return (
    <div className="ruleoffer-wrap" data-tone={tone}>
      <div className="ruleoffer" data-tone={tone}>
        <div className="ruleoffer__icon">
          <IRules size={18} />
        </div>
        <div className="ruleoffer__body">
          <div className="ruleoffer__title">
            Make it a rule?{" "}
            <span className="ruleoffer__vendor">{offer.vendor}</span> →{" "}
            <MarkerPill
              marker={offer.marker}
              businessPct={Math.round(offer.pct * 100)}
            />
          </div>
          <div className="ruleoffer__sub">
            {offer.queueCount > 0 && (
              <>
                <strong>{offer.queueCount} more</strong> in this batch ·{" "}
              </>
            )}
            <strong>{offer.seen}</strong> already booked · and every future{" "}
            {offer.vendor} on import.
          </div>
        </div>
        <div className="ruleoffer__actions">
          <button type="button" className="ruleoffer__skip" onClick={dismissOnce}>
            Just this one <kbd>J</kbd>
          </button>
          <button type="button" className="ruleoffer__create" onClick={onCreate}>
            <IRules size={13} /> Create rule <kbd>R</kbd>
          </button>
        </div>
      </div>
      <div
        className="ruleoffer__timer"
        role="timer"
        aria-live="polite"
        aria-label={`Auto-dismiss in ${secs} seconds`}
      >
        <span
          className="ruleoffer__timer-fill"
          style={{ width: `${timerPct}%` }}
        />
      </div>
      <div className="ruleoffer__timer-label">
        Just this one in {secs}s if you keep sorting · <kbd>J</kbd> now
      </div>
    </div>
  );
}

function TaxMeter({
  mode,
  stats,
  progress,
}: {
  mode: Mode;
  stats: {
    sorted: number;
    total: number;
    primary: number;
    found: number;
    excluded?: number;
  };
  progress: TriageProgressRow | null;
}) {
  const pct = stats.total ? stats.sorted / stats.total : 0;
  const income = mode === "income";

  return (
    <div className="meter">
      <div className="meter__therm">
        <div
          className={`meter__therm-fill ${income ? "is-in" : ""}`}
          style={{ height: `${Math.max(pct * 100, 4)}%` }}
        />
        <div className={`meter__therm-bulb ${income ? "is-in" : ""}`} />
      </div>
      <div className="meter__body">
        <div className="uppercase-label meter__label">
          {income ? "Tax to set aside" : "Tax saved so far"}
        </div>
        <div className={`meter__big ${income ? "is-in" : ""}`}>
          {usd(stats.primary)}
        </div>
        <div className="meter__sub">
          {income ? (
            <>
              {usd(stats.found)} taxable income found
              {stats.excluded ? (
                <>
                  {" "}
                  · <span className="meter__excl">{usd(stats.excluded)} excluded</span>
                </>
              ) : null}
            </>
          ) : (
            <>from {usd(stats.found)} in deductions</>
          )}
        </div>
        {progress ? (
          <div className={`meter__lifetime${income ? " is-in" : ""}`}>
            Lifetime {income ? "set aside" : "tax saved"}:{" "}
            <strong>{usd(progress.lifetime_tax_saved)}</strong>
          </div>
        ) : null}
        <div className="meter__count">
          <span>
            {stats.sorted} of {stats.total} sorted
          </span>
          <span>{Math.round(pct * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

function RulesPanel({ rules }: { rules: RuleRow[] }) {
  return (
    <div className="card trules">
      <div className="trules__head">
        <div className="uppercase-label">Auto-rules</div>
        <span className="trules__count">{rules.length}</span>
      </div>
      {rules.length === 0 ? (
        <div className="trules__empty">
          Sort a repeat vendor to spin up a rule. It back-fills the batch and
          auto-tags future imports.
        </div>
      ) : (
        <div className="trules__list">
          {rules.map((r) => (
            <div key={r.id} className="trules__row">
              <div className="trules__row-l">
                <span className="trules__row-v">{r.vendor}</span>
                <span className="trules__row-future">
                  <IRules size={11} /> auto-tags future
                </span>
              </div>
              <MarkerPill marker={r.marker} businessPct={r.businessPct} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SortedLog({
  items,
  decisions,
  logIds,
  onUndo,
  canUndo,
}: {
  items: TriageQueueItem[];
  decisions: Record<string, Decision>;
  logIds: string[];
  onUndo: () => void;
  canUndo: boolean;
}) {
  const itemsById = useMemo(
    () => new Map(items.map((it) => [it.id, it])),
    [items],
  );
  const recent = useMemo(
    () =>
      logIds
        .slice()
        .reverse()
        .map((id) => ({
          item: itemsById.get(id),
          dec: decisions[id],
        }))
        .filter((r) => r.item && r.dec)
        .slice(0, 5),
    [logIds, itemsById, decisions],
  );

  return (
    <div className="card tlog">
      <div className="tlog__head">
        <div className="uppercase-label">Recently sorted</div>
        <button
          type="button"
          className="tlog__undo"
          onClick={onUndo}
          disabled={!canUndo}
        >
          ↩ Undo <kbd>Z</kbd>
        </button>
      </div>
      {recent.length === 0 ? (
        <div className="tlog__empty">
          Your calls show up here. Mis-tap? Undo anytime.
        </div>
      ) : (
        <div className="tlog__list">
          {recent.map(({ item, dec }) =>
            item && dec ? (
              <div key={item.id} className="tlog__row">
                <span className="tlog__row-v">
                  {item.vendor}
                  {dec.viaRule && (
                    <span className="tlog__via">
                      <IRules size={9} /> rule
                    </span>
                  )}
                </span>
                <MarkerPill
                  marker={dec.marker}
                  businessPct={Math.round(dec.pct * 100)}
                />
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

function KeyLegend({
  hasPartial,
  hasRuleOffer,
}: {
  hasPartial: boolean;
  hasRuleOffer: boolean;
}) {
  return (
    <div className="klegend">
      <div className="klegend__row">
        <kbd>←</kbd> Personal
      </div>
      {hasPartial && (
        <div className="klegend__row">
          <kbd>↓</kbd> Partial split
        </div>
      )}
      <div className="klegend__row">
        <kbd>→</kbd> Business
      </div>
      <div className="klegend__row">
        <kbd>⏎</kbd> Accept AI
      </div>
      <div className="klegend__row">
        <kbd>S</kbd> Skip
      </div>
      <div className="klegend__row">
        <kbd>Z</kbd> Undo
      </div>
      {hasRuleOffer && (
        <div className="klegend__row">
          <kbd>J</kbd> Just this one
        </div>
      )}
    </div>
  );
}

function TriageDone({
  mode,
  stats,
  ruleCount,
  progress,
  onReload,
}: {
  mode: Mode;
  stats: {
    sorted: number;
    total: number;
    skips: number;
    primary: number;
    found: number;
    excluded?: number;
  };
  ruleCount: number;
  progress: TriageProgressRow | null;
  onReload: () => void;
}) {
  const shown = stats.primary;
  const income = mode === "income";

  return (
    <div className="tdone">
      <div className="tdone__check">
        <ICheck size={30} />
      </div>
      <div className="tdone__title">
        {income ? "Income sorted." : "Inbox zero."}
      </div>
      <div className="tdone__sub">
        {stats.sorted} of {stats.total} {mode} cleared
        {stats.skips ? ` · ${stats.skips} skipped` : ""}
        {ruleCount ? ` · ${ruleCount} rule${ruleCount > 1 ? "s" : ""} created` : ""}
        .
      </div>
      <div className="tdone__payoff">
        <div
          className="uppercase-label"
          style={{
            color: income ? "var(--wheat-deep)" : "var(--forest-deep)",
          }}
        >
          {income ? "Set aside for taxes" : "Taxes you just saved"}
        </div>
        <div className={`tdone__big ${income ? "is-in" : ""}`}>{usd(shown)}</div>
        <div className="tdone__payoff-sub">
          {income ? (
            <>
              {usd(stats.found)} taxable · {usd(stats.excluded ?? 0)} kept tax-free
            </>
          ) : (
            <>from {usd(stats.found)} in business deductions</>
          )}
        </div>
        {progress ? (
          <div className={`tdone__lifetime${income ? " is-in" : ""}`}>
            Lifetime tax {income ? "set aside" : "saved"}:{" "}
            <strong>{usd(progress.lifetime_tax_saved)}</strong>
            {progress.current_streak > 1 && (
              <> · {progress.current_streak}-day streak</>
            )}
          </div>
        ) : null}
      </div>
      <div className="tdone__actions">
        {income ? (
          <>
            <Link className="btn btn--primary" href="/tax">
              <ITax size={14} /> View Schedule C
            </Link>
            <Link className="btn btn--ghost" href="/review">
              <IReview size={14} /> Review
            </Link>
          </>
        ) : (
          <>
            <Link className="btn btn--primary" href="/tax">
              <ITax size={14} /> View Schedule C
            </Link>
            <Link className="btn btn--ghost" href="/review">
              <IReview size={14} /> Review
            </Link>
          </>
        )}
      </div>
      <button type="button" className="tdone__reset" onClick={onReload}>
        ↩ Reload queue
      </button>
    </div>
  );
}
