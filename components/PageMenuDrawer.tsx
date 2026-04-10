"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

const GAP_PX = 6;

const MENU_ICON_PX = 16;
const menuIconStyle = {
  fontSize: MENU_ICON_PX,
  lineHeight: 1,
  fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
} as const;

/** Mini switch: thumb 14px, track 34×20, 2px inset on — off matches on for top/left/right gap */
const SWITCH_TRACK_W = 34;
const SWITCH_THUMB = 14;
const SWITCH_INSET = 2;
const SWITCH_SLIDE_X = SWITCH_TRACK_W - SWITCH_INSET * 2 - SWITCH_THUMB;

export function PageMenuDrawer({
  open,
  anchorRef,
  onClose,
  fullWidth,
  onToggleFullWidth,
  onCopyLink,
  onDuplicate,
  onMoveToTrash,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  fullWidth: boolean;
  onToggleFullWidth: () => void;
  onCopyLink: () => void;
  onDuplicate: () => void;
  onMoveToTrash: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    // Align panel’s right edge with the trigger’s right edge; stay ≥8px from viewport edge
    const right = Math.max(8, vw - rect.right);
    setPos({ top: rect.bottom + GAP_PX, right });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !mounted) return null;

  const rowClass =
    "w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left font-sans text-[13px] text-neutral-800 hover:bg-neutral-100/80 transition-colors border-0 bg-transparent";

  const toggleRowClass = `${rowClass} group/toggle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sovereign-blue/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white`;

  const panel = (
    <div
      ref={panelRef}
      className="fixed z-[200] flex w-[260px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white/95 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)] backdrop-blur-md"
      style={{ top: pos.top, right: pos.right }}
      role="dialog"
      aria-modal="false"
      aria-labelledby="page-menu-drawer-title"
      aria-describedby="page-menu-drawer-desc"
    >
      <div className="shrink-0 border-b border-black/[0.06] px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 pr-1">
            <p className="font-sans text-[11px] font-medium uppercase tracking-wider text-neutral-400">Page</p>
            <h2
              id="page-menu-drawer-title"
              className="mt-1 font-sans text-[15px] font-semibold leading-tight tracking-tight text-neutral-900"
            >
              Options
            </h2>
            <p
              id="page-menu-drawer-desc"
              className="mt-0.5 font-sans text-[12px] leading-snug text-neutral-500"
            >
              Share, duplicate, layout, and more
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close"
          >
            <span className="material-symbols-rounded text-[18px] leading-none">close</span>
          </button>
        </div>
      </div>
      <nav className="flex flex-col gap-1 p-2">
        <button type="button" className={rowClass} onClick={() => { onCopyLink(); onClose(); }}>
          <span className="material-symbols-rounded shrink-0 text-mono-medium leading-none" style={menuIconStyle}>
            link
          </span>
          Copy link
        </button>
        <button type="button" className={rowClass} onClick={() => { onDuplicate(); onClose(); }}>
          <span className="material-symbols-rounded shrink-0 text-mono-medium leading-none" style={menuIconStyle}>
            content_copy
          </span>
          Duplicate
        </button>
        <button type="button" className={rowClass} onClick={() => { onMoveToTrash(); onClose(); }}>
          <span className="material-symbols-rounded shrink-0 text-mono-medium leading-none" style={menuIconStyle}>
            delete
          </span>
          Move to trash
        </button>
        <div className="my-1 border-t border-black/[0.06]" />
        <button
          type="button"
          role="switch"
          aria-checked={fullWidth}
          className={toggleRowClass}
          onClick={onToggleFullWidth}
        >
          <span
            className={`material-symbols-rounded shrink-0 leading-none transition-colors ${
              fullWidth ? "text-sovereign-blue" : "text-mono-medium group-hover/toggle:text-mono-dark"
            }`}
            style={menuIconStyle}
          >
            open_in_full
          </span>
          <span className="min-w-0 flex-1 font-medium">Full width</span>
          <span
            className={`relative isolate h-5 shrink-0 overflow-hidden rounded-full border backdrop-blur-md backdrop-saturate-150 transition-[background,box-shadow,border-color] duration-200 ease-out ${
              fullWidth
                ? "border-sovereign-blue/50 bg-gradient-to-b from-sovereign-blue/50 via-sovereign-blue/65 to-[#4a6d9e]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.12),0_1px_5px_rgba(59,99,140,0.22)]"
                : "border-slate-400/40 bg-gradient-to-b from-white/75 via-slate-100/55 to-slate-300/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(0,0,0,0.06),0_1px_4px_rgba(0,0,0,0.06)]"
            }`}
            style={{ width: SWITCH_TRACK_W }}
            aria-hidden
          >
            <span
              className="pointer-events-none absolute top-1/2 block overflow-hidden rounded-full border border-white/95 bg-gradient-to-b from-white to-white/88 shadow-[0_2px_8px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,1)] backdrop-blur-sm transition-transform duration-200 ease-out"
              style={{
                left: SWITCH_INSET,
                width: SWITCH_THUMB,
                height: SWITCH_THUMB,
                transform: fullWidth
                  ? `translate(${SWITCH_SLIDE_X}px, -50%)`
                  : "translate(0, -50%)",
              }}
            />
          </span>
        </button>
      </nav>
    </div>
  );

  return createPortal(panel, document.body);
}
