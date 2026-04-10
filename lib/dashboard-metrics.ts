import type { DashboardPeriod } from "@/lib/dashboard-period";
import { computeDashboardDateRange } from "@/lib/dashboard-period";
import {
  computeBalanceRollupFromDataSources,
  type AccountRollupLine,
  type DataSourceBalanceInput,
} from "@/lib/balance-rollup";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";
import { applyPageActivityViewSavedFiltersToQuery } from "@/lib/page-activity-view-filters";

type TxRow = { amount: string; transaction_type: string };

/** PostgREST caps rows per request; paginate so period totals are not truncated. */
const TX_AGG_PAGE_SIZE = 1000;

export async function fetchPaginatedTxAmountRows(
  supabase: any,
  applyFilters: (q: any) => any,
): Promise<TxRow[]> {
  const out: TxRow[] = [];
  for (let from = 0; ; from += TX_AGG_PAGE_SIZE) {
    let q = supabase.from("transactions").select("amount,transaction_type");
    q = applyFilters(q);
    const { data } = await q.range(from, from + TX_AGG_PAGE_SIZE - 1);
    const chunk = (data ?? []) as TxRow[];
    out.push(...chunk);
    if (chunk.length < TX_AGG_PAGE_SIZE) break;
  }
  return out;
}

function absAmount(s: string): number {
  return Math.abs(Number(s) || 0);
}

function pctDelta(curr: number, prev: number): number | null {
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return null;
  if (prev === 0) return null;
  return (curr - prev) / prev;
}

export type DashboardMetricSet = {
  period: DashboardPeriod;
  range: ReturnType<typeof computeDashboardDateRange>;
  /** When set, income/spend/profit use that page's Activity saved filters over the dashboard period. */
  pageScope: { id: string; title: string } | null;
  income: number;
  spend: number;
  profit: number;
  incomeDeltaPct: number | null;
  spendDeltaPct: number | null;
  profitDeltaPct: number | null;
  assets: number;
  liabilities: number;
  netWorth: number;
  /** Latest Plaid balance timestamp among sources, if any */
  balanceAsOf: string | null;
  /** Per-account lines for dashboard hero (live balances) */
  accounts: AccountRollupLine[];
};

async function resolveOrgId(supabase: any, userId: string): Promise<string | null> {
  let orgId = await getActiveOrgId(supabase as any, userId);
  if (!orgId) {
    try {
      orgId = await ensureActiveOrgForUser(userId);
    } catch {
      orgId = null;
    }
  }
  return orgId;
}

export async function computeDashboardMetrics(params: {
  supabase: any;
  userId: string;
  period: DashboardPeriod;
  /** Optional page: sums use that page's saved Activity filters; date range is still the dashboard period. */
  pageId?: string | null;
}): Promise<DashboardMetricSet> {
  const { supabase, userId, period, pageId: pageIdRaw } = params;
  const range = computeDashboardDateRange(period);
  const pageId = typeof pageIdRaw === "string" && pageIdRaw ? pageIdRaw : null;

  let pageScope: { id: string; title: string } | null = null;
  let buildTxQuery = (q: any, start: string, end: string) =>
    q.eq("user_id", userId).gte("date", start).lte("date", end);

  if (pageId) {
    const orgId = await resolveOrgId(supabase as any, userId);
    if (orgId) {
      const { data: pageRow } = await (supabase as any)
        .from("pages")
        .select("id,title,org_id")
        .eq("id", pageId)
        .is("deleted_at", null)
        .maybeSingle();

      if (pageRow && (pageRow as { org_id?: string }).org_id === orgId) {
        const { data: settings } = await (supabase as any)
          .from("page_activity_view_settings")
          .select("filters")
          .eq("page_id", pageId)
          .maybeSingle();

        const { data: defs } = await (supabase as any)
          .from("transaction_property_definitions")
          .select("id,type")
          .eq("org_id", orgId);
        const orgTypes = new Map<string, string>();
        for (const row of defs ?? []) {
          if (row?.id && typeof row.type === "string") orgTypes.set(row.id as string, row.type);
        }

        const filters =
          settings?.filters && typeof settings.filters === "object"
            ? (settings.filters as Record<string, unknown>)
            : {};

        const title = String((pageRow as { title?: string }).title ?? "").trim() || "Untitled";
        pageScope = { id: pageId, title };

        buildTxQuery = (q: any, start: string, end: string) =>
          applyPageActivityViewSavedFiltersToQuery(q, {
            userId,
            dateFrom: start,
            dateTo: end,
            filters,
            orgTypes,
          });
      }
    }
  }

  // Default: all of the user's transactions in range (no status/type/account filters).
  const [txNow, txPrev] = await Promise.all([
    fetchPaginatedTxAmountRows(supabase as any, (q: any) => buildTxQuery(q, range.start, range.end)),
    fetchPaginatedTxAmountRows(supabase as any, (q: any) =>
      buildTxQuery(q, range.prevStart, range.prevEnd),
    ),
  ]);

  const sumIncome = (rows: TxRow[] | null | undefined) =>
    (rows ?? []).reduce((sum, r) => (r.transaction_type === "income" ? sum + absAmount(r.amount) : sum), 0);
  const sumSpend = (rows: TxRow[] | null | undefined) =>
    (rows ?? []).reduce((sum, r) => (r.transaction_type === "expense" ? sum + absAmount(r.amount) : sum), 0);

  const income = sumIncome(txNow);
  const spend = sumSpend(txNow);
  const profit = income - spend;

  const prevIncome = sumIncome(txPrev);
  const prevSpend = sumSpend(txPrev);
  const prevProfit = prevIncome - prevSpend;

  const { data: sources } = await (supabase as any)
    .from("data_sources")
    .select(
      "id,name,account_type,source_type,balance_class,include_in_net_worth,balance_value_preference,plaid_balance_current,plaid_balance_available,manual_balance,plaid_balance_as_of",
    )
    .eq("user_id", userId);

  const sourceRows = (sources ?? []) as (DataSourceBalanceInput & { plaid_balance_as_of?: string | null })[];
  const { assets, liabilities, netWorth, accounts } = computeBalanceRollupFromDataSources(sourceRows);

  let balanceAsOf: string | null = null;
  for (const s of sourceRows) {
    const t = s.plaid_balance_as_of;
    if (typeof t !== "string" || !t) continue;
    if (!balanceAsOf || t > balanceAsOf) balanceAsOf = t;
  }

  return {
    period,
    range,
    pageScope,
    income,
    spend,
    profit,
    incomeDeltaPct: pctDelta(income, prevIncome),
    spendDeltaPct: pctDelta(spend, prevSpend),
    profitDeltaPct: pctDelta(profit, prevProfit),
    assets,
    liabilities,
    netWorth,
    balanceAsOf,
    accounts,
  };
}

