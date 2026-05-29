"use client";

import { useState } from "react";
import {
  NotificationPreferencesPanel,
  notificationSummary,
  type NotificationPrefs,
} from "@/components/NotificationPreferencesPanel";

export function NotificationsSettingsClient({
  initialPrefs,
}: {
  initialPrefs: NotificationPrefs;
}) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initialPrefs);

  return (
    <div className="settings__section">
      <div className="settings__section-head">
        <h2 className="settings__section-title">Notifications</h2>
        <p className="settings__section-sub">
          Email reminders for unsorted transactions. Current:{" "}
          <strong style={{ color: "var(--ink)" }}>{notificationSummary(prefs)}</strong>
        </p>
      </div>

      <NotificationPreferencesPanel initialPrefs={prefs} onSaved={setPrefs} />

      <div className="card" style={{ padding: "16px 20px", marginTop: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
          Quarterly estimated tax reminders
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.5, margin: 0 }}>
          We automatically email you <strong style={{ color: "var(--ink-2)" }}>14 days</strong> and{" "}
          <strong style={{ color: "var(--ink-2)" }}>3 days</strong> before each IRS estimated tax due date.
          These reminders go to your account email and cannot be turned off in this version.
        </p>
      </div>
    </div>
  );
}
