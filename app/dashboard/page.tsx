import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardPeriodPageToolbar } from "./DashboardTimeframeDial";
import { MinimalDashboardCards } from "./MinimalDashboardCards";
import { PagesComparisonSection } from "./PagesComparisonSection";
import { DashboardPageStrip } from "./DashboardPageStrip";
import { DashboardHomeHero } from "./DashboardHomeHero";
import type { DashboardPeriod } from "@/lib/dashboard-period";
import { computeDashboardMetrics } from "@/lib/dashboard-metrics";
import { computePageComparisonMetrics } from "@/lib/page-metrics";
import { loadDashboardPageStrip, loadOrgPagesForDashboardSelect } from "@/lib/dashboard-pages";
import { uuidSchema } from "@/lib/validation/schemas";
import { computeDashboardSnapshotDeltas } from "@/lib/dashboard-snapshot-deltas";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";

type DashboardSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: DashboardSearchParams;
}) {
  const authClient = await createSupabaseServerClient();
  const userId = await getCurrentUserId(authClient);

  if (!userId) redirect("/login");

  const supabase = authClient;
  const query = searchParams != null ? await searchParams : {};
  const rawPeriod = query.period;
  const period =
    (typeof rawPeriod === "string" && (rawPeriod === "mtd" || rawPeriod === "qtd" || rawPeriod === "ytd")
      ? rawPeriod
      : "mtd") satisfies DashboardPeriod;

  const rawPageId = query.page_id;
  const pageIdParam = Array.isArray(rawPageId) ? rawPageId[0] : rawPageId;
  const pageIdFromQuery =
    typeof pageIdParam === "string" && uuidSchema.safeParse(pageIdParam).success ? pageIdParam : null;

  let dashboardOrgId = await getActiveOrgId(supabase as any, userId);
  if (!dashboardOrgId) {
    try {
      dashboardOrgId = await ensureActiveOrgForUser(userId);
    } catch {
      dashboardOrgId = null;
    }
  }

  const [metrics, selectPages] = await Promise.all([
    computeDashboardMetrics({
      supabase,
      userId,
      orgId: dashboardOrgId,
      period,
      pageId: pageIdFromQuery,
    }),
    loadOrgPagesForDashboardSelect(supabase, userId),
  ]);

  const [pageRows, stripPages, snapshotCtx] = await Promise.all([
    computePageComparisonMetrics({
      supabase,
      userId,
      dateFrom: metrics.range.start,
      dateTo: metrics.range.end,
      limit: 6,
    }),
    loadDashboardPageStrip(supabase, userId, 12),
    computeDashboardSnapshotDeltas({
      supabase,
      userId,
      liveNetWorth: metrics.netWorth,
      liveAccounts: metrics.accounts,
    }),
  ]);

  const { data: profileRow } = await (supabase as any)
    .from("profiles")
    .select("first_name, last_name, name_prefix")
    .eq("id", userId)
    .single();

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <DashboardHeader
          pendingCount={0}
          userName={
            profileRow
              ? [profileRow.name_prefix, profileRow.first_name, profileRow.last_name]
                  .filter(Boolean)
                  .join(" ")
                  .trim() || null
              : null
          }
        />

        <DashboardPageStrip pages={stripPages} />

        <DashboardHomeHero
          netWorth={metrics.netWorth}
          assets={metrics.assets}
          liabilities={metrics.liabilities}
          balanceAsOf={metrics.balanceAsOf}
          snapshot={snapshotCtx}
        />
      </div>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-mono-light">This period</h2>
          <DashboardPeriodPageToolbar
            period={metrics.period}
            pages={selectPages}
            scopedPageId={metrics.pageScope?.id ?? null}
          />
        </div>
        <p className="text-[11px] text-mono-light -mt-1">
          {metrics.pageScope ? (
            <>
              <span className="font-medium text-mono-medium">{metrics.pageScope.title}</span>
              <span> · </span>
            </>
          ) : null}
          {metrics.range.label} · {metrics.range.start} → {metrics.range.end}
        </p>
        <MinimalDashboardCards metrics={metrics} />
      </section>

      <PagesComparisonSection
        rows={pageRows}
        subtitle={`${metrics.range.label} · ${metrics.range.start} → ${metrics.range.end}`}
      />
    </div>
  );
}
