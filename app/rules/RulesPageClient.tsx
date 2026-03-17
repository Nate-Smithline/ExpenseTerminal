"use client";

import { useState, useCallback, useEffect } from "react";
import type { NormalizedRule, RuleConditions, RuleAction } from "@/lib/rules/types";
import { SCHEDULE_C_LINES } from "@/lib/tax/schedule-c-lines";
import { PreferencesTabs } from "@/app/preferences/PreferencesTabs";

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
  if (!prefs) return "Monthly";
  if (prefs.type === "interval_based") {
    const v = prefs.value;
    const label = v === "daily" ? "Daily" : v === "weekly" ? "Weekly" : v === "monthly" ? "Monthly" : v === "quarterly" ? "Quarterly" : v;
    return label;
  }
  return `Every ${prefs.value} transactions`;
}

interface RulesPageClientProps {
  initialRules: NormalizedRule[];
  initialNotificationPreferences: NotificationPrefs;
}

const PREF_TABS = [
  { href: "/preferences/automations", label: "Automations" },
  { href: "/preferences/profile", label: "Profile" },
  { href: "/preferences/billing", label: "Billing" },
  { href: "/preferences/org", label: "Org" },
] as const;

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
      <div className="space-y-4">
        <div>
          <div
            role="heading"
            aria-level={1}
            className="text-[32px] leading-tight font-sans font-normal text-mono-dark"
          >
            Automations
          </div>
          <p className="text-base text-mono-medium mt-1 font-sans">
            Set policies to help automate decisions and save even more time.
          </p>
        </div>
        <PreferencesTabs tabs={PREF_TABS} />
      </div>

      {/* Notifications header + summary */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div
            role="heading"
            aria-level={2}
            className="text-base md:text-lg font-normal font-sans text-mono-dark"
          >
            Notifications
          </div>
          <button
            type="button"
            onClick={() => setNotificationModalOpen(true)}
            className="rounded-none bg-[#E8EEF5] px-4 py-2 text-sm font-medium font-sans text-mono-dark hover:bg-[#e0e8f3] transition-colors"
          >
            Manage
          </button>
        </div>
        <p className="text-sm text-mono-medium font-sans mt-3">
          {notificationSummary(notificationPreferences)}
        </p>
      </section>

      {/* Rules list */}
      <section>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div
            role="heading"
            aria-level={2}
            className="text-base md:text-lg font-normal font-sans text-mono-dark"
          >
            Rules
          </div>
        </div>
        <div className="space-y-3">
          {visibleRules.length === 0 ? (
            <div className="rounded-xl border border-bg-tertiary/40 bg-white p-6 text-center">
              <p className="text-sm font-medium text-mono-dark">No rules yet</p>
              <p className="text-sm text-mono-light mt-2 max-w-md mx-auto">
                Rules automatically categorize or exclude transactions based on vendor or description. For example: when vendor contains &ldquo;AWS&rdquo; → categorize as Software, or when description contains &ldquo;Netflix&rdquo; → exclude from business.
              </p>
              <p className="text-sm text-mono-medium mt-3">
                Rules you create elsewhere will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="border border-[#F0F1F7] divide-y divide-[#F0F1F7]">
              {visibleRules.map((rule) => (
              <div
                key={rule.id}
                className="px-4 py-3 flex items-center justify-between gap-3 bg-white"
              >
                <p className="text-xs text-mono-medium font-sans leading-relaxed min-w-0 flex-1">
                  If {formatConditionSummary(rule.conditions)} → {formatActionSummary(rule.action)}
                </p>
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
                  className="p-1.5 text-mono-light hover:text-red-600 shrink-0 flex items-center justify-center self-center transition-colors duration-500"
                  aria-label="Delete rule"
                >
                  <span className="material-symbols-rounded leading-none inline-flex items-center justify-center" style={{ fontSize: 16 }}>delete</span>
                </button>
              </div>
              ))}
            </div>
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