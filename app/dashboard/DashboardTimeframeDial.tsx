"use client";

import { useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { DashboardPeriod } from "@/lib/dashboard-period";
import type { DashboardSelectPage } from "@/lib/dashboard-pages";

type DashboardPeriodPageToolbarProps = {
  period: DashboardPeriod;
  pages: DashboardSelectPage[];
  scopedPageId: string | null;
};

const PERIODS: { id: DashboardPeriod; label: string }[] = [
  { id: "mtd", label: "MTD" },
  { id: "qtd", label: "QTD" },
  { id: "ytd", label: "YTD" },
];

function dashboardHref(
  pathname: string,
  base: { period: DashboardPeriod; pageId: string | null },
  patch: { period?: DashboardPeriod; pageId?: string | null },
) {
  const nextPeriod = patch.period ?? base.period;
  const nextPageId = patch.pageId !== undefined ? patch.pageId : base.pageId;
  const q = new URLSearchParams();
  q.set("period", nextPeriod);
  if (nextPageId) q.set("page_id", nextPageId);
  const s = q.toString();
  return s ? `${pathname}?${s}` : pathname;
}

export function DashboardPeriodPageToolbar({
  period,
  pages,
  scopedPageId,
}: DashboardPeriodPageToolbarProps) {
  const router = useRouter();
  const pathname = usePathname() || "/dashboard";

  const base = { period, pageId: scopedPageId };

  const pushQuery = useCallback(
    (patch: { period?: DashboardPeriod; pageId?: string | null }) => {
      const href = dashboardHref(pathname, base, patch);
      router.push(href, { scroll: false });
    },
    [pathname, router, period, scopedPageId],
  );

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <div
        className="inline-flex rounded-lg border border-bg-tertiary/60 bg-bg-secondary/40 p-0.5"
        role="group"
        aria-label="Dashboard period"
      >
        {PERIODS.map((p) => {
          const active = period === p.id;
          const href = dashboardHref(pathname, base, { period: p.id });
          return (
            <Link
              key={p.id}
              href={href}
              scroll={false}
              className={
                active
                  ? "rounded-md bg-white px-2.5 py-1 text-[12px] font-semibold text-mono-dark shadow-sm"
                  : "rounded-md px-2.5 py-1 text-[12px] font-medium text-mono-medium transition hover:text-mono-dark"
              }
            >
              {p.label}
            </Link>
          );
        })}
      </div>
      {pages.length > 0 ? (
        <select
          aria-label="Scope metrics to page"
          className="h-8 max-w-[220px] truncate rounded-md border border-bg-tertiary/60 bg-white px-2 text-[12px] font-medium text-mono-dark"
          value={scopedPageId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            pushQuery({ pageId: v === "" ? null : v });
          }}
        >
          <option value="">All pages</option>
          {pages.map((pg) => (
            <option key={pg.id} value={pg.id}>
              {pg.title?.trim() || "Untitled"}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
