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
    <section className="border border-[#F0F1F7] bg-white divide-y divide-[#F0F1F7]">
      <div className="px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <div
            role="heading"
            aria-level={2}
            className="text-base md:text-lg font-normal font-sans text-mono-dark"
          >
            Additional Deductions
          </div>
          <p className="text-xs text-mono-medium mt-1 font-sans">
            Set up deduction calculators like home office, QBI, and mileage.
          </p>
        </div>
      </div>
      <ul className="px-4 py-3 divide-y divide-[#F0F1F7]">
        {DEDUCTION_TYPE_CARDS.map((item) => {
          const isSet = additionalDeductions?.some((d) => d.type === item.typeKey);
          return (
            <li key={item.typeKey}>
              <Link
                href={item.href}
                className="flex items-center gap-4 py-4 first:pt-0 last:pb-0 -mx-1 px-1 rounded-none hover:bg-[#F0F1F7]/60 transition-colors group"
              >
                <span className="material-symbols-rounded text-[16px] text-[#5B82B4] shrink-0 group-hover:text-[#5B82B4] transition-colors duration-300 ease-in-out">
                  {item.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs md:text-sm font-medium font-sans text-mono-dark">
                    {item.label}
                  </span>
                  <span className="block text-[11px] text-mono-medium font-sans mt-0.5 mb-1">
                    {item.description}
                  </span>
                </div>
                <span className="shrink-0 text-[11px] font-medium tabular-nums font-sans">
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
            className="w-full text-left flex items-center gap-4 py-4 first:pt-0 last:pb-0 -mx-1 px-1 rounded-none hover:bg-[#F0F1F7]/60 transition-colors group"
          >
            <span className="material-symbols-rounded text-[16px] text-[#5B82B4] shrink-0 group-hover:text-[#5B82B4] transition-colors duration-300 ease-in-out">
              {OTHER_DEDUCTIONS_CARD.icon}
            </span>
            <div className="min-w-0 flex-1">
              <span className="block text-xs md:text-sm font-medium font-sans text-mono-dark">
                {OTHER_DEDUCTIONS_CARD.label}
              </span>
              <span className="block text-[11px] text-mono-medium font-sans mt-0.5 mb-1">
                {OTHER_DEDUCTIONS_CARD.description}
              </span>
            </div>
          </button>
        </li>
      </ul>
    </section>
  );
}

