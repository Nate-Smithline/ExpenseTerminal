"use client";

import Link from "next/link";
import { DEDUCTION_TYPE_CARDS, OTHER_DEDUCTIONS_CARD } from "@/lib/deduction-types";

interface AdditionalDeductionsListProps {
  additionalDeductions?: { type: string }[] | null;
}

export function AdditionalDeductionsList({ additionalDeductions }: AdditionalDeductionsListProps) {
  const handleOpenWhatCanIDeduct = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("open-what-can-i-deduct"));
  };

  return (
    <div className="card overflow-hidden px-6 pt-6 pb-4 border-l-4 border-l-accent-sage/30">
      <h2 className="text-lg font-semibold text-mono-dark mb-1 tracking-tight">Additional Deductions</h2>
      <p className="text-sm text-mono-light mb-4">
        Set up deduction calculators like home office, QBI, and mileage
      </p>
      <ul className="divide-y divide-bg-tertiary/40">
        {DEDUCTION_TYPE_CARDS.map((item) => {
          const isSet = additionalDeductions?.some((d) => d.type === item.typeKey);
          return (
            <li key={item.typeKey}>
              <Link
                href={item.href}
                className="flex items-center gap-4 py-6 first:pt-0 last:pb-0 -mx-3 px-3 rounded-lg hover:bg-bg-tertiary/40 transition-all duration-300 ease-in-out group"
              >
                <span className="material-symbols-rounded text-[22px] text-accent-sage shrink-0 group-hover:text-mono-dark transition-colors duration-300 ease-in-out">
                  {item.icon}
                </span>
                <div className="min-w-0 flex-1 py-3">
                  <span className="font-medium text-mono-dark block">{item.label}</span>
                  <span className="text-sm text-mono-medium">{item.description}</span>
                </div>
                <span className="shrink-0 text-xs font-medium tabular-nums">
                  {isSet ? (
                    <span className="text-accent-sage">Set</span>
                  ) : (
                    <span className="text-mono-light">Not set</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={handleOpenWhatCanIDeduct}
            className="w-full text-left flex items-center gap-4 py-6 first:pt-0 last:pb-0 -mx-3 px-3 rounded-lg hover:bg-bg-tertiary/40 transition-all duration-300 ease-in-out group"
          >
            <span className="material-symbols-rounded text-[22px] text-accent-sage shrink-0 group-hover:text-mono-dark transition-colors duration-300 ease-in-out">
              {OTHER_DEDUCTIONS_CARD.icon}
            </span>
            <div className="min-w-0 flex-1 py-3">
              <span className="font-medium text-mono-dark block">{OTHER_DEDUCTIONS_CARD.label}</span>
              <span className="text-sm text-mono-medium">{OTHER_DEDUCTIONS_CARD.description}</span>
            </div>
          </button>
        </li>
      </ul>
    </div>
  );
}

