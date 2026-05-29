"use client";

import { useCallback, useEffect, useState } from "react";
import { ICheck, IClose, IChevronR } from "@/components/ui/icons";

// ─── Types ─────────────────────────────────────────────────────────────────

interface ReviewItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  urgency: 1 | 2 | 3;
  payload: Record<string, unknown> | null;
  done: boolean;
  done_at: string | null;
  dismissed: boolean;
  created_at: string;
}

interface KindMeta {
  label: string;
  action: string;
  href?: (item: ReviewItem) => string;
}

const KIND_META: Record<string, KindMeta> = {
  rule_suggestion: { label: "Rule suggestion", action: "Review rule", href: () => "/settings/rules" },
  unusual_tx:      { label: "Unusual charge", action: "View transaction" },
  tax_nudge:       { label: "Tax action", action: "Go to Tax", href: () => "/tax" },
  untagged:        { label: "Needs tagging", action: "Open budget", href: () => "/budget" },
};

const URGENCY_GROUPS = [
  { urgency: 3 as const, label: "Important", pinClass: "review-group__pin--ember" },
  { urgency: 2 as const, label: "This week",  pinClass: "review-group__pin--wheat" },
  { urgency: 1 as const, label: "Whenever",   pinClass: "review-group__pin--ink" },
];

// ─── Main component ─────────────────────────────────────────────────────────

