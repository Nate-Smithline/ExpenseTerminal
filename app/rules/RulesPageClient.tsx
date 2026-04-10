"use client";

import { useState, useCallback, useEffect } from "react";
import type { NormalizedRule, RuleConditions, RuleAction } from "@/lib/rules/types";
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
  data_feed: "Direct Feed",
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
  /** When set, show a link to org-wide transaction rules (Plaid/CSV + AI). */
  orgRulesHref?: string;
  /** Hide page title and preference tabs (e.g. embedded on Org settings). */
  embedded?: boolean;
}

const PREF_TABS = [
  { href: "/preferences/org", label: "Org" },
  { href: "/preferences/profile", label: "Profile" },
] as const;

export function RulesPageClient({
  initialRules,
  initialNotificationPreferences,
  orgRulesHref,
  embedded = false,
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
    <div className="space-y-6">
      {!embedded && (
        <div className="space-y-3">
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
      )}

      {orgRulesHref && (
        <section className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7]">
          <div className="px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <div
                role="heading"
                aria-level={2}
                className="text-base md:text-lg font-normal font-sans text-mono-dark"
              >
                Transaction rules
              </div>
              <p className="mt-1 text-xs text-mono-medium font-sans">
                Org-wide rules for Plaid, CSV, and AI (amount, vendor, date, properties).
              </p>
            </div>
            <a
              href={orgRulesHref}
              className="rounded-none bg-[#E8EEF5] px-4 py-2 text-sm font-medium font-sans text-mono-dark hover:opacity-80 shrink-0"
            >
              Open
            </a>
          </div>
        </section>
      )}

      {/* Notifications header + summary in flat card */}
      <section className="border border-[#F0F1F7] divide-y divide-[#F0F1F7] bg-white">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <div
              role="heading"
              aria-level={2}
              className="text-base md:text-lg font-normal font-sans text-mono-dark"
            >
              Notifications
            </div>
            <p className="mt-1 text-xs text-mono-medium font-sans">
              How often we nudge you to review new transactions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNotificationModalOpen(true)}
            className="rounded-none bg-[#E8EEF5] px-4 py-2 text-sm font-medium font-sans text-mono-dark hover:opacity-80"
          >
            Manage
          </button>
        </div>
        <div className="px-4 py-3 text-xs font-sans text-mono-medium">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="font-semibold text-mono-dark min-w-[110px]">Frequency</span>
            <span className="truncate">
              {notificationSummary(notificationPreferences)}
            </span>
          </div>
        </div>
      </section>

      {/* Rules list in flat card */}
      <section className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7]">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <div
              role="heading"
              aria-level={2}
              className="text-base md:text-lg font-normal font-sans text-mono-dark"
            >
              Rules
            </div>
            <p className="mt-1 text-xs text-mono-medium font-sans">
              Saved automations that categorize or exclude transactions.
            </p>
          </div>
        </div>
        <div className="px-0 py-0">
          {visibleRules.length === 0 ? (
            <div className="px-4 py-4 text-xs font-sans text-mono-medium">
              <p className="font-semibold text-mono-dark">No rules yet</p>
              <p className="mt-2">
                Rules automatically categorize or exclude transactions based on vendor or description.
                Rules you create elsewhere will appear here automatically.
              </p>
            </div>
          ) : (
            <div>
              {visibleRules.map((rule) => (
                <div
                  key={rule.id}
                  className="px-4 py-3 flex items-center justify-between gap-3"
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
                    <span
                      className="material-symbols-rounded leading-none inline-flex items-center justify-center"
                      style={{ fontSize: 16 }}
                    >
                      delete
                    </span>
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
      <div className="rounded-none bg-white shadow-xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-white px-6 pt-6 pb-1 flex items-start">
          <h2
            className="text-xl text-mono-dark font-medium"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            Notification Preferences
          </h2>
        </div>
        <div className="px-6 py-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTab("time")}
              className={`py-2.5 px-3 text-sm font-medium font-sans transition-colors rounded-none border ${
                tab === "time"
                  ? "border-[#F0F1F7] bg-[#F0F1F7] text-mono-dark"
                  : "border-[#F0F1F7] bg-white text-mono-medium hover:bg-[#F0F1F7]"
              }`}
            >
              Time-Based
            </button>
            <button
              type="button"
              onClick={() => setTab("count")}
              className={`py-2.5 px-3 text-sm font-medium font-sans transition-colors rounded-none border ${
                tab === "count"
                  ? "border-[#F0F1F7] bg-[#F0F1F7] text-mono-dark"
                  : "border-[#F0F1F7] bg-white text-mono-medium hover:bg-[#F0F1F7]"
              }`}
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
                    className={`px-3 py-2 text-sm font-medium font-sans capitalize rounded-none border ${
                      interval === v
                        ? "border-[#F5F0E8] bg-[#F5F0E8] text-mono-dark"
                        : "border-[#F5F0E8] bg-white text-mono-medium hover:bg-[#F5F0E8]"
                    }`}
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
                    className={`px-3 py-2 text-sm font-medium font-sans rounded-none border ${
                      countValue === v && !customCount
                        ? "border-[#F5F0E8] bg-[#F5F0E8] text-mono-dark"
                        : "border-[#F5F0E8] bg-white text-mono-medium hover:bg-[#F5F0E8]"
                    }`}
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSave();
                    }
                  }}
                  placeholder="e.g. 250"
                  className={`w-full border px-4 py-3 text-sm text-mono-dark bg-white rounded-none focus:border-black outline-none ${
                    countError ? "border-amber-500" : "border-bg-tertiary/60"
                  }`}
                />
                {countError && <p className="text-xs text-amber-600 mt-1">{countError}</p>}
              </div>
            </>
          )}
        </div>
        <div className="px-6 pt-2 pb-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium font-sans bg-[#F0F1F7] text-mono-dark rounded-none hover:bg-[#E4E7F0] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2.5 text-sm font-medium font-sans bg-black text-white rounded-none hover:bg-black/85 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}