"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TaxYearSelector } from "@/components/TaxYearSelector";

interface DashboardHeaderProps {
  taxYear: number;
  pendingCount: number;
}

export function DashboardHeader({ taxYear, pendingCount }: DashboardHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-mono-dark">
            Tax Summary
          </h1>
          <p className="text-sm text-mono-medium mt-1">
            Overview of deductions and estimated savings
          </p>
        </div>
        <TaxYearSelector
          value={taxYear}
          onChange={() => router.refresh()}
          label="Tax year"
          compact={false}
        />
      </div>
      <div className="flex items-center gap-3">
        {(pendingCount ?? 0) > 0 && (
          <Link href="/inbox" className="btn-secondary text-sm">
            {pendingCount} pending
          </Link>
        )}
        <Link href="/reports" className="btn-primary text-sm">
          Generate Report
        </Link>
      </div>
    </div>
  );
}
