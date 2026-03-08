"use client";

import { useState, useCallback, useEffect } from "react";
import type { NormalizedRule, RuleConditions, RuleAction } from "@/lib/rules/types";
import { SCHEDULE_C_LINES } from "@/lib/tax/schedule-c-lines";

type NotificationPrefs = {
  user_id: string;
  type: "count_based" | "interval_based";
  value: string;
  last_notified_at: string | null;
  last_counter_reset_at: string | null;
  created_at: string;
  updated_at: string;
} | null;

const SOURCE_LABELS: Record<string, string> = {
  data_feed: "Stripe",
  csv_upload: "CSV",
  manual: "Manual",
};

function formatConditionSummary(c: RuleConditions): string {
  const part = c.match.pattern
    ? `vendor/description contains "${c.match.pattern}"`
    : "any transaction";
  if (c.source) {
    return `${part} and source is ${SOURCE_LABELS[c.source] ?? c.source}`;
  }
  return part;
}

function formatActionSummary(a: RuleAction): string {
  if (a.type === "exclude") return "Then exclude (delete)";
  return a.category ? `Then auto-categorize as ${a.category}` : "Then auto-categorize";
}

function notificationSummary(prefs: NotificationPrefs): string {
  if (!prefs) return "Notifications: Monthly";
  if (prefs.type === "interval_based") {
    const v = prefs.value;
    const label = v === "daily" ? "Daily" : v === "weekly" ? "Weekly" : v === "monthly" ? "Monthly" : v === "quarterly" ? "Quarterly" : v;
    return `Notifications: ${label}`;
  }
  return `Notifications: Every ${prefs.value} transactions`;
}

interface RulesPageClientProps {
  initialRules: NormalizedRule[];
  initialNotificationPreferences: NotificationPrefs;
}

