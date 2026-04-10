import { computeBalanceRollupFromDataSources, type DataSourceBalanceInput } from "@/lib/balance-rollup";

/** UTC calendar date YYYY-MM-DD */
export function utcSnapshotDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Upsert today's financial snapshot for one user (service role client).
 */
export async function upsertDailyFinancialSnapshotForUser(
  supabase: any,
  userId: string,
  snapshotDate: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: sources, error: srcErr } = await supabase
    .from("data_sources")
    .select(
      "id,name,account_type,source_type,balance_class,include_in_net_worth,balance_value_preference,plaid_balance_current,plaid_balance_available,manual_balance",
    )
    .eq("user_id", userId);

  if (srcErr) {
    return { ok: false, error: srcErr.message };
  }

  const { netWorth, assets, liabilities, snapshotAccounts } = computeBalanceRollupFromDataSources(
    (sources ?? []) as DataSourceBalanceInput[],
  );

  const { error } = await supabase.from("user_financial_snapshots").upsert(
    {
      user_id: userId,
      snapshot_date: snapshotDate,
      net_worth: Number(netWorth.toFixed(2)),
      total_assets: Number(assets.toFixed(2)),
      total_liabilities: Number(liabilities.toFixed(2)),
      accounts: snapshotAccounts,
    },
    { onConflict: "user_id,snapshot_date" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * After balance refresh: one row per user that has at least one data_source.
 */
export async function upsertDailyFinancialSnapshotsForAllUsers(supabase: any): Promise<{
  date: string;
  users: number;
  ok: number;
  failed: number;
  errors: string[];
}> {
  const snapshotDate = utcSnapshotDate();
  const { data: rows, error } = await supabase.from("data_sources").select("user_id");

  if (error) {
    return { date: snapshotDate, users: 0, ok: 0, failed: 0, errors: [error.message] };
  }

  const userIds = new Set<string>();
  for (const r of rows ?? []) {
    if (r?.user_id) userIds.add(r.user_id as string);
  }

  let ok = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const userId of userIds) {
    const res = await upsertDailyFinancialSnapshotForUser(supabase, userId, snapshotDate);
    if (res.ok) ok++;
    else {
      failed++;
      if (res.error && errors.length < 20) errors.push(`${userId}: ${res.error}`);
    }
  }

  return { date: snapshotDate, users: userIds.size, ok, failed, errors };
}
