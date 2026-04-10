"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

export function DashboardPeriodPageToolbar({
  period,
  pages,
  scopedPageId,
}: DashboardPeriodPageToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigate = useCallback(
    (patch: { period?: DashboardPeriod; pageId?: string | null }) => {
      const q = new URLSearchParams(searchParams?.toString() ?? "");
      if (patch.period != null) q.set("period", patch.period);
      if (patch.pageId === null || patch.pageId === "") {
        q.delete("page_id");
      } else if (patch.pageId !== undefined) {
        q.set("page_id", patch.pageId);
      }
      const qs = q.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
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
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate({ period: p.id })}
              className={
                active
                  ? "rounded-md bg-white px-2.5 py-1 text-[12px] font-semibold text-mono-dark shadow-sm"
                  : "rounded-md px-2.5 py-1 text-[12px] font-medium text-mono-medium transition hover:text-mono-dark"
              }
            >
              {p.label}
            </button>
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
            navigate({ pageId: v === "" ? null : v });
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
