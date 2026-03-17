"use client";

import { useRouter } from "next/navigation";
import { TaxYearSelector } from "@/components/TaxYearSelector";

interface OtherDeductionsHeaderProps {
  taxYear: number;
}

export function OtherDeductionsHeader({ taxYear }: OtherDeductionsHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-3">
        <div>
          <div
            role="heading"
            aria-level={1}
            className="text-[32px] leading-tight font-sans font-normal text-mono-dark"
          >
            Other Deductions
          </div>
          <p className="text-base text-mono-medium mt-1 font-sans">
            Calculate and track additional tax deductions outside your regular expenses.
          </p>
        </div>
      </div>
      <TaxYearSelector
        value={taxYear}
        onChange={() => router.refresh()}
        label="Tax year"
        compact={false}
      />
    </div>
  );
}

