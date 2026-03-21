"use client";

import { useState } from "react";

export function ForYourAwareness() {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="border border-[#F0F1F7] bg-white">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#F0F1F7]/60 transition-colors"
      >
        <div>
          <div
            role="heading"
            aria-level={2}
            className="text-xs md:text-sm font-medium font-sans text-mono-dark uppercase tracking-wide"
          >
            For your awareness
          </div>
        </div>
        <span className="material-symbols-rounded text-[18px] text-mono-light shrink-0">
          {expanded ? "expand_less" : "expand_more"}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0">
          <p className="text-xs text-mono-medium leading-relaxed max-w-2xl">
            The numbers and estimates in ExpenseTerminal are for awareness and planning only—they are not tax, legal, or accounting advice. For decisions about your return, please consult your own tax or accounting professional. ExpenseTerminal does not assume liability for reliance on this information.
          </p>
        </div>
      )}
    </section>
  );
}

