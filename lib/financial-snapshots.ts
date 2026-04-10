/**
 * Daily `user_financial_snapshots` rollups.
 * Stub returns empty stats so cron / builds succeed without DB writes.
 */
export async function upsertDailyFinancialSnapshotsForAllUsers(
  _supabase: unknown
): Promise<{ date: string; users: number; ok: number; failed: number; errors: string[] }> {
  return {
    date: new Date().toISOString().slice(0, 10),
    users: 0,
    ok: 0,
    failed: 0,
    errors: [],
  };
}
