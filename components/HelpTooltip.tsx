"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { IInfo } from "@/components/ui/icons";

interface HelpTooltipProps {
  text: string;
  label?: string;
}

export function HelpTooltip({ text, label = "More information" }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  const updatePosition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const maxWidth = 260;
    const width = Math.min(maxWidth, window.innerWidth - 16);
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));

    const belowTop = rect.bottom + 6;
    const spaceBelow = window.innerHeight - belowTop;
    if (spaceBelow >= 72) {
      setStyle({ position: "fixed", top: belowTop, left, width, zIndex: 9999 });
      return;
    }
    setStyle({
      position: "fixed",
      top: rect.top - 6,
      left,
      width,
      zIndex: 9999,
      transform: "translateY(-100%)",
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  const popup =
    open &&
    style &&
    typeof document !== "undefined"
      ? createPortal(
          <span id={id} role="tooltip" className="help-tip__popup help-tip__popup--fixed" style={style}>
            {text}
          </span>,
          document.body,
        )
      : null;

  return (
    <span
      className={`help-tip${open ? " is-open" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={btnRef}
        type="button"
        className="help-tip__btn"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
      >
        <IInfo size={13} />
      </button>
      {popup}
    </span>
  );
}