export function RulesPageClient({
  initialRules,
  initialNotificationPreferences,
}: RulesPageClientProps) {
  const [rules, setRules] = useState<NormalizedRule[]>(initialRules);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPrefs>(initialNotificationPreferences);
  // Only show rules that have a match pattern (hide empty/placeholder rows)
  const visibleRules = rules.filter(
    (r) => typeof r.conditions?.match?.pattern === "string" && r.conditions.match.pattern.trim() !== "",
  );
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [applyScopeOpen, setApplyScopeOpen] = useState(false);
  const [applyScopeRuleId, setApplyScopeRuleId] = useState<string | null>(null);
  const [applyScopeMatchCount, setApplyScopeMatchCount] = useState<number | null>(null);
  const [applyScopeConfirming, setApplyScopeConfirming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch("/api/rules");
    if (!res.ok) return;
    const data = await res.json();
    setRules(data.rules ?? []);
    setNotificationPreferences(data.notificationPreferences ?? null);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-mono-dark">Rules</h1>
        <p className="text-sm text-mono-medium mt-1">
          Set policies to help automate decisions and save even more time.
        </p>
      </div>

      {/* Notification Controls */}
      <section className="rounded-xl border border-bg-tertiary/40 bg-white p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-mono-dark">Notification Controls</h2>
            <p className="text-sm text-mono-medium mt-0.5">{notificationSummary(notificationPreferences)}</p>
          </div>
          <button
            type="button"
            onClick={() => setNotificationModalOpen(true)}
            className="rounded-lg border border-bg-tertiary px-4 py-2 text-sm font-medium text-mono-dark hover:bg-bg-secondary transition"
          >
            Manage
          </button>
        </div>
      </section>

      {/* Rules list */}
      <section>
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-sm font-semibold text-mono-dark">Rules</h2>
          <button
            type="button"
            onClick={() => {
              setEditingRuleId(null);
              setEditorOpen(true);
            }}
            className="rounded-lg bg-accent-sage px-4 py-2 text-sm font-medium text-white hover:bg-accent-sage/90 transition"
          >
            New rule
          </button>
        </div>
        <div className="space-y-3">
          {visibleRules.length === 0 ? (
            <div className="rounded-xl border border-bg-tertiary/40 bg-white p-6 text-center">
              <p className="text-sm font-medium text-mono-dark">No rules yet</p>
              <p className="text-sm text-mono-light mt-2 max-w-md mx-auto">
                Rules automatically categorize or exclude transactions based on vendor or description. For example: when vendor contains &ldquo;AWS&rdquo; → categorize as Software, or when description contains &ldquo;Netflix&rdquo; → exclude from business.
              </p>
              <p className="text-sm text-mono-medium mt-3">Create your first rule to get started.</p>
              <button
                type="button"
                onClick={() => { setEditingRuleId(null); setEditorOpen(true); }}
                className="mt-4 rounded-lg bg-accent-sage px-4 py-2 text-sm font-medium text-white hover:bg-accent-sage/90 transition"
              >
                New rule
              </button>
            </div>
          ) : (
            visibleRules.map((rule) => (
              <div
                key={rule.id}
                className="rounded-xl border border-bg-tertiary/40 bg-white p-4 flex flex-wrap items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-mono-dark">{rule.name || "Unnamed rule"}</span>
                    {!rule.enabled && (
                      <span className="text-xs text-mono-light bg-bg-tertiary/50 px-2 py-0.5 rounded">Disabled</span>
                    )}
                  </div>
                  <p className="text-xs text-mono-medium mt-1">
                    If {formatConditionSummary(rule.conditions)} → {formatActionSummary(rule.action)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await fetch("/api/rules", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: rule.id, enabled: !rule.enabled }),
                      });
                      if (res.ok) await reload();
                    }}
                    className="text-xs text-mono-medium hover:text-mono-dark"
                  >
                    {rule.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRuleId(rule.id);
                      setEditorOpen(true);
                    }}
                    className="text-xs text-accent-sage hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm("Delete this rule?")) return;
                      const res = await fetch(`/api/rules?id=${rule.id}`, { method: "DELETE" });
                      if (res.ok) {
                        await reload();
                        setToast("Rule deleted");
                      }
                    }}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {notificationModalOpen && (
        <NotificationControlsModal
          initialPrefs={notificationPreferences}
          onClose={() => setNotificationModalOpen(false)}
          onSave={async (type, value) => {
            const res = await fetch("/api/notification-preferences", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type, value }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data && !data.error) {
              setNotificationPreferences(data);
              setNotificationModalOpen(false);
              setToast("Notification preference saved");
            } else {
              setToast(data?.error ?? "Failed to save notification preference");
            }
          }}
        />
      )}

      {editorOpen && (
        <RuleEditorModal
          rule={editingRuleId ? rules.find((r) => r.id === editingRuleId) ?? null : null}
          onClose={() => {
            setEditorOpen(false);
            setEditingRuleId(null);
          }}
          onSave={async (payload) => {
            if (editingRuleId) {
              const res = await fetch("/api/rules", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: editingRuleId, ...payload }),
              });
              if (res.ok) {
                await reload();
                setEditorOpen(false);
                setEditingRuleId(null);
                setApplyScopeRuleId(editingRuleId);
                setApplyScopeOpen(true);
              }
            } else {
              const res = await fetch("/api/rules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              if (res.ok) {
                const data = await res.json();
                await reload();
                setEditorOpen(false);
                if (data.rule?.id) {
                  setApplyScopeRuleId(data.rule.id);
                  setApplyScopeOpen(true);
                }
              }
            }
          }}
        />
      )}

      {applyScopeOpen && applyScopeRuleId && (
        <ApplyScopeModal
          ruleId={applyScopeRuleId}
          matchCount={applyScopeMatchCount}
          onClose={() => {
            setApplyScopeOpen(false);
            setApplyScopeRuleId(null);
            setApplyScopeMatchCount(null);
            setApplyScopeConfirming(false);
          }}
          onGoingForward={() => {
            setApplyScopeOpen(false);
            setApplyScopeRuleId(null);
            setToast("Rule will apply to new transactions only");
          }}
          onRetroactivePreview={async () => {
            const res = await fetch("/api/rules/apply", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ruleId: applyScopeRuleId, preview: true }),
            });
            if (res.ok) {
              const data = await res.json();
              setApplyScopeMatchCount(data.matchCount ?? 0);
            }
          }}
          onRetroactiveConfirm={async () => {
            setApplyScopeConfirming(true);
            const res = await fetch("/api/rules/apply", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ruleId: applyScopeRuleId, preview: false }),
            });
            setApplyScopeConfirming(false);
            if (res.ok) {
              const data = await res.json();
              setToast(`Applied to ${(data.updatedCount ?? 0) + (data.deletedCount ?? 0)} transactions`);
              setApplyScopeOpen(false);
              setApplyScopeRuleId(null);
              setApplyScopeMatchCount(null);
            }
          }}
          confirming={applyScopeConfirming}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-mono-dark px-4 py-2.5 text-sm text-white shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

const COUNT_PRESETS = ["10", "100", "500", "1000"];

