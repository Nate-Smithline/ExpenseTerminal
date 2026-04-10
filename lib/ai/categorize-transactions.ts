/**
 * Streaming AI categorization for `/api/transactions/analyze`.
 * Stub: emit a single terminal event so the client stream completes.
 */
export async function categorizeTransactionsForUser(args: {
  supabase: unknown;
  userId: string;
  transactionIds: string[];
  businessIndustry: string | null;
  onEvent: (obj: Record<string, unknown>) => void;
}): Promise<void> {
  const { transactionIds, onEvent } = args;
  onEvent({
    type: "stub",
    message: "AI categorization is not configured on this branch.",
    count: transactionIds.length,
  });
  onEvent({ type: "complete", ok: false });
}
