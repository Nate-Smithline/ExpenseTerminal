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
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [activeTab, setActiveTab] = useState<"Overview" | "Inbox" | "Settings">("Overview");
  const [switchOn, setSwitchOn] = useState(true);
  const [tipOpen, setTipOpen] = useState(false);
  const [copyValue, setCopyValue] = useState("1099-K · Stripe · $4,210.00");
  const [pasteValue, setPasteValue] = useState("");
  const [viewMode, setViewMode] = useState<"Table" | "Board">("Table");
  const [graphHover, setGraphHover] = useState<number | null>(null);
  const [sortCards, setSortCards] = useState<string[]>([
    "Review 12 transactions",
    "Connect another account",
    "Categorize deductions",
    "Confirm tax calendar dates",
  ]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [scheduleCCategory, setScheduleCCategory] = useState("Advertising");
  const [deductionReason, setDeductionReason] = useState<"Home office" | "Client travel" | "Software tools">("Software tools");

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

  function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
  }

  async function pasteFromClipboard() {
    try {
      const t = await navigator.clipboard.readText();
      setPasteValue(t);
      showToast("Pasted from clipboard");
    } catch {
      showToast("Paste blocked by browser permissions");
    }
  }

  const series = useMemo(() => [4, 6, 5, 7, 10, 9, 12, 11, 14, 13, 16, 15], []);

  const chart = useMemo(() => {
    const w = 520;
    const h = 120;
    const pad = 12;
    const min = Math.min(...series);
    const max = Math.max(...series);
    const range = Math.max(1, max - min);
    const xs = series.map((_, i) => pad + (i * (w - pad * 2)) / (series.length - 1));
    const ys = series.map((v) => pad + (1 - (v - min) / range) * (h - pad * 2));
    const points = xs.map((x, i) => ({ x, y: ys[i], v: series[i] }));
    const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    return { w, h, pad, points, d, min, max };
  }, [series]);

  const cashflowRows = useMemo(
    () => [
      { week: "W1", income: 12.4, spend: 9.1 },
      { week: "W2", income: 10.2, spend: 10.9 },
      { week: "W3", income: 14.1, spend: 11.6 },
      { week: "W4", income: 13.2, spend: 12.2 },
      { week: "W5", income: 16.0, spend: 12.9 },
      { week: "W6", income: 15.3, spend: 13.8 },
    ],
    [],
  );

  const spark = useMemo(() => {
    const nets = cashflowRows.map((r) => r.income - r.spend);
    const min = Math.min(...nets);
    const max = Math.max(...nets);
    const range = Math.max(0.001, max - min);
    const pts = nets.map((v, i) => {
      const xPct = (i / Math.max(1, nets.length - 1)) * 100;
      const yPct = (1 - (v - min) / range) * 100;
      return { xPct, yPct, v };
    });
    const poly = [
      `0% 100%`,
      ...pts.map((p) => `${p.xPct.toFixed(2)}% ${p.yPct.toFixed(2)}%`),
      `100% 100%`,
    ].join(", ");

    function strokePolygon(points: { xPct: number; yPct: number }[], thicknessPct: number) {
      if (points.length < 2) return "";
      const left: { x: number; y: number }[] = [];
      const right: { x: number; y: number }[] = [];

      for (let i = 0; i < points.length; i++) {
        const prev = points[Math.max(0, i - 1)];
        const next = points[Math.min(points.length - 1, i + 1)];
        const dx = next.xPct - prev.xPct;
        const dy = next.yPct - prev.yPct;
        const len = Math.max(0.001, Math.hypot(dx, dy));
        const nx = (-dy / len) * thicknessPct;
        const ny = (dx / len) * thicknessPct;

        const p = points[i];
        left.push({ x: p.xPct + nx, y: p.yPct + ny });
        right.push({ x: p.xPct - nx, y: p.yPct - ny });
      }

      const all = [...left, ...right.reverse()];
      return all.map((p) => `${p.x.toFixed(2)}% ${p.y.toFixed(2)}%`).join(", ");
    }

    const strokePoly = strokePolygon(pts, 0.9);
    return { pts, poly, strokePoly, min, max };
  }, [cashflowRows]);

  function reorder(list: string[], from: number, to: number) {
    const copy = list.slice();
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
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
            <span className="kbd">Cmd</span>
            <span style={{ margin: "0 4px" }}>+</span>
            <span className="kbd">K</span>
            <span style={{ marginLeft: 2 }}>(future)</span>
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
        <div className="card" style={{ padding: 16 }}>
          <p className="sectionTitle">Banners</p>

          {!bannerDismissed ? (
            <div
              className={`banner ${bannerKind === "strong" ? "bannerStrong" : bannerKind === "danger" ? "bannerDanger" : ""}`}
            >
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 650, color: "var(--text)" }}>
                    Notion-style callout banner
                  </div>
                  <div>
                    {bannerKind === "danger"
                      ? "Destructive messaging: rare, specific, actionable."
                      : bannerKind === "strong"
                        ? "Primary informational banner with a single, clear CTA."
                        : "Neutral informational banner for calm guidance."}
                  </div>
                  <div className="row" style={{ marginTop: 6 }}>
                    <button className="btn btnPrimary" style={{ height: 34, padding: "0 12px" }} onClick={() => showToast("CTA clicked")}>
                      Take action <span className="kbd">Enter</span>
                    </button>
                    <button className="btn btnGhost" style={{ height: 34, padding: "0 12px" }} onClick={() => showToast("Secondary clicked")}>
                      Learn more
                    </button>
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
                  <button className="btn btnGhost" onClick={() => setBannerDismissed(true)}>
                    Dismiss <span className="kbd">Esc</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="banner">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  Banner dismissed. Banners should be skimmable, contextual, and easy to ignore.
                </div>
                <button className="btn btnGhost" onClick={() => setBannerDismissed(false)}>
                  Restore
                </button>
              </div>
            </div>
          )}
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
          <div className="card" style={{ marginTop: 12, padding: 12, background: "var(--surface)", boxShadow: "none", borderRadius: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 650, letterSpacing: "-0.01em", color: "var(--text)" }}>
              Usage guidance
            </div>
            <div style={{ marginTop: 8, display: "grid", gap: 6, color: "var(--muted)", fontSize: 13 }}>
              <div>
                <span className="badge">Accent</span>{" "}
                Primary actions only (one per surface). Avoid “accent everywhere”.
              </div>
              <div>
                <span className="badge">Surface</span>{" "}
                Use for grouped regions and subtle callouts; keep borders doing most of the separation.
              </div>
              <div>
                <span className="badge">Border</span>{" "}
                Primary divider. Prefer borders over shadows unless you need elevation.
              </div>
              <div>
                <span className="badge">Danger / Warning / Success</span>{" "}
                Semantic only. Never use for decoration.
              </div>
            </div>
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

        <div className="card" style={{ padding: 16 }}>
          <p className="sectionTitle">Tabs</p>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="tabs" role="tablist" aria-label="Example tabs">
              {(["Overview", "Inbox", "Settings"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={activeTab === t}
                  className={`tab ${activeTab === t ? "tabActive" : ""}`}
                  onClick={() => setActiveTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <span className="badge">
              Active: <span className="kbd">{activeTab}</span>
            </span>
          </div>
          <div className="card" style={{ marginTop: 12, padding: 12, background: "var(--surface)" }}>
            <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 650 }}>{activeTab}</div>
            <div style={{ marginTop: 6, color: "var(--muted)" }}>
              Tabs should be calm, obvious, and not fight page hierarchy.
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <p className="sectionTitle">Switch + Tooltip</p>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="row">
              <button
                className={`switch ${switchOn ? "switchOn" : ""}`}
                role="switch"
                aria-checked={switchOn}
                onClick={() => setSwitchOn((v) => !v)}
                aria-label="Example switch"
              >
                <span className="switchThumb" />
              </button>
              <span className="badge">{switchOn ? "On" : "Off"}</span>
            </div>

            <span
              className="tooltip"
              onMouseEnter={() => setTipOpen(true)}
              onMouseLeave={() => setTipOpen(false)}
              onFocus={() => setTipOpen(true)}
              onBlur={() => setTipOpen(false)}
              tabIndex={0}
            >
              <button className="btn btnGhost" onClick={() => showToast("Tooltip target clicked")}>
                Hover me <span className="kbd">?</span>
              </button>
              {tipOpen ? <span className="tooltipBubble">Tooltips explain, not decorate.</span> : null}
            </span>
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
                gridTemplateColumns: "120px 1fr 160px 140px 140px",
                columnGap: 18,
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
              <div>Label</div>
              <div style={{ textAlign: "right" }}>Amount</div>
              <div>Status</div>
            </div>
            {[
              { date: "Oct 15", merchant: "Notion", label: "Software", amount: "$10.00", status: "Needs review" },
              { date: "Oct 14", merchant: "Blue Bottle Coffee", label: "Meals", amount: "$8.75", status: "Auto-sorted" },
              { date: "Oct 12", merchant: "AWS", label: "Infrastructure", amount: "$42.13", status: "Auto-sorted" },
            ].map((r) => (
              <div
                key={r.date + r.merchant}
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 1fr 160px 140px 140px",
                  columnGap: 18,
                  padding: density === "compact" ? "8px 12px" : "11px 12px",
                  borderTop: "1px solid var(--border)",
                  alignItems: "center",
                  fontSize: 13,
                }}
              >
                <div style={{ color: "var(--muted)" }}>{r.date}</div>
                <div style={{ color: "var(--text)", fontWeight: 600 }}>{r.merchant}</div>
                <div>
                  <span className="badge">{r.label}</span>
                </div>
                <div style={{ textAlign: "right", fontFamily: "var(--mono)" }}>{r.amount}</div>
                <div>
                  <span className="badge">{r.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <p className="sectionTitle">Copy / Paste item</p>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 650, letterSpacing: "-0.01em" }}>Copy row</div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <input className="input" value={copyValue} onChange={(e) => setCopyValue(e.target.value)} />
                <button
                  className="btn btnPrimary"
                  onClick={async () => {
                    await copy(copyValue);
                    showToast("Copied");
                  }}
                >
                  Copy <span className="kbd">C</span>
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 650, letterSpacing: "-0.01em" }}>Paste row</div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <input className="input" value={pasteValue} onChange={(e) => setPasteValue(e.target.value)} placeholder="Paste here…" />
                <button className="btn" onClick={pasteFromClipboard}>
                  Paste <span className="kbd">V</span>
                </button>
              </div>
              <div style={{ fontSize: 12, color: "var(--faint)" }}>
                Note: paste may be blocked unless triggered by a user gesture and permitted by the browser.
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <p className="sectionTitle">Line graph (table with hover)</p>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 650, letterSpacing: "-0.01em", color: "var(--text)" }}>
                Cashflow trend
              </div>
              <div style={{ marginTop: 4, color: "var(--muted)" }}>
                Table-first: data is the UI; hover reveals the point.
              </div>
            </div>
            <span className="badge">
              Hover row: <span className="kbd">{graphHover === null ? "—" : cashflowRows[graphHover]?.week}</span>
            </span>
          </div>

          <div style={{ marginTop: 12 }}>
            <div
              className="card"
              style={{
                background: "var(--surface)",
                boxShadow: "none",
                borderRadius: 12,
                border: "1px solid var(--border)",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
                <div
                  className="card"
                  style={{
                    position: "relative",
                    height: 66,
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.30))",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    boxShadow: "none",
                    overflow: "hidden",
                  }}
                  aria-label="Line graph sparkline"
                >
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "repeating-linear-gradient(90deg, rgba(17,17,17,0.05) 0px, rgba(17,17,17,0.05) 1px, transparent 1px, transparent 52px), repeating-linear-gradient(180deg, rgba(17,17,17,0.05) 0px, rgba(17,17,17,0.05) 1px, transparent 1px, transparent 22px)",
                      opacity: 0.55,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(180deg, rgba(47,111,235,0.22), rgba(47,111,235,0.04))",
                      clipPath: `polygon(${spark.poly})`,
                    }}
                  />
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(47,111,235,0.92)",
                      clipPath: `polygon(${spark.strokePoly})`,
                    }}
                  />
                  {graphHover !== null ? (
                    <div
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: `${spark.pts[graphHover].xPct}%`,
                        width: 1,
                        background: "rgba(17,17,17,0.12)",
                      }}
                    />
                  ) : null}

                  {spark.pts.map((p, i) => {
                    const active = graphHover === i;
                    return (
                      <div
                        key={i}
                        style={{
                          position: "absolute",
                          left: `calc(${p.xPct}% - 4px)`,
                          top: `calc(${p.yPct}% - 4px)`,
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: active ? "rgba(47,111,235,0.95)" : "rgba(17,17,17,0.22)",
                          boxShadow: active ? "0 0 0 3px rgba(47,111,235,0.18)" : "none",
                          border: "2px solid rgba(255,255,255,0.92)",
                        }}
                        aria-hidden="true"
                      />
                    );
                  })}
                  {graphHover !== null ? (
                    <div
                      style={{
                        position: "absolute",
                        left: `${spark.pts[graphHover].xPct}%`,
                        top: `${spark.pts[graphHover].yPct}%`,
                        transform: "translate(-50%, -120%)",
                        padding: "7px 10px",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        background: "rgba(255,255,255,0.92)",
                        boxShadow: "var(--shadow-sm)",
                        backdropFilter: "blur(10px)",
                        color: "var(--text)",
                        fontSize: 12,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>{cashflowRows[graphHover].week}</span>{" "}
                      net{" "}
                      <span style={{ fontFamily: "var(--mono)" }}>
                        {(cashflowRows[graphHover].income - cashflowRows[graphHover].spend).toFixed(1)}k
                      </span>
                    </div>
                  ) : null}
                  <div
                    style={{
                      position: "absolute",
                      left: 10,
                      bottom: 8,
                      fontSize: 12,
                      color: "var(--muted)",
                    }}
                  >
                    Net range <span className="kbd">{spark.min.toFixed(1)}k</span>–<span className="kbd">{spark.max.toFixed(1)}k</span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "70px 1fr 1fr 1fr",
                  columnGap: 18,
                  background: "rgba(255,255,255,0.32)",
                  padding: density === "compact" ? "8px 12px" : "10px 12px",
                  fontSize: 12,
                  color: "var(--faint)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div>Week</div>
                <div style={{ textAlign: "right" }}>Income</div>
                <div style={{ textAlign: "right" }}>Spend</div>
                <div style={{ textAlign: "right" }}>Net</div>
              </div>

              {cashflowRows.map((r, i) => {
                const net = r.income - r.spend;
                const hovered = graphHover === i;
                return (
                  <div
                    key={r.week}
                    onMouseEnter={() => setGraphHover(i)}
                    onMouseLeave={() => setGraphHover(null)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "70px 1fr 1fr 1fr",
                      columnGap: 18,
                      padding: density === "compact" ? "8px 12px" : "11px 12px",
                      borderTop: "1px solid var(--border)",
                      alignItems: "center",
                      fontSize: 13,
                      background: hovered ? "rgba(47,111,235,0.08)" : "transparent",
                      cursor: "default",
                    }}
                  >
                    <div style={{ color: "var(--muted)" }}>{r.week}</div>
                    <div style={{ textAlign: "right", fontFamily: "var(--mono)" }}>${r.income.toFixed(1)}k</div>
                    <div style={{ textAlign: "right", fontFamily: "var(--mono)" }}>${r.spend.toFixed(1)}k</div>
                    <div style={{ textAlign: "right", fontFamily: "var(--mono)", color: net >= 0 ? "var(--text)" : "var(--danger)" }}>
                      {net >= 0 ? "+" : "−"}${Math.abs(net).toFixed(1)}k
                    </div>
                  </div>
                );
              })}

              <div style={{ padding: density === "compact" ? "8px 12px" : "10px 12px" }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    Hover a row for detail. Keep charts legible, but keep the table authoritative.
                  </div>
                  {graphHover !== null ? (
                    <span className="badge">
                      {cashflowRows[graphHover].week} net{" "}
                      <span className="kbd">
                        {(cashflowRows[graphHover].income - cashflowRows[graphHover].spend).toFixed(1)}k
                      </span>
                    </span>
                  ) : (
                    <span className="badge">
                      Dataset <span className="kbd">6 rows</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <p className="sectionTitle">Card sort</p>
          <div className="p" style={{ marginBottom: 10 }}>
            Drag to reorder. This is intentionally “low ceremony” (no animations, no libraries) for the kit.
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {sortCards.map((t, i) => (
              <div key={t} style={{ display: "grid", gap: 8 }}>
                {dropIndex === i ? (
                  <div
                    aria-hidden="true"
                    style={{
                      height: 4,
                      background: "rgba(47,111,235,0.75)",
                      borderRadius: 999,
                      borderRadius: 999,
                      boxShadow: "0 0 0 3px rgba(47,111,235,0.10)",
                    }}
                  />
                ) : null}
                <div
                  className="card"
                  draggable
                  onDragStart={() => {
                    setDragIndex(i);
                    setDropIndex(i);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDropIndex(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropIndex(i);
                  }}
                  onDrop={() => {
                    if (dragIndex === null) return;
                    setSortCards((prev) => reorder(prev, dragIndex, i));
                    setDragIndex(null);
                    setDropIndex(null);
                    showToast("Reordered");
                  }}
                  style={{
                    padding: 12,
                    background: dragIndex === i ? "rgba(17,17,17,0.02)" : "var(--bg)",
                    boxShadow: "none",
                    borderRadius: 12,
                  }}
                >
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 500, letterSpacing: "-0.01em", color: "var(--text)" }}>{t}</div>
                    <span className="kbd">Drag</span>
                  </div>
                </div>
              </div>
            ))}
            {dropIndex === sortCards.length ? (
              <div
                aria-hidden="true"
                style={{
                  height: 4,
                  background: "rgba(47,111,235,0.75)",
                  borderRadius: 999,
                  boxShadow: "0 0 0 3px rgba(47,111,235,0.10)",
                }}
              />
            ) : null}
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <p className="sectionTitle">Index cards (data items)</p>
          <div className="p" style={{ marginBottom: 12 }}>
            “Index card” items: data at the top, actions at the bottom. Designed for stacks, boards, and lists.
          </div>

          <div className="card" style={{ padding: 12, boxShadow: "none", borderRadius: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 650, letterSpacing: "-0.01em", color: "var(--text)" }}>
                  Stripe payout
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>Oct 15 · 2 items · Needs review</div>
              </div>
              <span className="badge">Confidence <span className="kbd">0.92</span></span>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="badge">
                  Schedule C <span className="kbd">{scheduleCCategory}</span>
                </span>
                <button
                  className="btn btnGhost"
                  style={{ height: 30, padding: "0 10px" }}
                  onClick={() =>
                    setScheduleCCategory((c) =>
                      c === "Advertising" ? "Office expense" : c === "Office expense" ? "Software" : "Advertising",
                    )
                  }
                >
                  Change <span className="kbd">C</span>
                </button>
              </div>

              <div style={{ padding: 10, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 12, color: "var(--faint)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                  Amount
                </div>
                <div style={{ marginTop: 6, fontFamily: "var(--mono)", fontSize: 18, color: "var(--text)" }}>$4,210.00</div>
                <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
                  <span className="badge">Deductions</span>
                  <button className="btn btnGhost" style={{ height: 30, padding: "0 10px" }} onClick={() => showToast("Review other items")}>
                    Review other <span className="kbd">R</span>
                  </button>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "var(--faint)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                  Potential deduction reasons
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  {(["Home office", "Client travel", "Software tools"] as const).map((r) => (
                    <button
                      key={r}
                      className={`btn ${deductionReason === r ? "" : "btnGhost"}`}
                      style={{ height: 34, padding: "0 12px" }}
                      onClick={() => setDeductionReason(r)}
                    >
                      {r} {deductionReason === r ? <span className="kbd">Selected</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
              <button className="btn btnGhost" style={{ height: 34, padding: "0 12px" }} onClick={() => showToast("Open")}>
                Open <span className="kbd">O</span>
              </button>
              <div className="row">
                <button className="btn" style={{ height: 34, padding: "0 12px" }} onClick={() => showToast("Approved all like this")}>
                  Approve all like this <span className="kbd">A</span>
                </button>
                <button className="btn btnPrimary" style={{ height: 34, padding: "0 12px" }} onClick={() => showToast("Approved this one")}>
                  Approve this <span className="kbd">Enter</span>
                </button>
                <button className="btn btnGhost" style={{ height: 34, padding: "0 12px" }} onClick={() => showToast("Marked personal")}>
                  Mark personal <span className="kbd">P</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <p className="sectionTitle">View</p>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="tabs" role="tablist" aria-label="View selector">
              {(["Table", "Board"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={viewMode === t}
                  className={`tab ${viewMode === t ? "tabActive" : ""}`}
                  onClick={() => setViewMode(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <span className="badge">
              View: <span className="kbd">{viewMode}</span>
            </span>
          </div>

          <div className="card" style={{ marginTop: 12, padding: 12, background: "var(--surface)", boxShadow: "none", borderRadius: 12 }}>
            {viewMode === "Table" ? (
              <div
                className="card"
                style={{
                  borderRadius: 12,
                  overflow: "hidden",
                  boxShadow: "none",
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px 1fr 160px 140px 140px",
                    columnGap: 18,
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
                  <div>Label</div>
                  <div style={{ textAlign: "right" }}>Amount</div>
                  <div>Status</div>
                </div>
                {[
                  { date: "Oct 15", merchant: "Notion", label: "Software", amount: "$10.00", status: "Needs review" },
                  { date: "Oct 14", merchant: "Blue Bottle Coffee", label: "Meals", amount: "$8.75", status: "Auto-sorted" },
                  { date: "Oct 12", merchant: "AWS", label: "Infrastructure", amount: "$42.13", status: "Auto-sorted" },
                ].map((r) => (
                  <div
                    key={"view-" + r.date + r.merchant}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "120px 1fr 160px 140px 140px",
                      columnGap: 18,
                      padding: density === "compact" ? "8px 12px" : "11px 12px",
                      borderTop: "1px solid var(--border)",
                      alignItems: "center",
                      fontSize: 13,
                    }}
                  >
                    <div style={{ color: "var(--muted)" }}>{r.date}</div>
                    <div style={{ color: "var(--text)", fontWeight: 600 }}>{r.merchant}</div>
                    <div>
                      <span className="badge">{r.label}</span>
                    </div>
                    <div style={{ textAlign: "right", fontFamily: "var(--mono)" }}>{r.amount}</div>
                    <div>
                      <span className="badge">{r.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {["Needs review", "Auto-sorted", "Flagged"].map((col) => (
                  <div key={col} className="card" style={{ padding: 10, background: "var(--bg)", boxShadow: "none", borderRadius: 12 }}>
                    <div style={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--faint)" }}>
                      {col}
                    </div>
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {["Notion — $10", "AWS — $42", "Coffee — $8"].map((x) => (
                        <div key={x} className="card" style={{ padding: 10, boxShadow: "none", borderRadius: 12 }}>
                          <div style={{ fontWeight: 650, letterSpacing: "-0.01em" }}>{x}</div>
                          <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>Drag between columns in the product.</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
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

        <div className="card" style={{ padding: 16 }}>
          <p className="sectionTitle">Billing panel</p>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="h2">Pro</div>
              <p className="p" style={{ marginTop: 6, maxWidth: 520 }}>
                Minimal billing summary: plan, next charge, payment method, and one primary action.
              </p>
              <div className="row" style={{ marginTop: 12 }}>
                <span className="badge">
                  Next bill <span className="kbd">May 15</span>
                </span>
                <span className="badge">
                  Amount <span className="kbd">$18.00</span>
                </span>
                <span className="badge">
                  Card <span className="kbd">•••• 4242</span>
                </span>
              </div>
            </div>
            <div style={{ display: "grid", gap: 10, justifyItems: "end" }}>
              <button className="btn btnPrimary" onClick={() => showToast("Manage billing")}>
                Manage billing
              </button>
              <button className="btn btnGhost" onClick={() => showToast("View invoices")}>
                View invoices
              </button>
            </div>
          </div>
          <div className="card" style={{ marginTop: 14, padding: 12, background: "var(--surface)", boxShadow: "none", borderRadius: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div style={{ fontSize: 13, fontWeight: 650, letterSpacing: "-0.01em" }}>Usage</div>
              <span className="badge">
                Period <span className="kbd">Apr</span>
              </span>
            </div>
            <div style={{ marginTop: 10, height: 10, borderRadius: 999, background: "rgba(17,17,17,0.08)", overflow: "hidden" }}>
              <div
                style={{
                  width: "62%",
                  height: "100%",
                  background: "linear-gradient(90deg, rgba(47,111,235,0.85) 0%, rgba(31,122,74,0.78) 55%, rgba(138,106,0,0.78) 100%)",
                }}
              />
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
              62% of monthly transaction imports used.
            </div>
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

