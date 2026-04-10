import { getPlaidClient, decryptAccessToken } from "@/lib/plaid";

function normAccountName(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function balanceUpdateFromPlaidAccount(acct: {
  account_id: string;
  balances: {
    available: number | null;
    current: number | null;
    limit: number | null;
    iso_currency_code: string | null;
    unofficial_currency_code?: string | null;
  };
}) {
  const b = acct.balances;
  const currency = b.iso_currency_code ?? b.unofficial_currency_code ?? "USD";
  return {
    plaid_balance_current: b.current != null ? Number(b.current.toFixed(2)) : null,
    plaid_balance_available: b.available != null ? Number(b.available.toFixed(2)) : null,
    plaid_balance_limit: b.limit != null ? Number(b.limit.toFixed(2)) : null,
    plaid_balance_iso_currency_code: currency,
    plaid_balance_as_of: new Date().toISOString(),
  };
}

/**
 * Fetches balances for a Plaid item and writes them to matching `data_sources` rows:
 * 1. Match `plaid_account_id` to Plaid `account_id`
 * 2. Rows still missing `plaid_account_id`: unique name match (normalized) per account
 * 3. If exactly one orphan row and one unmatched Plaid account remain, pair them (renamed accounts)
 */
export async function persistPlaidBalancesForPlaidItem(
  supabase: any,
  userId: string,
  hostname: string | undefined,
  accessToken: string,
  plaidItemId: string,
): Promise<void> {
  const plaid = getPlaidClient(hostname);
  const res = await plaid.accountsBalanceGet({ access_token: accessToken });
  const accounts = res.data.accounts ?? [];
  const nowIso = new Date().toISOString();

  const matchedAccountIds = new Set<string>();

  for (const acct of accounts) {
    const upd = {
      ...balanceUpdateFromPlaidAccount(acct),
      plaid_balance_as_of: nowIso,
    };
    const { data: updated, error } = await supabase
      .from("data_sources")
      .update(upd)
      .eq("user_id", userId)
      .eq("plaid_item_id", plaidItemId)
      .eq("plaid_account_id", acct.account_id)
      .select("id");
    if (error) {
      console.warn("[persistPlaidBalances] update by plaid_account_id failed", acct.account_id, error);
      continue;
    }
    if (updated && updated.length > 0) {
      matchedAccountIds.add(acct.account_id);
    }
  }

  const { data: orphanRows } = await supabase
    .from("data_sources")
    .select("id, name")
    .eq("user_id", userId)
    .eq("plaid_item_id", plaidItemId)
    .is("plaid_account_id", null);

  if (!orphanRows?.length) return;

  const pool = accounts.filter((a) => !matchedAccountIds.has(a.account_id));

  for (const row of orphanRows) {
    const rn = normAccountName(row.name as string);
    const candidates = pool.filter((a) => normAccountName(a.name) === rn);
    if (candidates.length !== 1) continue;
    const acct = candidates[0];
    const upd = {
      ...balanceUpdateFromPlaidAccount(acct),
      plaid_account_id: acct.account_id,
      plaid_balance_as_of: nowIso,
    };
    const { error } = await supabase
      .from("data_sources")
      .update(upd)
      .eq("id", row.id)
      .eq("user_id", userId);
    if (error) {
      console.warn("[persistPlaidBalances] name-match update failed", row.id, error);
      continue;
    }
    matchedAccountIds.add(acct.account_id);
    const idx = pool.findIndex((a) => a.account_id === acct.account_id);
    if (idx >= 0) pool.splice(idx, 1);
  }

  const { data: stillOrphans } = await supabase
    .from("data_sources")
    .select("id")
    .eq("user_id", userId)
    .eq("plaid_item_id", plaidItemId)
    .is("plaid_account_id", null);

  const remainingPool = accounts.filter((a) => !matchedAccountIds.has(a.account_id));
  if (stillOrphans?.length === 1 && remainingPool.length === 1) {
    const acct = remainingPool[0];
    const upd = {
      ...balanceUpdateFromPlaidAccount(acct),
      plaid_account_id: acct.account_id,
      plaid_balance_as_of: nowIso,
    };
    const { error } = await supabase
      .from("data_sources")
      .update(upd)
      .eq("id", stillOrphans[0].id)
      .eq("user_id", userId);
    if (error) {
      console.warn("[persistPlaidBalances] single leftover match failed", error);
    }
  }
}

export type PlaidBalanceCronItemResult = {
  userId: string;
  plaidItemId: string;
  ok: boolean;
  error?: string;
};

/**
 * One `accountsBalanceGet` per distinct Plaid item (deduped by user + item id).
 * Used by the daily cron after transaction sync so balances refresh even when txn sync fails.
 */
export async function refreshAllPlaidItemBalances(
  supabase: any,
  hostname: string | undefined,
): Promise<PlaidBalanceCronItemResult[]> {
  const { data: rows, error } = await supabase
    .from("data_sources")
    .select("user_id, plaid_item_id, plaid_access_token")
    .eq("source_type", "plaid")
    .not("plaid_item_id", "is", null)
    .not("plaid_access_token", "is", null);

  if (error) {
    console.warn("[refreshAllPlaidItemBalances] query failed", error);
    return [];
  }

  const seen = new Set<string>();
  const results: PlaidBalanceCronItemResult[] = [];

  for (const row of rows ?? []) {
    const uid = row.user_id as string;
    const itemId = row.plaid_item_id as string;
    const key = `${uid}::${itemId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      const token = decryptAccessToken(row.plaid_access_token as string);
      await persistPlaidBalancesForPlaidItem(supabase, uid, hostname, token, itemId);
      results.push({ userId: uid, plaidItemId: itemId, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[refreshAllPlaidItemBalances] item failed", { key, msg });
      results.push({ userId: uid, plaidItemId: itemId, ok: false, error: msg });
    }
  }

  return results;
}
