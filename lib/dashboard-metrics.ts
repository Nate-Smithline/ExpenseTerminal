import type { DashboardPeriod } from "@/lib/dashboard-period";

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
  period: DashboardPeriod;
  pageId: string | null;
}): Promise<DashboardMetrics> {
  const supabase = args.supabase as any;
  const { userId, period, pageId } = args;

  const { start, end, label } = dashboardPeriodRangeUTC(period);

  const [txRes, dsRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("amount,transaction_type,status")
      .eq("user_id", userId)
      .gte("date", start)
      .lte("date", end)
      .neq("status", "personal"),
    supabase.from("data_sources").select("*").eq("user_id", userId),
  ]);

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

  let assets = 0;
  let liabilities = 0;
  let balanceAsOf: string | null = null;
  const accounts: DashboardAccountSnapshot[] = [];

  for (const row of rows) {
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

  let pageScope: DashboardMetrics["pageScope"] = null;
  if (pageId) {
    const { data: pg } = await supabase.from("pages").select("id,title").eq("id", pageId).maybeSingle();
    const p = pg as { id?: string; title?: string } | null;
    if (p?.id) pageScope = { id: p.id, title: (p.title ?? "").trim() || "Untitled" };
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
