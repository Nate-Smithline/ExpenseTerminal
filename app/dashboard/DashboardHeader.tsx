"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TaxYearSelector } from "@/components/TaxYearSelector";

interface DashboardHeaderProps {
  taxYear: number;
  pendingCount: number;
  userName: string | null;
}

export function DashboardHeader({ taxYear, pendingCount, userName }: DashboardHeaderProps) {
  const router = useRouter();
  const displayName = userName?.trim() || "there";

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-normal text-mono-dark tracking-tight">
          Welcome back{displayName !== "there" ? "," : ""}
        </h1>
        <p className="text-lg md:text-xl font-display text-mono-dark/80 mt-0.5 tracking-tight">
          {displayName}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <TaxYearSelector
          value={taxYear}
          onChange={() => router.refresh()}
          label="Tax year"
          pill
        />
        {(pendingCount ?? 0) > 0 && (
          <Link
            href="/inbox"
            className="md:hidden inline-flex items-center justify-center rounded-full border border-bg-tertiary/60 bg-white px-6 py-3 text-sm font-medium text-mono-dark transition-all hover:border-accent-sage/40 hover:shadow-sm"
          >
            {pendingCount} pending
          </Link>
        )}
        <Link href="/activity" className="btn-primary text-sm">
          All Activity
        </Link>
      </div>
    </div>
  );
}
