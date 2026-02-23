"use client";

import { useState, useEffect, useRef } from "react";

function formatCurrency(n: number): string {
  if (Number.isNaN(n) || n === 0) return "";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function parseCurrency(s: string): number {
  const cleaned = s.replace(/,/g, "");
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

/** Format the raw numeric string with commas as you type (e.g. "1234.56" -> "1,234.56"). */
function formatDisplayWhileTyping(sanitized: string): string {
  const parts = sanitized.split(".");
  const intPart = parts[0] ?? "";
  const decPart = parts[1] ?? "";
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.length > 1 ? `${formattedInt}.${decPart}` : formattedInt;
}

interface CurrencyInputProps {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  min?: number;
  max?: number;
  "aria-label"?: string;
  id?: string;
}

export function CurrencyInput({
  value,
  onChange,
  placeholder = "0.00",
  disabled = false,
  className = "",
  min,
  max,
  "aria-label": ariaLabel,
  id,
}: CurrencyInputProps) {
  const [display, setDisplay] = useState(() => formatCurrency(value));
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused) {
      setDisplay(formatCurrency(value));
    }
  }, [value, focused]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const allowed = raw.replace(/[^0-9.]/g, "");
    const parts = allowed.split(".");
    const sanitized = parts.length > 1 ? `${parts[0] ?? ""}.${(parts[1] ?? "").slice(0, 2)}` : parts[0] ?? "";
    setDisplay(formatDisplayWhileTyping(sanitized));
    const num = parseCurrency(sanitized);
    let next = num;
    if (min != null && num < min) next = min;
    if (max != null && num > max) next = max;
    onChange(next);
  }

  function handleFocus() {
    setFocused(true);
    setDisplay(value !== 0 ? formatCurrency(value) : "");
  }

  function handleBlur() {
    setFocused(false);
    const num = parseCurrency(display);
    onChange(num);
    setDisplay(formatCurrency(num));
  }

  const baseClass =
    "w-full border border-bg-tertiary rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-1 focus:ring-accent-sage/30 outline-none tabular-nums";
  const combinedClass = className ? `${baseClass} ${className}` : baseClass;

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={focused ? display : formatCurrency(value) || ""}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      className={combinedClass}
      aria-label={ariaLabel}
      id={id}
    />
  );
}
