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
      <div>
        <h1 className="text-3xl font-bold text-mono-dark mb-1">Other Deductions</h1>
        <p className="text-mono-medium text-sm">
          Calculate and track additional tax deductions outside your regular expenses.
        </p>
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

