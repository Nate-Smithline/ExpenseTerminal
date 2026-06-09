import { signedAccountBalance, todayDateString } from "@/lib/accounts/net-worth";

export interface SnapshotSource {
  id: string;
  account_type: string | null;
  balance: number | null;
}

/** Upsert today's signed balance snapshot for each connected account. */
export async function upsertNetWorthSnapshots(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  sources: SnapshotSource[],
): Promise<void> {
  if (sources.length === 0) return;

  const capturedOn = todayDateString();
  const rows = sources.map((s) => ({
    user_id: userId,
    data_source_id: s.id,
    captured_on: capturedOn,
    balance_cents: Math.round(signedAccountBalance(s.account_type, s.balance) * 100),
  }));

  const { error } = await supabase
    .from("net_worth_snapshots")
    .upsert(rows, { onConflict: "user_id,data_source_id,captured_on" });

  if (error) {
    console.warn("[net-worth-snapshots] upsert failed:", error.message);
  }
}

/** Nightly job: snapshot every account for every user (including manual / balance-only). */
export async function snapshotAllUsersNetWorth(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<{ users: number; accounts: number }> {
  const { data: accounts, error } = await supabase
    .from("data_sources")
    .select("id, user_id, account_type, balance");

  if (error) {
    console.warn("[net-worth-snapshots] batch load failed:", error.message);
    return { users: 0, accounts: 0 };
  }

  const byUser = new Map<string, SnapshotSource[]>();
  for (const row of accounts ?? []) {
    const list = byUser.get(row.user_id) ?? [];
    list.push({
      id: row.id,
      account_type: row.account_type,
      balance: row.balance,
    });
    byUser.set(row.user_id, list);
  }

  for (const [userId, sources] of byUser) {
    await upsertNetWorthSnapshots(supabase, userId, sources);
  }

  return { users: byUser.size, accounts: accounts?.length ?? 0 };
}
