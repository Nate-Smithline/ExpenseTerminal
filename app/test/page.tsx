/** Siloed test page for visualizing the brand color system. */
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
  const isLight = ["#FFFFFF", "#E8EEF5", "#DCFCE7", "#FEE2E2", "#FEF3C7"].includes(hex);

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
              color: "#F4F7FC",
              letterSpacing: "0.01em",
            }}
          >
            {name}
          </span>
          <span
            style={{
              fontSize: 11,
              color: "#8A9BB0",
              fontFamily: "monospace",
              letterSpacing: "0.04em",
            }}
          >
            {hex}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "#5B82B4", fontWeight: 500, marginBottom: 3 }}>
          {role}
        </div>
        <div style={{ fontSize: 11, color: "#606878", lineHeight: 1.45 }}>{usage}</div>
      </div>
    </div>
  );
}

export default function Palette() {
  return (
    <div
      style={{
        background: "#0A0A0A",
        minHeight: "100vh",
        padding: "48px 40px",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=DM+Sans:wght@300;400;500&display=swap');`}</style>

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            marginBottom: 48,
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            paddingBottom: 32,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#5B82B4",
              marginBottom: 10,
            }}
          >
            ExpenseTerminal
          </div>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 42,
              fontWeight: 400,
              color: "#fff",
              margin: 0,
              lineHeight: 1,
            }}
          >
            Brand Color System
          </h1>
          <p style={{ color: "#8A9BB0", fontSize: 13, marginTop: 10 }}>
            Click any swatch to copy the hex value.
          </p>
        </div>

        {/* Core */}
        <div style={{ marginBottom: 48 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#8A9BB0",
              marginBottom: 20,
            }}
          >
            Core Palette — 3 colors
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
            }}
          >
            {core.map((s) => (
              <Swatch key={s.hex} {...s} large />
            ))}
          </div>
        </div>

        {/* Supporting */}
        <div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#8A9BB0",
              marginBottom: 20,
            }}
          >
            Supporting Palette — UI States &amp; Surfaces
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
            }}
          >
            {supporting.map((s) => (
              <Swatch key={s.hex} {...s} />
            ))}
          </div>
        </div>

        {/* Usage example strip */}
        <div
          style={{
            marginTop: 48,
            borderTop: "1px solid rgba(255,255,255,0.07)",
            paddingTop: 32,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#8A9BB0",
              marginBottom: 20,
            }}
          >
            Quick Reference — UI Components
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button
              style={{
                background: "#2563EB",
                color: "#fff",
                border: "none",
                padding: "10px 20px",
                fontSize: 13,
                fontFamily: "inherit",
                cursor: "pointer",
                borderRadius: 2,
              }}
            >
              Primary CTA
            </button>
            <button
              style={{
                background: "transparent",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.2)",
                padding: "10px 20px",
                fontSize: 13,
                fontFamily: "inherit",
                cursor: "pointer",
                borderRadius: 2,
              }}
            >
              Secondary
            </button>
            <span
              style={{
                background: "#DCFCE7",
                color: "#16A34A",
                fontSize: 11,
                padding: "4px 10px",
                fontWeight: 500,
                borderRadius: 2,
              }}
            >
              ✓ Approved
            </span>
            <span
              style={{
                background: "#FEF3C7",
                color: "#D97706",
                fontSize: 11,
                padding: "4px 10px",
                fontWeight: 500,
                borderRadius: 2,
              }}
            >
              ⏳ Pending
            </span>
            <span
              style={{
                background: "#FEE2E2",
                color: "#DC2626",
                fontSize: 11,
                padding: "4px 10px",
                fontWeight: 500,
                borderRadius: 2,
              }}
            >
              ✕ Error
            </span>
            <span
              style={{
                background: "rgba(201,168,76,0.12)",
                color: "#C9A84C",
                border: "1px solid rgba(201,168,76,0.25)",
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 2,
              }}
            >
              ★ Premium
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

