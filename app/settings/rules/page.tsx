// Settings > Rules tab
// TODO: wire to /api/rules (auto_sort_rules table)

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vendor Rules · Settings",
};

export default function RulesTab() {
  return (
    <div className="settings__section">
      <div className="settings__section-head">
        <h2 className="settings__section-title">Vendor Rules</h2>
        <p className="settings__section-sub">
          Rules auto-categorize transactions when they sync. Confirm proposed rules to apply them.
        </p>
      </div>

      {/* Rules table placeholder */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 120px 120px 80px",
            gap: 12,
            padding: "10px 16px",
            background: "var(--bone)",
            borderBottom: "1px solid var(--border-soft)",
            fontSize: 10.5,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--ink-4)",
            fontWeight: 700,
          }}
        >
          <div>Vendor</div>
          <div>Categorize as</div>
          <div>Marker</div>
          <div>Confidence</div>
          <div>Auto-apply</div>
        </div>
        <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
          No rules yet — rules are created automatically as you categorize transactions.
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <div className="uppercase-label" style={{ marginBottom: 12 }}>
          Proposed rules · 0 waiting
        </div>
        <div style={{ color: "var(--ink-4)", fontSize: 13 }}>
          No proposed rules yet.
        </div>
      </div>
    </div>
  );
}
