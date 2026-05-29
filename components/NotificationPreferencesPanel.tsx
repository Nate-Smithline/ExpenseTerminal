"use client";

import { useEffect, useState } from "react";

export type NotificationPrefs = {
  user_id: string;
  type: "count_based" | "interval_based";
  value: string;
  last_notified_at: string | null;
  last_counter_reset_at: string | null;
  created_at: string;
  updated_at: string;
} | null;

const COUNT_PRESETS = ["10", "100", "500", "1000"];

export function notificationSummary(prefs: NotificationPrefs): string {
  if (!prefs) return "Not configured (defaults to monthly when saved)";
  if (prefs.type === "interval_based") {
    const v = prefs.value;
    if (v === "daily") return "Daily";
    if (v === "weekly") return "Weekly";
    if (v === "monthly") return "Monthly";
    if (v === "quarterly") return "Quarterly";
    return v;
  }
  return `Every ${prefs.value} unsorted transactions`;
}

type NotificationPreferencesPanelProps = {
  initialPrefs: NotificationPrefs;
  onSaved?: (prefs: NotificationPrefs) => void;
};

export function NotificationPreferencesPanel({ initialPrefs, onSaved }: NotificationPreferencesPanelProps) {
  const isCountBased = initialPrefs?.type === "count_based";
  const isIntervalBased = initialPrefs?.type === "interval_based";
  const savedCountValue = initialPrefs?.type === "count_based" ? initialPrefs.value : "100";
  const savedCountIsPreset = COUNT_PRESETS.includes(savedCountValue);

  const [tab, setTab] = useState<"time" | "count">(
    isIntervalBased ? "time" : isCountBased ? "count" : "time",
  );
  const [interval, setInterval] = useState(isIntervalBased ? initialPrefs!.value : "monthly");
  const [countValue, setCountValue] = useState(savedCountIsPreset ? savedCountValue : "100");
  const [customCount, setCustomCount] = useState(savedCountIsPreset ? "" : savedCountValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setTab(isIntervalBased ? "time" : isCountBased ? "count" : "time");
    setInterval(isIntervalBased ? initialPrefs!.value : "monthly");
    setCountValue(savedCountIsPreset ? savedCountValue : "100");
    setCustomCount(savedCountIsPreset ? "" : savedCountValue);
  }, [initialPrefs, isCountBased, isIntervalBased, savedCountIsPreset, savedCountValue]);

  async function save(type: "count_based" | "interval_based", value: string) {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Failed to save");
        return;
      }
      setSuccess(true);
      onSaved?.(data);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Failed to save. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    setError(null);
    if (tab === "time") {
      await save("interval_based", interval);
      return;
    }
    const val = customCount.trim() ? customCount.trim() : countValue;
    if (!/^\d+$/.test(val) || parseInt(val, 10) < 1) {
      setError("Enter a whole number (1 or more).");
      return;
    }
    await save("count_based", val);
  }

  return (
    <div className="card" style={{ padding: "20px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          className={`btn btn--ghost btn--mini${tab === "time" ? " is-active" : ""}`}
          style={tab === "time" ? { background: "var(--bone-2)", borderColor: "var(--border-firm)" } : undefined}
          onClick={() => setTab("time")}
        >
          Time-based
        </button>
        <button
          type="button"
          className={`btn btn--ghost btn--mini${tab === "count" ? " is-active" : ""}`}
          style={tab === "count" ? { background: "var(--bone-2)", borderColor: "var(--border-firm)" } : undefined}
          onClick={() => setTab("count")}
        >
          By transaction count
        </button>
      </div>

      {tab === "time" ? (
        <>
          <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 12, lineHeight: 1.5 }}>
            We&apos;ll email you on this schedule when you have unsorted transactions in your inbox.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(["daily", "weekly", "monthly", "quarterly"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className="btn btn--ghost btn--mini"
                style={
                  interval === v
                    ? { background: "var(--forest-tint)", borderColor: "var(--forest)", color: "var(--forest-deep)" }
                    : undefined
                }
                onClick={() => setInterval(v)}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 12, lineHeight: 1.5 }}>
            We&apos;ll email you once you reach this many unsorted transactions.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {COUNT_PRESETS.map((v) => (
              <button
                key={v}
                type="button"
                className="btn btn--ghost btn--mini"
                style={
                  countValue === v && !customCount
                    ? { background: "var(--forest-tint)", borderColor: "var(--forest)", color: "var(--forest-deep)" }
                    : undefined
                }
                onClick={() => { setCountValue(v); setCustomCount(""); setError(null); }}
              >
                Every {v}
              </button>
            ))}
          </div>
          <div className="settings__field">
            <div className="uppercase-label" style={{ marginBottom: 6 }}>Custom count</div>
            <input
              type="number"
              min={1}
              className="settings__input"
              value={customCount}
              onChange={(e) => { setCustomCount(e.target.value); setError(null); }}
              placeholder="e.g. 250"
            />
          </div>
        </>
      )}

      {error && (
        <p style={{ fontSize: 13, color: "var(--ember)", marginTop: 12 }}>{error}</p>
      )}
      {success && (
        <p style={{ fontSize: 13, color: "var(--forest-deep)", marginTop: 12 }}>Preferences saved.</p>
      )}

      <div style={{ marginTop: 20 }}>
        <button type="button" className="btn btn--primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </div>
  );
}
