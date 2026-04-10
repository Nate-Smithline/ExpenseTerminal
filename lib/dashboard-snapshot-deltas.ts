import type { AccountRollupLine } from "@/lib/balance-rollup";

export type NetWorthDelta = {
  amount: number | null;
  pct: number | null;
};

export type AccountWithDeltas = AccountRollupLine & {
  mtdDelta: number | null;
  ytdDelta: number | null;
};

export type DashboardSnapshotContext = {
  netWorthMtd: NetWorthDelta;
  netWorthYtd: NetWorthDelta;
  accounts: AccountWithDeltas[];
};

type SnapshotRow = {
  snapshot_date: string;
  net_worth: number | string;
  accounts: unknown;
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseAccountsJson(raw: unknown): Map<string, number> {
  const m = new Map<string, number>();
  if (!Array.isArray(raw)) return m;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = (item as { data_source_id?: string }).data_source_id;
    const bal = (item as { balance?: unknown }).balance;
    if (typeof id === "string" && id) {
      m.set(id, num(bal));
    }
  }
  return m;
}

async function fetchLatestSnapshotBefore(
  supabase: any,
  userId: string,
  beforeDate: string,
): Promise<SnapshotRow | null> {
  const { data, error } = await supabase
    .from("user_financial_snapshots")
    .select("snapshot_date,net_worth,accounts")
    .eq("user_id", userId)
    .lt("snapshot_date", beforeDate)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as SnapshotRow;
}

function deltaAndPct(current: number, baseline: number | null): NetWorthDelta {
  if (baseline == null || !Number.isFinite(baseline)) return { amount: null, pct: null };
  const amount = current - baseline;
  if (baseline === 0) return { amount, pct: null };
  return { amount, pct: amount / baseline };
}

/**
 * MTD baseline: last snapshot strictly before the first day of the current UTC month.
 * YTD baseline: last snapshot strictly before Jan 1 of the current UTC year.
 */
export async function computeDashboardSnapshotDeltas(params: {
  supabase: any;
  userId: string;
  liveNetWorth: number;
  liveAccounts: AccountRollupLine[];
  now?: Date;
}): Promise<DashboardSnapshotContext> {
  const { supabase, userId, liveNetWorth, liveAccounts } = params;
  const now = params.now ?? new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const yearStart = `${y}-01-01`;

  const [mtdBaselineRow, ytdBaselineRow] = await Promise.all([
    fetchLatestSnapshotBefore(supabase, userId, monthStart),
    fetchLatestSnapshotBefore(supabase, userId, yearStart),
  ]);

  const mtdBaselineNw = mtdBaselineRow ? num(mtdBaselineRow.net_worth) : null;
  const ytdBaselineNw = ytdBaselineRow ? num(ytdBaselineRow.net_worth) : null;

  const mtdMap = mtdBaselineRow ? parseAccountsJson(mtdBaselineRow.accounts) : new Map<string, number>();
  const ytdMap = ytdBaselineRow ? parseAccountsJson(ytdBaselineRow.accounts) : new Map<string, number>();

  const accounts: AccountWithDeltas[] = liveAccounts.map((a) => {
    const cur = a.balance;
    const bMtd = mtdMap.get(a.data_source_id);
    const bYtd = ytdMap.get(a.data_source_id);
    return {
      ...a,
      mtdDelta: cur != null && bMtd !== undefined ? cur - bMtd : null,
      ytdDelta: cur != null && bYtd !== undefined ? cur - bYtd : null,
    };
  });

  return {
    netWorthMtd: deltaAndPct(liveNetWorth, mtdBaselineNw),
    netWorthYtd: deltaAndPct(liveNetWorth, ytdBaselineNw),
    accounts,
  };
}
