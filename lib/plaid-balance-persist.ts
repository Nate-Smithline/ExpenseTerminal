import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlaidClient, decryptAccessToken } from "@/lib/plaid";

/**
 * Persist Plaid balances for all `data_sources` rows tied to one Item (`accounts/balance/get` → columns).
 */
export async function persistPlaidBalancesForPlaidItem(
  supabase: SupabaseClient,
  userId: string,
  hostname: string | undefined,
  accessToken: string,
  plaidItemId: string,
): Promise<void> {
  const plaid = getPlaidClient(hostname);
  const res = await plaid.accountsBalanceGet({ access_token: accessToken });
  const accounts = res.data.accounts ?? [];
  const byId = new Map(accounts.map((a) => [a.account_id, a]));

  const { data: rows, error } = await supabase
    .from("data_sources")
    .select("id, plaid_account_id")
    .eq("user_id", userId)
    .eq("plaid_item_id", plaidItemId)
    .eq("source_type", "plaid");

  if (error) throw new Error(error.message);

  const now = new Date().toISOString();

  for (const row of rows ?? []) {
    const aid = row.plaid_account_id as string | null;
    let acc = aid ? byId.get(aid) : undefined;
    if (!acc && accounts.length === 1) acc = accounts[0];
    if (!acc && !aid && accounts.length > 0) acc = accounts[0];
    if (!acc) continue;

    const b = acc.balances;
    const currency = b.iso_currency_code ?? b.unofficial_currency_code ?? "USD";

    const { error: upErr } = await supabase
      .from("data_sources")
      .update({
        plaid_balance_current: b.current,
        plaid_balance_available: b.available,
        plaid_balance_limit: b.limit,
        plaid_balance_iso_currency_code: currency,
        plaid_balance_as_of: now,
      })
      .eq("id", row.id)
      .eq("user_id", userId);

    if (upErr) throw new Error(upErr.message);
  }
}

export async function refreshAllPlaidItemBalances(
  supabase: SupabaseClient,
  hostname: string | undefined,
): Promise<{ itemsProcessed: number; errors: string[] }> {
  const errors: string[] = [];
  const { data: rows, error } = await supabase
    .from("data_sources")
    .select("user_id, plaid_item_id, plaid_access_token")
    .eq("source_type", "plaid")
    .not("plaid_item_id", "is", null)
    .not("plaid_access_token", "is", null);

  if (error) {
    return { itemsProcessed: 0, errors: [error.message] };
  }

  const seen = new Set<string>();
  let itemsProcessed = 0;

  for (const row of rows ?? []) {
    const uid = row.user_id as string;
    const itemId = row.plaid_item_id as string;
    const key = `${uid}:${itemId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      const token = decryptAccessToken(row.plaid_access_token as string);
      await persistPlaidBalancesForPlaidItem(supabase, uid, hostname, token, itemId);
      itemsProcessed += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${itemId}: ${msg}`);
    }
  }

  return { itemsProcessed, errors };
}
