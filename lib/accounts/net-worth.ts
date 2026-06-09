export interface NetWorthAccount {
  account_type: string | null;
  balance: number | null;
}

/** Amount owed on a credit account (always ≥ 0). Handles Plaid (+) and schema (−) conventions. */
export function creditLiabilityAmount(balance: number | null | undefined): number {
  const b = balance ?? 0;
  if (b === 0) return 0;
  return b > 0 ? b : -b;
}

/** Signed balance for storage / snapshots (negative = liability). */
export function signedAccountBalance(
  accountType: string | null,
  balance: number | null | undefined,
): number {
  const b = balance ?? 0;
  if (accountType === "credit" && b > 0) return -b;
  return b;
}

export function computeNetWorth(accounts: NetWorthAccount[]): {
  assets: number;
  liabilities: number;
  netWorth: number;
} {
  let assets = 0;
  let liabilities = 0;
  for (const a of accounts) {
    if (a.account_type === "credit") {
      liabilities += creditLiabilityAmount(a.balance);
    } else {
      assets += a.balance ?? 0;
    }
  }
  return {
    assets,
    liabilities,
    netWorth: assets - liabilities,
  };
}

export type NetWorthPointSource = "snapshot" | "live" | "synthetic";

export interface NetWorthChartPoint {
  date: string;
  netWorth: number;
  source: NetWorthPointSource;
}

/** Local calendar date (YYYY-MM-DD) for snapshot keys. */
export function todayDateString(): string {
  return new Date().toLocaleDateString("en-CA");
}

/** Ensure at least two chart points; append today's live net worth when missing. */
export function ensureChartPoints(
  points: Array<{ date: string; netWorth: number }>,
  currentNetWorth: number,
  options?: { minDays?: number },
): { points: NetWorthChartPoint[]; sparse: boolean; syntheticPrefix: number; snapshotDays: number } {
  const minDays = options?.minDays ?? 5;
  const snapshotDays = points.length;
  const sparse = snapshotDays < 2;
  const today = todayDateString();
  const result: NetWorthChartPoint[] = points.map((p) => ({
    ...p,
    source: "snapshot",
  }));

  const lastIdx = result.length - 1;
  if (lastIdx < 0 || result[lastIdx].date !== today) {
    result.push({ date: today, netWorth: currentNetWorth, source: "live" });
  } else {
    result[lastIdx] = {
      date: today,
      netWorth: currentNetWorth,
      source: result[lastIdx].source === "snapshot" ? "snapshot" : "live",
    };
  }

  if (result.length >= 2) {
    return { points: result, sparse, syntheticPrefix: 0, snapshotDays };
  }

  const anchor = result[0];
  const start = new Date(`${anchor.date}T12:00:00`);
  start.setDate(start.getDate() - minDays);
  let startDate = start.toISOString().slice(0, 10);
  if (startDate >= anchor.date) {
    const fallback = new Date(`${anchor.date}T12:00:00`);
    fallback.setDate(fallback.getDate() - 1);
    startDate = fallback.toISOString().slice(0, 10);
  }

  return {
    points: [
      { date: startDate, netWorth: anchor.netWorth, source: "synthetic" },
      ...result,
    ],
    sparse: true,
    syntheticPrefix: 1,
    snapshotDays,
  };
}
