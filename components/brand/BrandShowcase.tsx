"use client";

import { useMemo, useState } from "react";

type Swatch = {
  name: string;
  varName: string;
  fallback: string;
  description: string;
};

function readCssVar(varName: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return value || fallback;
}

function copy(text: string) {
  return navigator.clipboard.writeText(text);
}

function Modal({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.28)",
        display: "grid",
        placeItems: "center",
        padding: 18,
        zIndex: 50,
      }}
    >
      <div className="card" style={{ width: "min(720px, 100%)", padding: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ paddingRight: 12 }}>
            <div className="h2">{title}</div>
            {description ? <p className="p" style={{ marginTop: 6 }}>{description}</p> : null}
          </div>
          <button className="btn btnGhost" onClick={onClose} aria-label="Close">
            Close <span className="kbd">Esc</span>
          </button>
        </div>
        <div style={{ marginTop: 14 }}>{children}</div>
      </div>
    </div>
  );
}

function PickerRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12, alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 650, letterSpacing: "-0.01em" }}>{label}</div>
        {hint ? <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 2 }}>{hint}</div> : null}
      </div>
      <div className="row">{children}</div>
    </div>
  );
}

export function BrandShowcase() {
  const [modalOpen, setModalOpen] = useState(false);
  const [bannerKind, setBannerKind] = useState<"info" | "strong" | "danger">("info");
  const [toast, setToast] = useState<string | null>(null);
  const [accentMode, setAccentMode] = useState<"signal_red" | "function_yellow">("signal_red");

  const swatches: Swatch[] = useMemo(
    () => [
      { name: "Braun White", varName: "--bg", fallback: "#F0EDE5", description: "Primary housing / canvas." },
      { name: "Light Surface", varName: "--surface", fallback: "#E6E1D8", description: "Secondary surface, subtle separation." },
      { name: "Pebble", varName: "--surface-2", fallback: "#C5C3BE", description: "Controls and elevated areas (quiet hierarchy)." },
      { name: "Warm Black", varName: "--text", fallback: "#1A1A18", description: "Typography and labels." },
      { name: "Muted text", varName: "--muted", fallback: "rgba(26,26,24,0.72)", description: "Secondary information." },
      { name: "Signal Red", varName: "--accent", fallback: "#C02820", description: "Primary action (one per context)." },
      { name: "Function Yellow", varName: "--warning", fallback: "#D4B018", description: "Indicator only (sparingly)." },
    ],
    [],
  );

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1400);
  }

  return (
    <div style={{ padding: "28px 0 60px" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p className="sectionTitle">Brand</p>
          <h1 className="h1">Component library (Braun / Rams)</h1>
          <p className="p" style={{ marginTop: 10, maxWidth: 740 }}>
            Functional color, strict hierarchy, and neutral forms. No decoration. Use one accent
            only when it communicates meaning.
          </p>
        </div>
        <div className="row">
          <span className="badge">
            <span className="kbd">Cmd</span>+<span className="kbd">K</span> (future)
          </span>
        </div>
      </div>

      <div style={{ marginTop: 22, display: "grid", gap: 14 }}>
        <div className="card" style={{ padding: 16, background: "var(--surface)" }}>
          <p className="sectionTitle">Functional color</p>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ maxWidth: 760 }}>
              <p className="p">
                Rams-era Braun uses color as an operational language: mostly neutrals, then a single
                accent to mark the one control that must be immediately identifiable. Avoid “rainbow
                UI.” Prefer tone, spacing, and labels.
              </p>
              <p className="p" style={{ marginTop: 8 }}>
                Rule of thumb: <strong style={{ color: "var(--text)" }}>one chromatic accent per screen.</strong>
              </p>
            </div>
            <div className="row">
              <button
                className={`btn ${accentMode === "signal_red" ? "btnPrimary" : ""}`}
                onClick={() => setAccentMode("signal_red")}
                title="Signal Red"
              >
                Signal Red
              </button>
              <button
                className={`btn ${accentMode === "function_yellow" ? "btnPrimary" : ""}`}
                onClick={() => setAccentMode("function_yellow")}
                title="Function Yellow"
                style={
                  accentMode === "function_yellow"
                    ? { background: "var(--warning)", color: "var(--text)", borderColor: "rgba(26,26,24,0.28)" }
                    : undefined
                }
              >
                Function Yellow
              </button>
            </div>
          </div>
        </div>

        <div className={`banner ${bannerKind === "strong" ? "bannerStrong" : bannerKind === "danger" ? "bannerDanger" : ""}`}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 650, color: "var(--text)" }}>
                Banner
              </div>
              <div style={{ marginTop: 4 }}>
                {bannerKind === "danger"
                  ? "Destructive messaging: rare, specific, actionable."
                  : bannerKind === "strong"
                    ? "Primary informational banner with a single, clear CTA."
                    : "Neutral informational banner for calm guidance."}
              </div>
            </div>
            <div className="row">
              <button className="btn btnGhost" onClick={() => setBannerKind("info")}>
                Neutral
              </button>
              <button className="btn btnGhost" onClick={() => setBannerKind("strong")}>
                Emphasis
              </button>
              <button className="btn btnGhost" onClick={() => setBannerKind("danger")}>
                Danger
              </button>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <p className="sectionTitle">Colors</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {swatches.map((s) => (
              <button
                key={s.varName}
                className="btn"
                style={{ height: "auto", padding: 12, textAlign: "left" }}
                onClick={async () => {
                  const v = readCssVar(s.varName, s.fallback);
                  await copy(v);
                  showToast(`Copied ${s.name}: ${v}`);
                }}
              >
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 700 }}>{s.name}</div>
                  <span className="kbd">Copy</span>
                </div>
                <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "52px 1fr", gap: 10, alignItems: "center" }}>
                  <div
                    style={{
                      width: 52,
                      height: 36,
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: `var(${s.varName}, ${s.fallback})`,
                    }}
                  />
                  <div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>
                      var({s.varName})
                    </div>
                    <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 2 }}>{s.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <p className="sectionTitle">Typography</p>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div className="h1">Less, but better.</div>
              <p className="p" style={{ marginTop: 10 }}>
                Typography carries hierarchy without decoration. Use uppercase section labels, tabular numbers,
                and explicit names for controls.
              </p>
            </div>
            <div className="row">
              <span className="badge">Default badge</span>
              <span className="badge">
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--accent)" }} />
                Active
              </span>
              <span className="badge">
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--warning)" }} />
                Indicator
              </span>
              <span className="badge">
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--text)" }} />
                Label
              </span>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <p className="sectionTitle">Buttons</p>
          <div className="row">
            <button
              className="btn btnPrimary"
              style={
                accentMode === "function_yellow"
                  ? { background: "var(--warning)", color: "var(--text)", borderColor: "rgba(26,26,24,0.28)" }
                  : undefined
              }
            >
              Primary
            </button>
            <button className="btn">Secondary</button>
            <button className="btn btnGhost">Ghost</button>
            <button className="btn btnDanger">Destructive</button>
            <button className="btn" disabled style={{ opacity: 0.55, cursor: "not-allowed" }}>
              Disabled
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <p className="sectionTitle">Pickers</p>
          <div style={{ display: "grid", gap: 14 }}>
            <PickerRow label="Text input" hint="Clear border, soft focus ring">
              <input className="input" placeholder="Merchant (e.g., Notion)" />
              <span className="badge">Inline hint</span>
            </PickerRow>
            <PickerRow label="Select" hint="Simple, native by default">
              <select className="input" defaultValue="office">
                <option value="office">Office expense</option>
                <option value="utilities">Utilities</option>
                <option value="travel">Travel</option>
                <option value="meals">Meals</option>
              </select>
            </PickerRow>
            <PickerRow label="Segmented" hint="One obvious default">
              {(["All", "Needs review", "Business", "Personal"] as const).map((v) => (
                <button key={v} className="btn btnGhost">
                  {v}
                </button>
              ))}
            </PickerRow>
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <p className="sectionTitle">Modal</p>
          <div className="row">
            <button className="btn btnPrimary" onClick={() => setModalOpen(true)}>
              Open modal
            </button>
            <span className="p" style={{ marginLeft: 6 }}>
              One job per modal. One primary action.
            </span>
          </div>
        </div>
      </div>

      <Modal
        open={modalOpen}
        title="Review transaction"
        description="Minimal, keyboard-forward decisions. No clutter."
        onClose={() => setModalOpen(false)}
      >
        <div className="card" style={{ padding: 14, background: "var(--surface)" }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 750, letterSpacing: "-0.01em" }}>Notion</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--faint)", marginTop: 2 }}>
                $10.00 · Oct 15
              </div>
            </div>
            <span className="badge">Confidence 0.94</span>
          </div>
          <p className="p" style={{ marginTop: 10 }}>
            Suggestion: <strong style={{ color: "var(--text)" }}>Line 18 — Office expense</strong>
          </p>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn btnPrimary" onClick={() => { setModalOpen(false); showToast("Applied as Business"); }}>
              Business <span className="kbd">B</span>
            </button>
            <button className="btn" onClick={() => { setModalOpen(false); showToast("Marked Personal"); }}>
              Personal <span className="kbd">P</span>
            </button>
            <button className="btn btnGhost" onClick={() => showToast("Open category picker")}>
              Pick another <span className="kbd">C</span>
            </button>
          </div>
        </div>
      </Modal>

      {toast ? (
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            left: 18,
            bottom: 18,
            zIndex: 60,
            background: "rgba(255,255,255,0.92)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-md)",
            borderRadius: 999,
            padding: "10px 14px",
            color: "var(--text)",
            fontSize: 13,
            backdropFilter: "blur(10px)",
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