function NotificationControlsModal({
  initialPrefs,
  onClose,
  onSave,
}: {
  initialPrefs: NotificationPrefs;
  onClose: () => void;
  onSave: (type: "count_based" | "interval_based", value: string) => Promise<void>;
}) {
  const isCountBased = initialPrefs?.type === "count_based";
  const isIntervalBased = initialPrefs?.type === "interval_based";
  const savedCountValue = initialPrefs?.type === "count_based" ? initialPrefs.value : "100";
  const savedCountIsPreset = COUNT_PRESETS.includes(savedCountValue);

  const [tab, setTab] = useState<"time" | "count">(
    isIntervalBased ? "time" : isCountBased ? "count" : "time",
  );
  const [interval, setInterval] = useState<string>(isIntervalBased ? initialPrefs!.value : "monthly");
  const [countValue, setCountValue] = useState<string>(savedCountIsPreset ? savedCountValue : "100");
  const [customCount, setCustomCount] = useState(savedCountIsPreset ? "" : savedCountValue);
  const [saving, setSaving] = useState(false);
  const [countError, setCountError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSave = async () => {
    setCountError(null);
    if (tab === "time") {
      setSaving(true);
      try {
        await onSave("interval_based", interval);
      } finally {
        setSaving(false);
      }
      return;
    }
    const val = customCount.trim() ? customCount.trim() : countValue;
    if (!/^\d+$/.test(val) || parseInt(val, 10) < 1) {
      setCountError("Enter a whole number (1 or more).");
      return;
    }
    setSaving(true);
    try {
      await onSave("count_based", val);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 min-h-[100dvh] z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]" role="dialog" aria-modal="true">
      <div className="rounded-xl bg-white shadow-xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-[#2d3748] px-6 pt-6 pb-4 flex justify-between items-start">
          <h2 className="text-xl font-bold text-white">Notification Controls</h2>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white" aria-label="Close">
            <span className="material-symbols-rounded text-[24px]">close</span>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTab("time")}
              className={`py-2.5 rounded-lg text-sm font-medium transition ${tab === "time" ? "bg-accent-sage text-white" : "border border-bg-tertiary text-mono-medium hover:bg-bg-secondary"}`}
            >
              Time-Based
            </button>
            <button
              type="button"
              onClick={() => setTab("count")}
              className={`py-2.5 rounded-lg text-sm font-medium transition ${tab === "count" ? "bg-accent-sage text-white" : "border border-bg-tertiary text-mono-medium hover:bg-bg-secondary"}`}
            >
              Number of Transactions
            </button>
          </div>
          {tab === "time" ? (
            <>
              <p className="text-xs text-mono-medium">
                We&apos;ll remind you to sort your transactions on your chosen schedule, regardless of how many have come in.
              </p>
              <div className="flex flex-wrap gap-2">
                {(["daily", "weekly", "monthly", "quarterly"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setInterval(v)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium capitalize ${interval === v ? "bg-accent-sage text-white" : "border border-bg-tertiary hover:bg-bg-secondary"}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-mono-medium">
                We&apos;ll remind you once you&apos;ve accumulated the selected number of unsorted transactions.
              </p>
              <div className="flex flex-wrap gap-2">
                {COUNT_PRESETS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => { setCountValue(v); setCustomCount(""); setCountError(null); }}
                    className={`rounded-lg px-3 py-2 text-sm font-medium ${countValue === v && !customCount ? "bg-accent-sage text-white" : "border border-bg-tertiary hover:bg-bg-secondary"}`}
                  >
                    Every {v}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs text-mono-medium mb-1">Custom number</label>
                <input
                  type="number"
                  min={1}
                  value={customCount}
                  onChange={(e) => { setCustomCount(e.target.value); setCountError(null); }}
                  placeholder="e.g. 250"
                  className={`w-full border rounded-md px-3 py-2 text-sm ${countError ? "border-amber-500" : "border-bg-tertiary"}`}
                />
                {countError && <p className="text-xs text-amber-600 mt-1">{countError}</p>}
              </div>
            </>
          )}
        </div>
        <div className="px-6 py-4 border-t border-bg-tertiary/40 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-accent-sage px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-sage/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RuleEditorModal({
  rule,
  onClose,
  onSave,
}: {
  rule: NormalizedRule | null;
  onClose: () => void;
  onSave: (payload: { name?: string | null; conditions: RuleConditions; action: RuleAction }) => Promise<void>;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [pattern, setPattern] = useState(rule?.conditions.match.pattern ?? "");
  const [sourceFilter, setSourceFilter] = useState<string>(rule?.conditions.source ?? "");
  const [actionType, setActionType] = useState<"auto_categorize" | "exclude">(rule?.action.type === "exclude" ? "exclude" : "auto_categorize");
  const [category, setCategory] = useState(rule?.action.type === "auto_categorize" ? (rule.action.category ?? "") : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSave = async () => {
    if (!pattern.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim() || null,
        conditions: {
          match: { field: "vendor_or_description", pattern: pattern.trim() },
          source: sourceFilter === "" ? null : (sourceFilter as "data_feed" | "csv_upload" | "manual"),
        },
        action:
          actionType === "exclude"
            ? { type: "exclude" }
            : { type: "auto_categorize", category: category || null },
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 min-h-[100dvh] z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]" role="dialog" aria-modal="true">
      <div className="rounded-xl bg-white shadow-xl max-w-md w-full mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="bg-[#2d3748] px-6 pt-6 pb-4 flex justify-between items-start">
          <h2 className="text-xl font-bold text-white">{rule ? "Edit rule" : "New rule"}</h2>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white" aria-label="Close">
            <span className="material-symbols-rounded text-[24px]">close</span>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-mono-medium mb-1">Name (optional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Uber to Travel"
              className="w-full border border-bg-tertiary rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-mono-medium mb-1">Merchant / description contains</label>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g. UBER"
              className="w-full border border-bg-tertiary rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-mono-medium mb-1">Data source (optional)</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full border border-bg-tertiary rounded-md px-3 py-2 text-sm"
            >
              <option value="">Any</option>
              <option value="data_feed">Stripe</option>
              <option value="csv_upload">CSV</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-mono-medium mb-2">Action</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={actionType === "auto_categorize"} onChange={() => setActionType("auto_categorize")} />
                <span className="text-sm">Auto-categorize</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={actionType === "exclude"} onChange={() => setActionType("exclude")} />
                <span className="text-sm">Exclude (delete)</span>
              </label>
            </div>
            {actionType === "auto_categorize" && (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-2 w-full border border-bg-tertiary rounded-md px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {SCHEDULE_C_LINES.map((l) => (
                  <option key={l.line} value={l.label}>
                    {l.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-bg-tertiary/40 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-bg-tertiary px-4 py-2 text-sm font-medium">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !pattern.trim()}
            className="rounded-lg bg-accent-sage px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-sage/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save rule"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ApplyScopeModal({
  ruleId,
  matchCount,
  onClose,
  onGoingForward,
  onRetroactivePreview,
  onRetroactiveConfirm,
  confirming,
}: {
  ruleId: string;
  matchCount: number | null;
  onClose: () => void;
  onGoingForward: () => void;
  onRetroactivePreview: () => Promise<void>;
  onRetroactiveConfirm: () => Promise<void>;
  confirming: boolean;
}) {
  const [retroactiveStep, setRetroactiveStep] = useState<"choose" | "preview" | "confirm">("choose");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "g") onGoingForward();
      if (e.key === "r" && retroactiveStep === "choose") onRetroactivePreview();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onGoingForward, onRetroactivePreview, retroactiveStep]);

  const showPreview = retroactiveStep === "preview";
  const showConfirm = retroactiveStep === "confirm";
  const previewLoading = showPreview && matchCount == null;

  return (
    <div className="fixed inset-0 min-h-[100dvh] z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]" role="dialog" aria-modal="true">
      <div className="rounded-xl bg-white shadow-xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-[#2d3748] px-6 pt-6 pb-4 flex justify-between items-start">
          <h2 className="text-xl font-bold text-white">Apply rule</h2>
          <button type="button" onClick={onClose} className="text-white/80 hover:underline" aria-label="Close">
            <span className="material-symbols-rounded text-[24px]">close</span>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {!showPreview && !showConfirm && (
            <>
              <p className="text-sm text-mono-medium">Apply this rule going forward only, or to all existing matching transactions?</p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={onGoingForward}
                  className="w-full rounded-lg border border-bg-tertiary py-2.5 text-sm font-medium hover:bg-bg-secondary flex items-center justify-between px-4"
                >
                  Apply going forward only
                  <kbd className="kbd-hint text-xs">g</kbd>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onRetroactivePreview();
                    setRetroactiveStep("preview");
                  }}
                  className="w-full rounded-lg border border-bg-tertiary py-2.5 text-sm font-medium hover:bg-bg-secondary flex items-center justify-between px-4"
                >
                  Apply retroactively to all matching
                  <kbd className="kbd-hint text-xs">r</kbd>
                </button>
              </div>
            </>
          )}
          {showPreview && !showConfirm && (
            <>
              {previewLoading ? (
                <p className="text-sm text-mono-medium">Loading…</p>
              ) : (
                <p className="text-sm text-mono-medium">
                  This will affect <strong>{matchCount ?? 0}</strong> transaction{(matchCount ?? 0) !== 1 ? "s" : ""}.
                </p>
              )}
              {!previewLoading && (matchCount ?? 0) >= 100 && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  This is a large batch. Confirm to apply.
                </p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="rounded-lg border border-bg-tertiary px-4 py-2 text-sm font-medium">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setRetroactiveStep("confirm")}
                  disabled={previewLoading}
                  className="rounded-lg bg-accent-sage px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-sage/90 disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            </>
          )}
          {showConfirm && (
            <>
              <p className="text-sm text-mono-medium">Applying rule to {matchCount} transactions…</p>
              <button
                type="button"
                onClick={onRetroactiveConfirm}
                disabled={confirming}
                className="w-full rounded-lg bg-accent-sage px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-sage/90 disabled:opacity-50"
              >
                {confirming ? "Applying…" : "Apply now"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
