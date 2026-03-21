"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TaxYearSelector } from "@/components/TaxYearSelector";
import { QuarterlyToggle } from "@/app/tax-details/QuarterlyToggle";

export function DashboardPeriodBar({ initialYear }: { initialYear: number }) {
  const router = useRouter();
  const [year, setYear] = useState(initialYear);
  const [quarter, setQuarter] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("dashboard-period-changed", {
        detail: { year, quarter },
      }),
    );
  }, [year, quarter]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <TaxYearSelector
        value={year}
        onChange={(y) => {
          setYear(y);
          router.refresh();
        }}
        label="Tax year"
        compact
      />
      <QuarterlyToggle value={quarter} onChange={setQuarter} />
    </div>
  );
}

