/** Brand system page (copied from /test) */
"use client";

import { useState } from "react";

const palette = [
  { name: "Black", hex: "#000000", role: "Core", usage: "Primary backgrounds, body text, maximum contrast", large: true },
  { name: "White", hex: "#FFFFFF", role: "Core", usage: "Surfaces, reversed type, breathing room", large: true },
  { name: "Blue", hex: "#007aff", role: "Primary accent", usage: "Links, focus, primary actions, signature brand moments" },
  { name: "Purple", hex: "#953d96", role: "Accent", usage: "Secondary highlights, charts, distinct UI zones" },
  { name: "Pink", hex: "#f84e9f", role: "Accent", usage: "Campaigns, emphasis, high-energy callouts" },
  { name: "Red", hex: "#e0383e", role: "Semantic", usage: "Errors, destructive actions, critical alerts" },
  { name: "Orange", hex: "#d57119", role: "Semantic", usage: "Warnings, pending review, warm emphasis" },
  { name: "Yellow", hex: "#ffc724", role: "Semantic", usage: "Attention, highlights, caution (pair with dark text)" },
  { name: "Green", hex: "#62ba46", role: "Semantic", usage: "Success, confirmation, positive states" },
  { name: "Grey", hex: "#989898", role: "Neutral", usage: "Secondary text, borders, muted UI" },
] as const;

type SwatchProps = {
  name: string;
  hex: string;
  role: string;
  usage: string;
  large?: boolean;
};

function Swatch({ name, hex, role, usage, large }: SwatchProps) {
  const [copied, setCopied] = useState(false);
  const isLight = ["#ffffff", "#ffc724", "#989898"].includes(hex.toLowerCase());

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
            hex.toLowerCase() === "#ffffff"
              ? "1px solid #E0E0E0"
              : hex.toLowerCase() === "#000000"
                ? "1px solid #222"
                : "none",
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
                background: "#007aff",
                boxShadow: "0 0 0 3px rgba(0,122,255,0.45)",
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
            ExpenseTerminal — Brand palette
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
            Core neutrals plus a primary blue and a spectrum of accents for product UI, marketing, and semantic states
            (success, warning, error).
          </p>
        </header>

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
            Colors
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            {palette.map((c) => (
              <Swatch key={c.name} {...c} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

