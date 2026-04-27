/** Serialize Plaid transaction for JSONB storage (lossy but stable). */
export function plaidTransactionToJson(tx: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(tx)) as Record<string, unknown>;
}
