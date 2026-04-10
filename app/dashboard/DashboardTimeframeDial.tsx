"use client";

import { useRouter } from "next/navigation";
import type { DashboardPeriod } from "@/lib/dashboard-period";

const OPTIONS: Array<{ id: DashboardPeriod; label: string }> = [
  { id: "mtd", label: "MTD" },
  { id: "qtd", label: "QTD" },
  { id: "ytd", label: "YTD" },
];

/** Avoid useSearchParams here — without a Suspense boundary it can break RSC/hydration and trigger React warnings. */
function dashboardHref(period: DashboardPeriod, pageId: string | null | undefined): string {
  const sp = new URLSearchParams();
  sp.set("period", period);
  if (pageId) sp.set("page_id", pageId);
  return `/dashboard?${sp.toString()}`;
}

export function DashboardTimeframeDial({
  value,
  pageIdToPreserve = null,
}: {
  value: DashboardPeriod;
  /** When switching MTD/QTD/YTD, keep the active page filter (must match server-resolved scope). */
  pageIdToPreserve?: string | null;
}) {
  const router = useRouter();

  function setPeriod(p: DashboardPeriod) {
    router.push(dashboardHref(p, pageIdToPreserve));
  }

  return (
    <div className="inline-flex items-center rounded-full border border-black/[0.10] bg-white p-1 shadow-sm">
      {OPTIONS.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setPeriod(opt.id)}
            className={
              "h-8 rounded-full px-3 text-xs font-semibold tracking-wide transition-colors " +
              (active ? "bg-black text-white" : "text-mono-medium hover:bg-[#f5f5f7]")
            }
            aria-pressed={active}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function DashboardPeriodPageToolbar({
  period,
  pages,
  scopedPageId,
}: {
  period: DashboardPeriod;
  pages: Array<{ id: string; title: string }>;
  /** Server-resolved page scope for metrics (null if URL had no page or an invalid id). */
  scopedPageId: string | null;
}) {
  const router = useRouter();

  function setPageId(next: string) {
    router.push(dashboardHref(period, next || null));
  }

  const selectValue = scopedPageId && pages.some((p) => p.id === scopedPageId) ? scopedPageId : "";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <label className="flex items-center gap-2">
        <span className="sr-only">Filter metrics by page</span>
        <select
          value={selectValue}
          onChange={(e) => setPageId(e.target.value)}
          className="h-8 max-w-[min(100%,14rem)] cursor-pointer rounded-full border border-black/[0.10] bg-white px-3 text-xs font-medium text-mono-dark shadow-sm outline-none transition hover:border-black/[0.14] focus-visible:ring-2 focus-visible:ring-[#007aff]/25"
          aria-label="Filter period metrics by page view"
        >
          <option value="">All transactions</option>
          {pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
      <DashboardTimeframeDial value={period} pageIdToPreserve={scopedPageId} />
    </div>
  );
}
