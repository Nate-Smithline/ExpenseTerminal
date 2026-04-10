/**
 * Persist Plaid balances for linked items (accountsBalanceGet → data_sources columns).
 * Stub: no-op so dev / partial branches compile; restore full implementation from main when ready.
 */
export async function persistPlaidBalancesForPlaidItem(
  _supabase: unknown,
  _userId: string,
  _hostname: string | undefined,
  _accessToken: string,
  _plaidItemId: string
): Promise<void> {}

export async function refreshAllPlaidItemBalances(
  _supabase: unknown,
  _hostname: string
): Promise<{ itemsProcessed: number; errors: string[] }> {
  return { itemsProcessed: 0, errors: [] };
}
