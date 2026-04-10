/** Strip characters that break PostgREST `.or()` / `ilike` filters or widen matches unintentionally. */
export function sanitizeTransactionSearchTerm(raw: string): string | null {
  const t = raw
    .trim()
    .replace(/\\/g, "")
    .replace(/%/g, "")
    .replace(/_/g, "")
    .replace(/,/g, " ")
    .replace(/[().]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length === 0) return null;
  return t;
}

/** Columns on `transactions` searched as plain text (ilike). */
export const TRANSACTION_TEXT_SEARCH_COLUMNS = [
  "vendor",
  "description",
  "notes",
  "category",
  "schedule_c_line",
  "business_purpose",
  "quick_label",
  "transaction_type",
  "status",
  "source",
] as const;
