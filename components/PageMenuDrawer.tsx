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
    "w-full flex items-center gap-2.5 px-3 py-2 text-left text-[13px] text-mono-dark hover:bg-bg-secondary/80 transition-colors border-0 bg-white";

  const toggleRowClass = `${rowClass} group/toggle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sovereign-blue/30 focus-visible:ring-offset-1 focus-visible:ring-offset-white`;

  const panel = (
    <div
      ref={panelRef}
      className="fixed z-[200] flex w-[248px] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-none border border-bg-tertiary/60 bg-white shadow-lg"
      style={{ top: pos.top, right: pos.right }}
      role="dialog"
      aria-modal="false"
      aria-label="Page menu"
    >
      <div className="flex items-center justify-between border-b border-bg-tertiary/40 px-2.5 py-1.5">
        <span className="text-[12px] font-semibold text-mono-medium">Page options</span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-none text-mono-light hover:bg-bg-tertiary/40 hover:text-mono-dark"
          aria-label="Close"
        >
          <span className="material-symbols-rounded text-[16px] leading-none">close</span>
        </button>
      </div>
      <nav className="flex flex-col py-1">
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
        <div className="mx-2.5 my-1 border-t border-bg-tertiary/50" />
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
