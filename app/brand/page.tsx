/** Brand system page (copied from /test) */
"use client";

import { useState } from "react";

const core = [
  { name: "Pure Black", hex: "#000000", role: "Primary Background / Hero", usage: "Page BG, navbar, hero sections" },
  { name: "Pure White", hex: "#FFFFFF", role: "Primary Text / Surfaces", usage: "Headlines, card backgrounds, content areas" },
  { name: "Sovereign Blue", hex: "#5B82B4", role: "Brand / Signature Color", usage: "Logo, key accents, brand moments — adjacent to GS blue but distinctly yours" },
];

const supporting = [
  { name: "Deep Navy", hex: "#0D1F35", role: "Elevated Surface", usage: "Cards, sidebars, modals on black BG" },
  { name: "Steel", hex: "#8A9BB0", role: "Secondary Text", usage: "Subtext, labels, placeholders, borders" },
  { name: "Frost", hex: "#E8EEF5", role: "Light Surface", usage: "Input backgrounds, table rows, subtle dividers" },
  { name: "Cool Stock", hex: "#F0F1F7", role: "Cool Off-White Surface", usage: "Alternate light backgrounds, receipts, neutral UI zones" },
  { name: "Warm Stock", hex: "#F5F0E8", role: "Warm Off-White Surface", usage: "Invoices, documents, warm-feeling surfaces" },
  { name: "CTA Blue", hex: "#2563EB", role: "Buttons / Interactive", usage: "Primary buttons, links, focus rings" },
  { name: "CTA Hover", hex: "#1D4ED8", role: "Button Hover / Pressed", usage: "Hover and active states on CTA Blue" },
  { name: "Signal Gold", hex: "#C9A84C", role: "Trust / Premium Accent", usage: "Badges, 'Made in America', premium tier markers — use sparingly" },
  { name: "Success", hex: "#16A34A", role: "Success / Confirmed", usage: "Approved deductions, saved states, confirmations" },
  { name: "Success Subtle", hex: "#DCFCE7", role: "Success Background", usage: "Success banners, row highlights, toasts" },
  { name: "Error", hex: "#DC2626", role: "Error / Destructive", usage: "Form errors, failed states, delete actions" },
  { name: "Error Subtle", hex: "#FEE2E2", role: "Error Background", usage: "Error banners, invalid field fills" },
  { name: "Warning", hex: "#D97706", role: "Warning / Pending", usage: "Pending deductions, review-required states" },
  { name: "Warning Subtle", hex: "#FEF3C7", role: "Warning Background", usage: "Pending banners, flagged row highlights" },
];

type SwatchProps = {
  name: string;
  hex: string;
  role: string;
  usage: string;
  large?: boolean;
};

function Swatch({ name, hex, role, usage, large }: SwatchProps) {
  const [copied, setCopied] = useState(false);
  const isLight = ["#FFFFFF", "#E8EEF5", "#DCFCE7", "#FEE2E2", "#FEF3C7", "#F0F1F7", "#F5F0E8"].includes(hex);

  const copy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(hex).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      onClick={copy}
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        overflow: "hidden",
        cursor: "pointer",
        border: "1px solid rgba(255,255,255,0.07)",
        transition: "transform 0.15s, box-shadow 0.15s",
        fontFamily: "'DM Sans', sans-serif",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.4)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          background: hex,
          height: large ? 100 : 72,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "flex-end",
          padding: "8px 10px",
          border:
            hex === "#FFFFFF" ? "1px solid #E0E0E0" : hex === "#000000" ? "1px solid #222" : "none",
          position: "relative",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.06em",
            color: isLight ? "#00000066" : "rgba(255,255,255,0.5)",
            opacity: copied ? 0 : 1,
            transition: "opacity 0.2s",
          }}
        >
          CLICK TO COPY
        </span>
        {copied && (
          <span
            style={{
              fontSize: 10,
              color: isLight ? "#000" : "#fff",
              position: "absolute",
              right: 8,
              bottom: 8,
            }}
          >
            ✓ COPIED
          </span>
        )}
      </div>
      <div style={{ background: "#111318", padding: "12px 14px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "#F9FAFB",
            }}
          >
            {name}
          </span>
          <span
            style={{
              fontSize: 11,
              fontVariantNumeric: "tabular-nums",
              color: "#9CA3AF",
            }}
          >
            {hex}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>{role}</div>
        <div style={{ fontSize: 11, color: "#6B7280" }}>{usage}</div>
      </div>
    </div>
  );
}

export default function BrandPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#02040B",
        color: "#F9FAFB",
        padding: "32px 24px 40px",
        fontFamily: "'DM Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <header style={{ marginBottom: 32 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(15,23,42,0.85)",
              border: "1px solid rgba(148,163,184,0.35)",
              marginBottom: 12,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "999px",
                background: "#5B82B4",
                boxShadow: "0 0 0 3px rgba(91,130,180,0.45)",
              }}
            />
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "#E5E7EB" }}>
              Brand Color System
            </span>
          </div>
          <h1
            style={{
              fontSize: 32,
              lineHeight: 1.15,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              margin: 0,
            }}
          >
            ExpenseTerminal — Sovereign palette
          </h1>
          <p
            style={{
              marginTop: 12,
              maxWidth: 640,
              fontSize: 14,
              lineHeight: 1.6,
              color: "#9CA3AF",
            }}
          >
            Exploration of a brand system that feels serious, sovereign, and American-made — with a deep navy core,
            sovereign blue accent, and signal gold used sparingly for premium moments.
          </p>
        </header>

        <section style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 14,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: "#6B7280",
              marginBottom: 12,
            }}
          >
            Core
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            {core.map((c) => (
              <Swatch key={c.name} {...c} large />
            ))}
          </div>
        </section>

        <section>
          <h2
            style={{
              fontSize: 14,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: "#6B7280",
              marginBottom: 12,
            }}
          >
            Supporting &amp; semantic
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            {supporting.map((c) => (
              <Swatch key={c.name} {...c} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