export function ReviewPageClient() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/review");
      const { items: data } = await res.json();
      setItems(data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markDone(id: string, done: boolean) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, done } : i));
    await fetch("/api/review", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, done }),
    });
  }

  async function dismiss(id: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, dismissed: true } : i));
    await fetch("/api/review", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, dismissed: true }),
    });
  }

  const visible = items.filter(i => !i.dismissed && (showDone || !i.done));
  const openCount = items.filter(i => !i.dismissed && !i.done).length;
  const doneCount = items.filter(i => !i.dismissed && i.done).length;
  const totalCount = items.filter(i => !i.dismissed).length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="page-anim">
      {/* Page header */}
      <header className="pagehead">
        <div>
          <div className="pagehead__eyebrow">Review · your to-do list</div>
          <h1 className="pagehead__title">
            {loading ? "—" : openCount} <em>open item{openCount !== 1 ? "s" : ""}</em>
          </h1>
          <div className="pagehead__sub">
            Everything we need from you to keep the books clean and tax season painless.
          </div>
        </div>
        <div className="pagehead__right">
          <button
            className={`btn${showDone ? " btn--ghost" : " btn--ghost"}`}
            onClick={() => setShowDone(v => !v)}
          >
            {showDone ? "Hide completed" : "Show completed"}
          </button>
        </div>
      </header>

      <div className="review">
        {/* ── Left: task list ── */}
        <div className="review__list">
          {loading ? (
            <div style={{ padding: "48px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 14 }}>
              Loading…
            </div>
          ) : visible.length === 0 ? (
            <div style={{ padding: "48px 0", textAlign: "center" }}>
              <div style={{ fontSize: 26, marginBottom: 10 }}>✓</div>
              <div style={{ fontWeight: 600, fontSize: 17, marginBottom: 6 }}>All caught up</div>
              <div style={{ fontSize: 13.5, color: "var(--ink-3)", maxWidth: 380, margin: "0 auto" }}>
                Connect your accounts and tag transactions to generate tasks here.
                We&apos;ll flag unusual charges, rule suggestions, and tax actions automatically.
              </div>
            </div>
          ) : (
            URGENCY_GROUPS.map(({ urgency, label, pinClass }) => {
              const group = visible.filter(i => i.urgency === urgency);
              if (group.length === 0) return null;
              return (
                <div key={urgency} className="review-group">
                  <div className="review-group__title">
                    <div className={`review-group__pin ${pinClass}`} />
                    {label}
                    <span style={{ fontWeight: 400, color: "var(--ink-4)", textTransform: "none", letterSpacing: 0 }}>
                      · {group.length}
                    </span>
                  </div>
                  <div className="review-group__items">
                    {group.map(item => (
                      <ReviewTask
                        key={item.id}
                        item={item}
                        onToggleDone={() => markDone(item.id, !item.done)}
                        onDismiss={() => dismiss(item.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}

          {/* Completed section (when shown) */}
          {showDone && doneCount > 0 && (
            <div className="review-group">
              <div className="review-group__title">
                <div className="review-group__pin review-group__pin--done" />
                Completed · {doneCount}
              </div>
              <div className="review-group__items">
                {items
                  .filter(i => !i.dismissed && i.done)
                  .map(item => (
                    <ReviewTask
                      key={item.id}
                      item={item}
                      onToggleDone={() => markDone(item.id, false)}
                      onDismiss={() => dismiss(item.id)}
                    />
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right rail ── */}
        <aside className="review__rail">
          <div className="card review-summary">
            <div className="review-summary__head">
              <div className="uppercase-label">Account health</div>
              <div className="money money--big" style={{ marginTop: 4 }}>
                {doneCount}/{totalCount}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>
                Tasks complete
              </div>
            </div>

            <div className="review-summary__progress">
              <div
                className="review-summary__progress-fill"
                style={{ width: `${pct}%`, transition: "width .4s ease" }}
              />
            </div>

            <div className="review-summary__metrics">
              <div className="review-summary__metric">
                <span>Completion</span>
                <strong>{pct}%</strong>
              </div>
              <div className="review-summary__metric">
                <span>Open tasks</span>
                <strong>{openCount}</strong>
              </div>
              <div className="review-summary__metric">
                <span>Dismissed</span>
                <strong>{items.filter(i => i.dismissed).length}</strong>
              </div>
            </div>

            <hr style={{ border: 0, borderTop: "1px solid var(--border-soft)", margin: "16px 0" }} />

            <div className="uppercase-label">Why this matters</div>
            <p style={{ fontSize: 13.5, color: "var(--ink-2)", marginTop: 6, lineHeight: 1.55 }}>
              Closed-out tasks mean accurate cash-flow numbers and a Schedule C that
              builds itself. Spend 10 minutes here once a week and you&apos;ll never
              scramble in April.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── ReviewTask card ────────────────────────────────────────────────────────

interface ReviewTaskProps {
  item: ReviewItem;
  onToggleDone: () => void;
  onDismiss: () => void;
}

function ReviewTask({ item, onToggleDone, onDismiss }: ReviewTaskProps) {
  const meta = KIND_META[item.kind] ?? { label: item.kind, action: "Open" };
  const href = meta.href?.(item);

  return (
    <div className={`review-task${item.done ? " is-done" : ""}`}>
      {/* Check button */}
      <button
        className="review-task__check"
        onClick={onToggleDone}
        title={item.done ? "Mark open" : "Mark done"}
      >
        {item.done && <ICheck size={13} />}
      </button>

      {/* Body */}
      <div className="review-task__body">
        <div className="review-task__title">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 18,
              padding: "0 7px",
              borderRadius: 999,
              background: "var(--bone-3)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--ink-3)",
              marginRight: 4,
            }}
          >
            {meta.label}
          </span>
          {item.title}
        </div>
        {item.body && (
          <div className="review-task__sub">{item.body}</div>
        )}
      </div>

      {/* Action */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {href ? (
          <a href={href} className="review-task__open">
            {meta.action} <IChevronR size={11} />
          </a>
        ) : (
          <button className="review-task__open">
            {meta.action} <IChevronR size={11} />
          </button>
        )}
        <button
          style={{ display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: 999, color: "var(--ink-4)" }}
          onClick={onDismiss}
          title="Dismiss"
        >
          <IClose size={12} />
        </button>
      </div>
    </div>
  );
}
