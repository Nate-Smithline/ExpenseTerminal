import { applyActivityColumnFilters, parseColumnFiltersJson } from "@/lib/activity-column-filters";
import { sanitizeTransactionSearchTerm, TRANSACTION_TEXT_SEARCH_COLUMNS } from "@/lib/transaction-text-search";

/**
 * Applies saved Activity view filters from a page (status, type, account, search, column filters).
 * Date range always comes from the caller (e.g. dashboard MTD/QTD/YTD), not from saved `date_from` / `date_to`.
 */
export function applyPageActivityViewSavedFiltersToQuery(
  q: any,
  params: {
    userId: string;
    dateFrom: string;
    dateTo: string;
    filters: Record<string, unknown> | null | undefined;
    orgTypes: Map<string, string>;
  },
): any {
  const { userId, dateFrom, dateTo, filters, orgTypes } = params;
  let x = q.eq("user_id", userId).gte("date", dateFrom).lte("date", dateTo);
  const f = filters && typeof filters === "object" ? filters : {};

  const status = typeof f.status === "string" ? f.status : null;
  const txType = typeof f.transaction_type === "string" ? f.transaction_type : null;
  const source = typeof f.source === "string" ? f.source : null;
  const dataSourceId = typeof f.data_source_id === "string" ? f.data_source_id : null;
  const search = typeof f.search === "string" ? f.search : "";
  const columnFilters = parseColumnFiltersJson((f as Record<string, unknown>).column_filters);

  if (status) x = x.eq("status", status);
  if (txType) x = x.eq("transaction_type", txType);
  if (source) x = x.eq("source", source);
  if (dataSourceId) x = x.eq("data_source_id", dataSourceId);

  const safeSearch = sanitizeTransactionSearchTerm(search);
  if (safeSearch != null) {
    const pattern = `%${safeSearch}%`;
    x = x.or(TRANSACTION_TEXT_SEARCH_COLUMNS.map((col) => `${col}.ilike.${pattern}`).join(","));
  }

  if (columnFilters.length > 0) {
    x = applyActivityColumnFilters(x, columnFilters as any, orgTypes as any);
  }

  return x;
}
