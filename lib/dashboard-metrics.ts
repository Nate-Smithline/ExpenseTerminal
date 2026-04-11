import type { DashboardPeriod } from "@/lib/dashboard-period";
import { parseColumnFiltersJson } from "@/lib/activity-column-filters";
import { applyPageActivityViewSavedFiltersToQuery } from "@/lib/page-activity-view-filters";
import { ACTIVITY_FILTERABLE_STANDARD_COLUMNS } from "@/lib/validation/schemas";

const STANDARD_FILTERABLE_COLS = new Set<string>(ACTIVITY_FILTERABLE_STANDARD_COLUMNS);

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymdUTC(y: number, monthIndex: number, day: number) {
  return `${y}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

/** Calendar ranges in UTC (matches `date` column ISO comparisons). */
export function dashboardPeriodRangeUTC(period: DashboardPeriod): { start: string; end: string; label: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  const end = ymdUTC(y, m, d);

  if (period === "mtd") {
    return { start: ymdUTC(y, m, 1), end, label: "Month to date" };
  }
  if (period === "qtd") {
    const q0 = Math.floor(m / 3) * 3;
    return { start: ymdUTC(y, q0, 1), end, label: "Quarter to date" };
  }
  return { start: ymdUTC(y, 0, 1), end, label: "Year to date" };
}

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function resolvedAccountBalance(row: {
  balance_value_preference?: string | null;
  manual_balance?: string | number | null;
  plaid_balance_current?: string | number | null;
  plaid_balance_available?: string | number | null;
}): number {
  const pref = row.balance_value_preference || "current";
  if (pref === "manual" && row.manual_balance != null) return num(row.manual_balance);
  if (pref === "available" && row.plaid_balance_available != null) return num(row.plaid_balance_available);
  if (row.plaid_balance_current != null) return num(row.plaid_balance_current);
  if (row.manual_balance != null) return num(row.manual_balance);
  return 0;
}

export type DashboardAccountSnapshot = {
  id: string;
  name: string;
  balance: number;
  balanceClass: string | null;
  includeInNetWorth: boolean;
};

export type DashboardMetrics = {
  period: DashboardPeriod;
  range: { label: string; start: string; end: string };
  pageScope: { id: string; title: string } | null;
  netWorth: number;
  assets: number;
  liabilities: number;
  balanceAsOf: string | null;
  totalExpenses: number;
  totalIncome: number;
  transactionCount: number;
  accounts: DashboardAccountSnapshot[];
};

export async function computeDashboardMetrics(args: {
  supabase: unknown;
  userId: string;
  /** When set, transactions and accounts are limited to this workspace's linked accounts. */
  orgId: string | null;
  period: DashboardPeriod;
  pageId: string | null;
}): Promise<DashboardMetrics> {
  const supabase = args.supabase as any;
  const { userId, period, pageId, orgId } = args;

  const { start, end, label } = dashboardPeriodRangeUTC(period);

  // Org scope: list accounts by workspace (org_id). RLS restricts rows to what the viewer may see
  // (own accounts, or peers when accounts_page_visibility allows). Do not filter by user_id here —
  // members would otherwise see $0 because teammate-owned data_sources use a different user_id.
  const dsRes = orgId
    ? await supabase.from("data_sources").select("*").eq("org_id", orgId)
    : await supabase.from("data_sources").select("*").eq("user_id", userId);

  const sourceIds = ((dsRes.data ?? []) as { id: string }[]).map((r) => r.id).filter(Boolean);

  let pageScope: DashboardMetrics["pageScope"] = null;
  let pageSavedFilters: Record<string, unknown> | null = null;
  if (pageId) {
    let pageQ = supabase
      .from("pages")
      .select("id,title,org_id")
      .eq("id", pageId)
      .is("deleted_at", null);
    if (orgId) pageQ = pageQ.eq("org_id", orgId);
    const { data: pg } = await pageQ.maybeSingle();
    const p = pg as { id?: string; title?: string; org_id?: string } | null;
    if (p?.id && (!orgId || p.org_id === orgId)) {
      pageScope = { id: p.id, title: (p.title ?? "").trim() || "Untitled" };
      const { data: settingsRow } = await supabase
        .from("page_activity_view_settings")
        .select("filters")
        .eq("page_id", pageId)
        .maybeSingle();
      const raw = settingsRow?.filters;
      pageSavedFilters = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    }
  }

  let txRes: { data: unknown[] | null };
  if (sourceIds.length === 0) {
    txRes = { data: [] };
  } else if (pageScope && pageSavedFilters) {
    const columnFilters = parseColumnFiltersJson(pageSavedFilters.column_filters);
    const orgTypes = new Map<string, string>();
    if (columnFilters.length > 0 && orgId) {
      const needsOrgDefs = columnFilters.some((f) => !STANDARD_FILTERABLE_COLS.has(f.column));
      if (needsOrgDefs) {
        const { data: defs } = await supabase
          .from("transaction_property_definitions")
          .select("id,type")
          .eq("org_id", orgId);
        for (const row of defs ?? []) {
          if (row?.id && typeof row.type === "string") orgTypes.set(row.id, row.type);
        }
      }
    }
    let q = supabase.from("transactions").select("amount,transaction_type,status");
    q = applyPageActivityViewSavedFiltersToQuery(q, {
      txScope: { kind: "workspace", dataSourceIds: sourceIds },
      dateFrom: start,
      dateTo: end,
      filters: pageSavedFilters,
      orgTypes,
    });
    const statusPinned = typeof pageSavedFilters.status === "string" ? pageSavedFilters.status : null;
    if (!statusPinned) q = q.neq("status", "personal");
    txRes = await q;
  } else {
    txRes =
      sourceIds.length > 0
        ? await supabase
            .from("transactions")
            .select("amount,transaction_type,status")
            .in("data_source_id", sourceIds)
            .gte("date", start)
            .lte("date", end)
            .neq("status", "personal")
        : { data: [] };
  }

  const txs = (txRes.data ?? []) as {
    amount?: string | number | null;
    transaction_type?: string | null;
  }[];

  let totalExpenses = 0;
  let totalIncome = 0;
  let transactionCount = 0;
  for (const t of txs) {
    transactionCount += 1;
    const a = Math.abs(num(t.amount));
    if (t.transaction_type === "income") totalIncome += a;
    else totalExpenses += a;
  }

  const rows = (dsRes.data ?? []) as Array<{
    id: string;
    name: string;
    balance_class?: string | null;
    include_in_net_worth?: boolean | null;
    plaid_balance_as_of?: string | null;
    balance_value_preference?: string | null;
    manual_balance?: string | number | null;
    plaid_balance_current?: string | number | null;
    plaid_balance_available?: string | number | null;
  }>;

  const pinnedSource =
    pageSavedFilters && typeof pageSavedFilters.data_source_id === "string"
      ? pageSavedFilters.data_source_id
      : null;
  const balanceRows =
    pinnedSource && sourceIds.includes(pinnedSource) ? rows.filter((r) => r.id === pinnedSource) : rows;

  let assets = 0;
  let liabilities = 0;
  let balanceAsOf: string | null = null;
  const accounts: DashboardAccountSnapshot[] = [];

  for (const row of balanceRows) {
    const balance = resolvedAccountBalance(row);
    const include = row.include_in_net_worth !== false;
    const bc = row.balance_class ?? null;
    const absBal = Math.abs(balance);

    if (include) {
      if (bc === "liability") liabilities += absBal;
      else assets += absBal;
    }

    if (row.plaid_balance_as_of && (!balanceAsOf || row.plaid_balance_as_of > balanceAsOf)) {
      balanceAsOf = row.plaid_balance_as_of;
    }

    accounts.push({
      id: row.id,
      name: row.name,
      balance,
      balanceClass: bc,
      includeInNetWorth: include,
    });
  }

  return {
    period,
    range: { label, start, end },
    pageScope,
    netWorth: assets - liabilities,
    assets,
    liabilities,
    balanceAsOf,
    totalExpenses,
    totalIncome,
    transactionCount,
    accounts,
  };
}
