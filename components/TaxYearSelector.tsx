"use client";

import { useState, useRef, useEffect } from "react";
import { persistTaxYear } from "@/lib/tax-year-cookie";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [
  CURRENT_YEAR + 1,
  CURRENT_YEAR,
  CURRENT_YEAR - 1,
  CURRENT_YEAR - 2,
];

interface TaxYearSelectorProps {
  value: number;
  onChange?: (year: number) => void;
  /** Optional label, e.g. "Tax year" */
  label?: string;
  /** Compact style for inline use */
  compact?: boolean;
  /** Match button style (rounded-full, same padding as btn-secondary) */
  pill?: boolean;
}

export function TaxYearSelector({
  value,
  onChange,
  label = "Tax year",
  compact = false,
  pill = false,
}: TaxYearSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  function handleSelect(year: number) {
    persistTaxYear(year);
    onChange?.(year);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${value}. Click to change.`}
        className={`
          inline-flex items-center gap-2 bg-frost transition-all
          hover:shadow-sm
          focus:outline-none focus:ring-2 focus:ring-accent-sage/30 focus:ring-offset-1
          ${pill ? "rounded-full px-6 py-3 text-sm font-medium" : "rounded-none"}
          ${!pill && (compact ? "px-4 py-1.5 text-xs" : "px-4 py-2.5 text-base font-medium")}
          ${open ? "shadow-md ring-2 ring-accent-sage/20" : ""}
        `}
      >
        <span className="text-mono-dark tabular-nums">{value}</span>
        <span
          className={`material-symbols-rounded text-[18px] text-mono-medium transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          expand_more
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute right-0 top-full z-50 mt-1.5 min-w-[6rem] overflow-hidden rounded-none border border-[#8A9BB0]/50 bg-white py-1 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {YEAR_OPTIONS.map((year) => {
            const isSelected = value === year;
            const isFuture = year > CURRENT_YEAR;
            return (
              <button
                key={year}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(year)}
                className={`
                  flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors
                  ${
                    isSelected
                      ? "bg-frost text-sovereign-blue font-medium"
                      : "text-mono-dark hover:bg-frost"
                  }
                `}
              >
                <span className="tabular-nums">{year}</span>
                {isSelected && (
                  <span
                    className="material-symbols-rounded text-sovereign-blue leading-none"
                    style={{ fontSize: "14px", lineHeight: "14px" }}
                  >
                    check
                  </span>
                )}
                {isFuture && !isSelected && (
                  <span className="text-[10px] uppercase tracking-wide text-mono-light">Upcoming</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
