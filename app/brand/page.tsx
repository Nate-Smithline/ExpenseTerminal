"use client";

import { useCallback, useEffect, useId, useState } from "react";

/** Canonical palette for this playground (matches product direction). */
const palette = [
  { name: "Red", rgb: "rgb(255, 56, 60)" },
  { name: "Orange", rgb: "rgb(255, 141, 40)" },
  { name: "Yellow", rgb: "rgb(255, 204, 0)" },
  { name: "Green", rgb: "rgb(52, 199, 89)" },
  { name: "Cyan", rgb: "rgb(0, 192, 232)" },
  { name: "Blue", rgb: "rgb(0, 136, 255)" },
  { name: "Indigo", rgb: "rgb(97, 85, 245)" },
  { name: "Purple", rgb: "rgb(203, 48, 224)" },
  { name: "Pink", rgb: "rgb(172, 127, 94)" },
  { name: "Black", rgb: "rgb(0, 0, 0)" },
  { name: "White", rgb: "rgb(255, 255, 255)" },
  { name: "Light grey", rgb: "rgb(242, 242, 247)" },
  { name: "Medium grey", rgb: "rgb(209, 209, 214)" },
  { name: "Dark gray", rgb: "rgb(142, 142, 147)" },
] as const;

const blue = "rgb(0, 136, 255)";
const green = "rgb(52, 199, 89)";
const red = "rgb(255, 56, 60)";
const orange = "rgb(255, 141, 40)";
const lightGrey = "rgb(242, 242, 247)";
const mediumGrey = "rgb(209, 209, 214)";
const darkGray = "rgb(142, 142, 147)";
const white = "rgb(255, 255, 255)";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-3"
      style={{ color: darkGray }}
    >
      {children}
    </p>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-[20px] bg-white px-6 py-8 shadow-[0_2px_24px_rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.04)] ${className}`}
    >
      {children}
    </section>
  );
}

function ColorSwatch({ name, rgb }: { name: string; rgb: string }) {
  const [copied, setCopied] = useState(false);
  const light =
    name === "White" || name === "Light grey" || name === "Yellow" || name === "Medium grey";
  const copy = () => {
    void navigator.clipboard?.writeText(rgb);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="group text-left w-full rounded-[14px] overflow-hidden border border-black/[0.06] transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(0,136,255)]"
    >
      <div
        className="h-[72px] w-full flex items-end justify-end px-2.5 py-2 relative"
        style={{
          background: rgb,
          boxShadow: name === "White" ? `inset 0 0 0 1px ${mediumGrey}` : undefined,
        }}
      >
        <span
          className="text-[9px] font-semibold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: light ? darkGray : "rgba(255,255,255,0.75)" }}
        >
          {copied ? "Copied" : "Copy"}
        </span>
      </div>
      <div className="px-3 py-2.5 bg-white">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-semibold text-black tracking-tight">{name}</span>
          <span className="text-[11px] tabular-nums shrink-0" style={{ color: darkGray }}>
            {rgb.replace(/\s/g, "")}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function BrandPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [segment, setSegment] = useState<"month" | "quarter" | "year">("quarter");
  const [toggleOn, setToggleOn] = useState(true);
  const dialogTitleId = useId();

  const closeModal = useCallback(() => setModalOpen(false), []);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [modalOpen, closeModal]);

  return (
    <div className="pb-20" style={{ background: lightGrey }}>
      <div className="max-w-[1040px] mx-auto px-5 sm:px-8 pt-12 sm:pt-16 space-y-10">
        {/* Intro — not an app chrome header; in-page title only */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/80 backdrop-blur-sm px-3 py-1.5 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: blue }} aria-hidden />
            <span className="text-[12px] font-medium" style={{ color: darkGray }}>
              Localhost · Satoshi only
            </span>
          </div>
          <h1 className="text-[34px] sm:text-[42px] font-semibold tracking-[-0.035em] text-black leading-[1.08]">
            Brand &amp; UI kit
          </h1>
          <p className="text-[15px] leading-relaxed max-w-[52ch]" style={{ color: darkGray }}>
            Lightweight SaaS primitives inspired by Apple’s clarity: calm surfaces, confident type,
            and interactions that feel immediate without noise.
          </p>
        </div>

        <Panel>
          <SectionLabel>Palette</SectionLabel>
          <h2 className="text-[22px] font-semibold tracking-tight text-black mb-6">Color</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {palette.map((c) => (
              <ColorSwatch key={c.name} {...c} />
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionLabel>Typography</SectionLabel>
          <h2 className="text-[22px] font-semibold tracking-tight text-black mb-6">Text</h2>
          <div className="space-y-8">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: darkGray }}>
                Large title
              </p>
              <p className="text-[28px] font-semibold tracking-tight text-black">Quarterly estimate</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: darkGray }}>
                Title 2
              </p>
              <p className="text-[20px] font-semibold tracking-tight text-black">Connected accounts</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: darkGray }}>
                Body
              </p>
              <p className="text-[15px] leading-[1.5] text-black max-w-prose">
                Review uncategorized transactions so your books stay audit-ready. We keep the math
                behind the scenes and the interface in plain language.
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: darkGray }}>
                Caption &amp; footnote
              </p>
              <p className="text-[13px] leading-snug" style={{ color: darkGray }}>
                Last synced 2 minutes ago · Encrypted in transit and at rest.
              </p>
            </div>
          </div>
        </Panel>

        <Panel>
          <SectionLabel>Actions</SectionLabel>
          <h2 className="text-[22px] font-semibold tracking-tight text-black mb-6">Buttons</h2>
          <div className="flex flex-wrap gap-3 items-center">
            <button
              type="button"
              className="h-11 px-5 rounded-full text-[15px] font-semibold text-white shadow-sm transition-[transform,box-shadow] duration-200 hover:shadow-md active:scale-[0.98]"
              style={{ background: blue }}
            >
              Continue
            </button>
            <button
              type="button"
              className="h-11 px-5 rounded-full text-[15px] font-semibold border transition-colors duration-200 active:scale-[0.98]"
              style={{
                background: white,
                borderColor: mediumGrey,
                color: "rgb(0, 0, 0)",
              }}
            >
              Not now
            </button>
            <button
              type="button"
              className="h-11 px-5 rounded-full text-[15px] font-semibold text-white transition-opacity duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{ background: green }}
            >
              Save
            </button>
            <button
              type="button"
              className="h-11 px-5 rounded-full text-[15px] font-semibold text-white transition-opacity duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{ background: red }}
            >
              Remove
            </button>
            <button
              type="button"
              className="h-11 px-4 rounded-full text-[15px] font-semibold transition-opacity duration-200 hover:opacity-70 active:scale-[0.98]"
              style={{ color: blue }}
            >
              Learn more
            </button>
          </div>
        </Panel>

        <Panel>
          <SectionLabel>Metadata</SectionLabel>
          <h2 className="text-[22px] font-semibold tracking-tight text-black mb-6">Pills &amp; chips</h2>
          <div className="flex flex-wrap gap-2 items-center">
            <span
              className="inline-flex items-center h-8 px-3 rounded-full text-[12px] font-semibold"
              style={{ background: lightGrey, color: darkGray }}
            >
              Draft
            </span>
            <span
              className="inline-flex items-center h-8 px-3 rounded-full text-[12px] font-semibold text-white"
              style={{ background: blue }}
            >
              Active
            </span>
            <span
              className="inline-flex items-center h-8 px-3 rounded-full text-[12px] font-semibold text-white"
              style={{ background: green }}
            >
              Synced
            </span>
            <span
              className="inline-flex items-center h-8 px-3 rounded-full text-[12px] font-semibold border"
              style={{ borderColor: mediumGrey, color: darkGray, background: white }}
            >
              Needs review
            </span>
            <span
              className="inline-flex items-center gap-1.5 h-8 pl-2 pr-3 rounded-full text-[12px] font-semibold border"
              style={{ borderColor: mediumGrey, background: white }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: orange }} aria-hidden />
              Pending
            </span>
          </div>
        </Panel>

        <Panel>
          <SectionLabel>Feedback</SectionLabel>
          <h2 className="text-[22px] font-semibold tracking-tight text-black mb-6">Banners</h2>
          <div className="space-y-3">
            <div
              className="rounded-[14px] px-4 py-3.5 border border-black/[0.06] bg-white border-l-[3px]"
              style={{ borderLeftColor: "rgba(0, 136, 255, 0.28)" }}
            >
              <p className="text-[14px] font-semibold text-black">Bank link expiring</p>
              <p className="text-[13px] mt-0.5" style={{ color: darkGray }}>
                Reconnect before April 30 to avoid gaps in your activity feed.
              </p>
            </div>
            <div
              className="rounded-[14px] px-4 py-3.5 border border-black/[0.06] bg-white border-l-[3px]"
              style={{ borderLeftColor: "rgba(52, 199, 89, 0.28)" }}
            >
              <p className="text-[14px] font-semibold text-black">Rules applied</p>
              <p className="text-[13px] mt-0.5" style={{ color: darkGray }}>
                14 transactions matched your “Software” category this week.
              </p>
            </div>
            <div
              className="rounded-[14px] px-4 py-3.5 border border-black/[0.06] bg-white border-l-[3px]"
              style={{ borderLeftColor: "rgba(255, 141, 40, 0.3)" }}
            >
              <p className="text-[14px] font-semibold text-black">Review suggested</p>
              <p className="text-[13px] mt-0.5" style={{ color: darkGray }}>
                One amount looks unusual compared to your usual vendors.
              </p>
            </div>
            <div
              className="rounded-[14px] px-4 py-3.5 border border-black/[0.06] bg-white border-l-[3px]"
              style={{ borderLeftColor: "rgba(255, 56, 60, 0.26)" }}
            >
              <p className="text-[14px] font-semibold text-black">Couldn’t save</p>
              <p className="text-[13px] mt-0.5" style={{ color: darkGray }}>
                Check your connection and try again. Nothing was changed.
              </p>
            </div>
          </div>
        </Panel>

        <Panel>
          <SectionLabel>Surfaces</SectionLabel>
          <h2 className="text-[22px] font-semibold tracking-tight text-black mb-6">Cards</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div
              className="rounded-[16px] p-5 border transition-shadow duration-200 hover:shadow-[0_8px_28px_rgba(0,0,0,0.08)]"
              style={{ background: white, borderColor: "rgba(0,0,0,0.06)" }}
            >
              <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: darkGray }}>
                This month
              </p>
              <p className="text-[26px] font-semibold tracking-tight mt-1 text-black tabular-nums">$12,480</p>
              <p className="text-[13px] mt-2" style={{ color: darkGray }}>
                Inflows after fees
              </p>
            </div>
            <div
              className="rounded-[16px] p-5 border text-white transition-shadow duration-200 hover:shadow-[0_8px_28px_rgba(0,0,0,0.2)]"
              style={{ background: "rgb(0, 0, 0)", borderColor: "rgba(255,255,255,0.12)" }}
            >
              <p className="text-[12px] font-semibold uppercase tracking-wide text-white/60">Est. tax</p>
              <p className="text-[26px] font-semibold tracking-tight mt-1 tabular-nums">$3,210</p>
              <p className="text-[13px] mt-2 text-white/55">Based on your bracket and YTD profit</p>
            </div>
          </div>
        </Panel>

        <Panel>
          <SectionLabel>Overlay</SectionLabel>
          <h2 className="text-[22px] font-semibold tracking-tight text-black mb-6">Modal</h2>
          <p className="text-[14px] mb-4" style={{ color: darkGray }}>
            Centered sheet with blur scrim. Escape closes; focus stays in-dialog when open.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="h-11 px-5 rounded-full text-[15px] font-semibold text-white shadow-sm transition-[transform,box-shadow] duration-200 hover:shadow-md active:scale-[0.98]"
            style={{ background: blue }}
          >
            Open sample dialog
          </button>
        </Panel>

        <Panel>
          <SectionLabel>Forms</SectionLabel>
          <h2 className="text-[22px] font-semibold tracking-tight text-black mb-6">Fields</h2>
          <div className="space-y-5 max-w-md">
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: darkGray }} htmlFor="brand-q">
                Search
              </label>
              <input
                id="brand-q"
                type="search"
                placeholder="Merchants, amounts, notes"
                className="w-full h-11 px-4 rounded-[12px] text-[15px] border outline-none transition-[box-shadow,border-color] placeholder:text-black/35 focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_rgb(0,136,255)]"
                style={{
                  borderColor: mediumGrey,
                  background: white,
                  color: "black",
                  boxShadow: "inset 0 1px 1px rgba(0,0,0,0.04)",
                }}
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: darkGray }} htmlFor="brand-note">
                Note
              </label>
              <textarea
                id="brand-note"
                rows={3}
                placeholder="Optional context for your accountant"
                className="w-full px-4 py-3 rounded-[12px] text-[15px] border outline-none resize-none transition-[box-shadow,border-color] placeholder:text-black/35 focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_rgb(0,136,255)]"
                style={{
                  borderColor: mediumGrey,
                  background: white,
                  color: "black",
                }}
              />
            </div>
          </div>
        </Panel>

        <Panel>
          <SectionLabel>Controls</SectionLabel>
          <h2 className="text-[22px] font-semibold tracking-tight text-black mb-6">Segmented &amp; toggle</h2>
          <div className="space-y-8">
            <div>
              <p className="text-[12px] font-medium mb-2" style={{ color: darkGray }}>
                Period
              </p>
              <div
                className="inline-flex p-1 rounded-[12px] gap-0.5"
                style={{ background: lightGrey }}
                role="tablist"
                aria-label="Period"
              >
                {(
                  [
                    { id: "month" as const, label: "Month" },
                    { id: "quarter" as const, label: "Quarter" },
                    { id: "year" as const, label: "Year" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={segment === t.id}
                    onClick={() => setSegment(t.id)}
                    className="relative h-9 px-4 rounded-[10px] text-[13px] font-semibold transition-colors duration-200 min-w-[4.5rem]"
                    style={{
                      color: segment === t.id ? "black" : darkGray,
                      background: segment === t.id ? white : "transparent",
                      boxShadow: segment === t.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={toggleOn}
                onClick={() => setToggleOn((v) => !v)}
                className="relative h-[31px] w-[51px] rounded-full transition-colors duration-200 shrink-0"
                style={{ background: toggleOn ? green : mediumGrey }}
              >
                <span
                  className="absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-sm transition-transform duration-200"
                  style={{ transform: toggleOn ? "translateX(20px)" : "translateX(0)" }}
                />
              </button>
              <div>
                <p className="text-[14px] font-semibold text-black">Smart reminders</p>
                <p className="text-[13px]" style={{ color: darkGray }}>
                  Nudges before quarterly deadlines
                </p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 sm:p-6"
          role="presentation"
        >
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-black/35 backdrop-blur-[6px] cursor-default"
            onClick={closeModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="relative w-full max-w-[400px] rounded-[20px] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)] border border-black/[0.06]"
            style={{ background: white }}
          >
            <h3 id={dialogTitleId} className="text-[19px] font-semibold tracking-tight text-black pr-8">
              Disconnect account?
            </h3>
            <p className="text-[14px] mt-2 leading-relaxed" style={{ color: darkGray }}>
              Historical transactions stay in your workspace; new imports will stop until you reconnect.
            </p>
            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="h-11 px-4 rounded-full text-[15px] font-semibold border transition-colors active:scale-[0.98]"
                style={{ borderColor: mediumGrey, background: white, color: "black" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="h-11 px-4 rounded-full text-[15px] font-semibold text-white active:scale-[0.98]"
                style={{ background: red }}
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
