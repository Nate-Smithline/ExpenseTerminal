"use client";

import { useEffect, useState } from "react";
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
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const now = new Date();
    const hour = now.getHours();
    let label = "Good evening";
    if (hour < 12) label = "Good morning";
    else if (hour < 17) label = "Good afternoon";
    else if (hour < 21) label = "Good evening";
    else label = "Good night";
    setGreeting(label);

    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) {
        const encoded = encodeURIComponent(tz);
        const maxAge = 60 * 60 * 24 * 365; // 1 year
        document.cookie = `et_tz=${encoded}; path=/; max-age=${maxAge}`;
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-normal text-mono-dark tracking-tight">
          {greeting ?? "Welcome back"}
        </h1>
        <p className="text-lg md:text-xl font-sans text-mono-dark/80 mt-0.5 tracking-tight">
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
      </div>
    </div>
  );
}
