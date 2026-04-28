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
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");

  const swatches: Swatch[] = useMemo(
    () => [
      { name: "Background", varName: "--bg", fallback: "#ffffff", description: "Primary canvas." },
      { name: "Surface", varName: "--surface", fallback: "#f7f7f8", description: "Subtle section fill." },
      { name: "Surface 2", varName: "--surface-2", fallback: "#efeff2", description: "Elevated backgrounds." },
      { name: "Text", varName: "--text", fallback: "#121316", description: "Primary text." },
      { name: "Muted", varName: "--muted", fallback: "rgba(18,19,22,0.68)", description: "Secondary text." },
      { name: "Accent", varName: "--accent", fallback: "#1f6feb", description: "Primary action." },
      { name: "Success", varName: "--success", fallback: "#1f7a4a", description: "Affirmations." },
      { name: "Warning", varName: "--warning", fallback: "#8a6a00", description: "Caution." },
      { name: "Danger", varName: "--danger", fallback: "#b42318", description: "Destructive." },
    ],
    [],
  );

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1400);
  }

  return (
    <div style={{ padding: "28px 0 60px" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p className="sectionTitle">Brand</p>
          <h1 className="h1">Brand kit (Apple × Rams × Notion)</h1>
          <p className="p" style={{ marginTop: 10, maxWidth: 740 }}>
            Neutral-first UI with one calm accent. Rams-level restraint, Apple-level clarity, and
            Notion-style practicality (callouts, density controls, simple primitives).
          </p>
        </div>
        <div className="row">
          <span className="badge">
            <span className="kbd">Cmd</span>+<span className="kbd">K</span> (future)
          </span>
          <span className="badge">
            Density{" "}
            <button
              className="btn btnGhost"
              style={{ height: 26, padding: "0 10px" }}
              onClick={() => setDensity((d) => (d === "comfortable" ? "compact" : "comfortable"))}
            >
              {density === "comfortable" ? "Comfortable" : "Compact"}
            </button>
          </span>
        </div>
      </div>

      <div style={{ marginTop: 22, display: "grid", gap: 14 }}>
        <div
          className={`banner ${bannerKind === "strong" ? "bannerStrong" : bannerKind === "danger" ? "bannerDanger" : ""}`}
        >
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 650, color: "var(--text)" }}>
                Notion-style callout
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
                Default
              </button>
              <button className="btn btnGhost" onClick={() => setBannerKind("strong")}>
                Info
              </button>
              <button className="btn btnGhost" onClick={() => setBannerKind("danger")}>
                Warning
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
              <div className="h1">Get tax assistance and savings — without the time or hassle.</div>
              <p className="p" style={{ marginTop: 10 }}>
                Practical, scannable text. No decorative copy. Labels are explicit. Hierarchy is done
                with spacing, weight, and tone—never with extra ornament.
              </p>
            </div>
            <div className="row">
              <span className="badge">Default badge</span>
              <span className="badge">
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--success)" }} />
                Success
              </span>
              <span className="badge">
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--warning)" }} />
                Warning
              </span>
              <span className="badge">
                <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--danger)" }} />
                Danger
              </span>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <p className="sectionTitle">Buttons</p>
          <div className="row">
            <button className="btn btnPrimary">Primary action</button>
            <button className="btn">Secondary</button>
            <button className="btn btnGhost">Ghost</button>
            <button className="btn btnDanger">Destructive</button>
            <button className="btn" disabled style={{ opacity: 0.55, cursor: "not-allowed" }}>
              Disabled
            </button>
          </div>
        </div>

        <div className="card cardSubtle" style={{ padding: 16 }}>
          <p className="sectionTitle">Table (Notion-like)</p>
          <div
            className="card"
            style={{
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "none",
              border: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr 140px 140px",
                gap: 0,
                background: "var(--surface)",
                padding: density === "compact" ? "8px 12px" : "10px 12px",
                fontSize: 12,
                color: "var(--faint)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              <div>Date</div>
              <div>Merchant</div>
              <div style={{ textAlign: "right" }}>Amount</div>
              <div>Status</div>
            </div>
            {[
              { date: "Oct 15", merchant: "Notion", amount: "$10.00", status: "Needs review" },
              { date: "Oct 14", merchant: "Blue Bottle Coffee", amount: "$8.75", status: "Auto-sorted" },
              { date: "Oct 12", merchant: "AWS", amount: "$42.13", status: "Auto-sorted" },
            ].map((r) => (
              <div
                key={r.date + r.merchant}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 1fr 140px 140px",
                  padding: density === "compact" ? "8px 12px" : "11px 12px",
                  borderTop: "1px solid var(--border)",
                  alignItems: "center",
                  fontSize: 13,
                }}
              >
                <div style={{ color: "var(--muted)" }}>{r.date}</div>
                <div style={{ color: "var(--text)", fontWeight: 600 }}>{r.merchant}</div>
                <div style={{ textAlign: "right", fontFamily: "var(--mono)" }}>{r.amount}</div>
                <div>
                  <span className="badge">{r.status}</span>
                </div>
              </div>
            ))}
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

