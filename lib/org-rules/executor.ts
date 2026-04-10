/**
 * Org transaction rules runner (ingest + scheduled).
 * Stubs keep builds green; restore full evaluator from main when merging.
 */

export async function runOrgRulesForIngest(
  _supabase: unknown,
  _orgId: string | null,
  _transactionIds: string[]
): Promise<void> {}

export async function runOrgRulesDailyAllOrgs(
  _supabase: unknown
): Promise<{ orgsProcessed: number; skipped: boolean }> {
  return { orgsProcessed: 0, skipped: true };
}
