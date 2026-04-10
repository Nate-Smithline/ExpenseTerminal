/** Columns included in activity `search` / `q` ILIKE OR filters. */
export const TRANSACTION_TEXT_SEARCH_COLUMNS = [
  "vendor",
  "description",
  "notes",
  "business_purpose",
  "quick_label",
  "category",
] as const;

export function sanitizeTransactionSearchTerm(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const cleaned = t.replace(/%/g, "").slice(0, 200);
  return cleaned.length > 0 ? cleaned : null;
}
