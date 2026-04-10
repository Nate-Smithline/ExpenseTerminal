import type { DashboardAccountSnapshot } from "@/lib/dashboard-metrics";

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function rollupFromAccounts(accounts: DashboardAccountSnapshot[]) {
  let assets = 0;
  let liabilities = 0;
  for (const a of accounts) {
    if (!a.includeInNetWorth) continue;
    const b = Math.abs(a.balance);
    if (a.balanceClass === "liability") liabilities += b;
    else assets += b;
  }
  return { assets, liabilities, netWorth: assets - liabilities };
}

export type DashboardAccountDelta = {
  id: string;
  name: string;
  delta: number;
};

export type DashboardSnapshotDeltas = {
  hasBaseline: boolean;
  snapshotDate: string | null;
  previousNetWorth: number | null;
  netWorthDelta: number | null;
  previousAssets: number | null;
  assetsDelta: number | null;
  previousLiabilities: number | null;
  liabilitiesDelta: number | null;
  /** Largest absolute balance changes vs stored per-account snapshot (up to 3). */
  topAccountDeltas: DashboardAccountDelta[];
};

const EMPTY: DashboardSnapshotDeltas = {
  hasBaseline: false,
  snapshotDate: null,
  previousNetWorth: null,
  netWorthDelta: null,
  previousAssets: null,
  assetsDelta: null,
  previousLiabilities: null,
  liabilitiesDelta: null,
  topAccountDeltas: [],
};

/**
 * Compare live balances to the latest `user_financial_snapshots` row (cron / background job).
 */
export async function computeDashboardSnapshotDeltas(args: {
  supabase: unknown;
  userId: string;
  liveNetWorth: number;
  liveAccounts: DashboardAccountSnapshot[];
}): Promise<DashboardSnapshotDeltas> {
  const supabase = args.supabase as any;
  const { data: row } = await supabase
    .from("user_financial_snapshots")
    .select("snapshot_date, net_worth, total_assets, total_liabilities, accounts")
    .eq("user_id", args.userId)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return { ...EMPTY };

  const prevNW = num(row.net_worth);
  const prevAssets = num(row.total_assets);
  const prevLiab = num(row.total_liabilities);
  const liveRollup = rollupFromAccounts(args.liveAccounts);

  const rawAccounts = row.accounts;
  const snapList = Array.isArray(rawAccounts) ? rawAccounts : [];
  const prevById = new Map<string, number>();
  for (const a of snapList) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    if (!id) continue;
    prevById.set(id, num(o.balance));
  }

  const moves: DashboardAccountDelta[] = [];
  for (const a of args.liveAccounts) {
    if (!prevById.has(a.id)) continue;
    const prevBal = prevById.get(a.id)!;
    moves.push({
      id: a.id,
      name: a.name?.trim() || "Account",
      delta: a.balance - prevBal,
    });
  }
  moves.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

  return {
    hasBaseline: true,
    snapshotDate: typeof row.snapshot_date === "string" ? row.snapshot_date : null,
    previousNetWorth: prevNW,
    netWorthDelta: args.liveNetWorth - prevNW,
    previousAssets: prevAssets,
    assetsDelta: liveRollup.assets - prevAssets,
    previousLiabilities: prevLiab,
    liabilitiesDelta: liveRollup.liabilities - prevLiab,
    topAccountDeltas: moves.slice(0, 3),
  };
}
