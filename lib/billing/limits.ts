/**
 * Given current count of CSV transactions that are eligible for AI, the number of new rows
 * being inserted, and the plan cap, returns how many of the new rows should be marked
 * eligible_for_ai and how many should not.
 */
export function computeCsvAiEligibility(
  currentEligibleCount: number,
  newRowCount: number,
  maxCsvTransactionsForAi: number
): { eligibleCount: number; ineligibleCount: number; overLimit: boolean } {
  if (maxCsvTransactionsForAi === Number.POSITIVE_INFINITY || maxCsvTransactionsForAi < 0) {
    return { eligibleCount: newRowCount, ineligibleCount: 0, overLimit: false };
  }
  const slotsLeft = Math.max(0, maxCsvTransactionsForAi - currentEligibleCount);
  const eligibleCount = Math.min(newRowCount, slotsLeft);
  const ineligibleCount = newRowCount - eligibleCount;
  const overLimit = ineligibleCount > 0;
  return { eligibleCount, ineligibleCount, overLimit };
}
