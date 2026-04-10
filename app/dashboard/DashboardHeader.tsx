"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DashboardHeaderProps {
  pendingCount: number;
  userName: string | null;
}

export function DashboardHeader({ pendingCount, userName }: DashboardHeaderProps) {
  const displayName = userName?.trim() || "there";
  const [greeting, setGreeting] = useState<string | null>(null);
  const [todayLabel, setTodayLabel] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const now = new Date();
    const hour = now.getHours();
    let label = "Good Evening";
    if (hour < 12) label = "Good Morning";
    else if (hour < 17) label = "Good Afternoon";
    else if (hour < 21) label = "Good Evening";
    else label = "Good Night";
    setGreeting(label);
    try {
      setTodayLabel(
        now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      );
    } catch {
      setTodayLabel(null);
    }

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
      <div className="flex flex-col justify-center">
        <h1 className="text-2xl md:text-3xl font-display font-normal text-mono-dark tracking-tight">
          {(greeting ?? "Welcome back")}, {displayName}
        </h1>
        {todayLabel ? (
          <p className="mt-1 text-xs text-mono-medium">
            {todayLabel}
          </p>
        ) : null}
      </div>
      {(pendingCount ?? 0) > 0 && (
        <Link
          href="/inbox"
          className="md:hidden inline-flex items-center justify-center rounded-full border border-bg-tertiary/60 bg-white px-6 py-3 text-sm font-medium text-mono-dark transition-all hover:border-accent-sage/40 hover:shadow-sm"
        >
          {pendingCount} pending
        </Link>
      )}
    </div>
  );
}
