"use client";

import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (six: string) => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
};

/** `value` is up to 6 digits only */
export function OtpSixInputs({ value, onChange, disabled, error, autoFocus }: Props) {
  const clean = value.replace(/\D/g, "").slice(0, 6);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus) inputsRef.current[0]?.focus();
  }, [autoFocus]);

  const focusIndex = (i: number) => {
    const el = inputsRef.current[Math.max(0, Math.min(5, i))];
    el?.focus();
    el?.select();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(text);
    focusIndex(Math.min(5, text.length));
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          value={clean[i] ?? ""}
          aria-label={`Digit ${i + 1}`}
          className={`h-12 w-10 sm:h-14 sm:w-12 rounded-[12px] border text-center text-lg font-semibold tracking-tight text-brand-black outline-none transition-colors duration-150 ease-out bg-brand-light-grey focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/25 ${
            error ? "border-brand-red bg-brand-light-grey" : "border-brand-medium-grey"
          }`}
          onChange={(e) => {
            const c = e.target.value.replace(/\D/g, "").slice(-1);
            if (c) {
              const next = (clean.slice(0, i) + c + clean.slice(i + 1)).replace(/\D/g, "").slice(0, 6);
              onChange(next);
              focusIndex(i + 1);
            } else {
              onChange(clean.slice(0, i) + clean.slice(i + 1));
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !clean[i] && i > 0) {
              e.preventDefault();
              onChange(clean.slice(0, i - 1) + clean.slice(i));
              focusIndex(i - 1);
            }
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              focusIndex(i - 1);
            }
            if (e.key === "ArrowRight") {
              e.preventDefault();
              focusIndex(i + 1);
            }
          }}
        />
      ))}
    </div>
  );
}
