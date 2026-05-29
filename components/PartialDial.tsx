"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface PartialDialProps {
  value: number; // 0–100, business percentage
  onChange: (value: number) => void;
  compact?: boolean;
  disabled?: boolean;
}

const SNAP_POINTS = [0, 25, 50, 75, 100];
const SNAP_THRESHOLD = 7; // px within this range → snap

function snap(pct: number): number {
  for (const s of SNAP_POINTS) {
    if (Math.abs(pct - s) <= SNAP_THRESHOLD) return s;
  }
  return pct;
}

function stateLabel(pct: number): string {
  if (pct === 0) return "Personal";
  if (pct === 100) return "Business";
  return "Partial";
}

function stateClass(pct: number): string {
  if (pct === 0) return "dial__state--personal";
  if (pct === 100) return "dial__state--business";
  return "dial__state--partial";
}

export function PartialDial({ value, onChange, compact = false, disabled = false }: PartialDialProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  const pctFromEvent = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return valueRef.current;
    const rect = track.getBoundingClientRect();
    const raw = Math.round(((clientX - rect.left) / rect.width) * 100);
    const clamped = Math.max(0, Math.min(100, raw));
    return snap(clamped);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    setDragging(true);
    const pct = pctFromEvent(e.clientX);
    onChange(pct);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [disabled, pctFromEvent, onChange]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || disabled) return;
    const pct = pctFromEvent(e.clientX);
    onChange(pct);
  }, [dragging, disabled, pctFromEvent, onChange]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  // Keyboard support
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    const step = e.shiftKey ? 25 : 5;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(0, value - step));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(100, value + step));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(100);
    }
  }, [disabled, value, onChange]);

  const personalPct = 100 - value;
  const businessPct = value;

  return (
    <div className={`dial${compact ? " dial--compact" : ""}`}>
      {/* Labels row */}
      <div className="dial__labels">
        <div className="dial__lbl">
          <div className="dial__dot dial__dot--clay" />
          <span>Personal</span>
          <span className="dial__num">{personalPct}%</span>
        </div>
        <div className={`dial__state ${stateClass(value)}`}>
          {stateLabel(value)}
        </div>
        <div className="dial__lbl">
          <span className="dial__num">{businessPct}%</span>
          <span>Business</span>
          <div className="dial__dot dial__dot--forest" />
        </div>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className={`dial__track${dragging ? " is-drag" : ""}`}
        role="slider"
        aria-label="Business percentage"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        tabIndex={disabled ? -1 : 0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        style={{ outline: "none" }}
      >
        {/* Personal fill (left, clay) */}
        <div
          className="dial__fill dial__fill--clay"
          style={{ width: `${personalPct}%`, right: "auto" }}
        />
        {/* Business fill (right, forest) */}
        <div
          className="dial__fill dial__fill--forest"
          style={{
            left: `${personalPct}%`,
            width: `${businessPct}%`,
            right: "auto",
          }}
        />

        {/* Tick marks at 25%, 50%, 75% */}
        {[25, 50, 75].map((t) => (
          <div
            key={t}
            className="dial__tick"
            style={{ left: `${t}%` }}
          />
        ))}

        {/* Center label */}
        <div className="dial__center">
          {value === 0 ? "Personal" : value === 100 ? "Business" : `${value}% Business`}
        </div>

        {/* Handle */}
        <div
          className="dial__handle"
          style={{ left: `${value}%` }}
        >
          {!compact && (
            <div className="dial__handle-grip" />
          )}
        </div>
      </div>

      {/* Preset buttons */}
      <div className="dial__presets">
        {SNAP_POINTS.map((p) => (
          <button
            key={p}
            type="button"
            className={`dial__preset${value === p ? " is-active" : ""}`}
            onClick={() => !disabled && onChange(p)}
            disabled={disabled}
          >
            {p === 0 ? "0% (Personal)" : p === 100 ? "100% (Business)" : `${p}%`}
          </button>
        ))}
      </div>
    </div>
  );
}
